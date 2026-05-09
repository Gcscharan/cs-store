#!/usr/bin/env node

/**
 * Verification Script: No Duplicate Orders
 * 
 * This script verifies that no duplicate orders exist in the database.
 * It checks both idempotency key and cart hash deduplication.
 * 
 * Usage:
 *   node scripts/verify-no-duplicate-orders.js [--days=7] [--verbose]
 * 
 * Options:
 *   --days=N     Check orders from last N days (default: 7)
 *   --verbose    Show detailed output
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Parse command line arguments
const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1]) : 7;
const verbose = args.includes('--verbose');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function connectToDatabase() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable not set');
  }
  
  await mongoose.connect(mongoUri);
  log('✅ Connected to MongoDB', colors.green);
}

async function checkDuplicatesByIdempotencyKey() {
  log('\n📋 Checking for duplicate orders by idempotency key...', colors.blue);
  
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const duplicates = await mongoose.connection.db.collection('orders').aggregate([
    {
      $match: {
        createdAt: { $gte: cutoffDate }
      }
    },
    {
      $group: {
        _id: { userId: "$userId", idempotencyKey: "$idempotencyKey" },
        orders: { 
          $push: { 
            orderId: "$_id", 
            createdAt: "$createdAt",
            paymentStatus: "$paymentStatus",
            total: "$grandTotal"
          } 
        },
        count: { $sum: 1 }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    {
      $project: {
        userId: "$_id.userId",
        idempotencyKey: "$_id.idempotencyKey",
        orders: 1,
        count: 1
      }
    }
  ]).toArray();
  
  if (duplicates.length === 0) {
    log('✅ No duplicate orders found (by idempotency key)', colors.green);
    return { passed: true, count: 0 };
  } else {
    log(`❌ Found ${duplicates.length} duplicate order sets (by idempotency key)`, colors.red);
    
    if (verbose) {
      duplicates.forEach((dup, index) => {
        log(`\n  Duplicate Set ${index + 1}:`, colors.yellow);
        log(`    User ID: ${dup.userId}`);
        log(`    Idempotency Key: ${dup.idempotencyKey}`);
        log(`    Order Count: ${dup.count}`);
        log(`    Orders:`);
        dup.orders.forEach(order => {
          log(`      - ID: ${order.orderId}, Created: ${order.createdAt}, Status: ${order.paymentStatus}, Total: ${order.total}`);
        });
      });
    }
    
    return { passed: false, count: duplicates.length, details: duplicates };
  }
}

async function checkDuplicatesByCartHash() {
  log('\n📋 Checking for duplicate orders by cart hash (within 5 minutes)...', colors.blue);
  
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const duplicates = await mongoose.connection.db.collection('orders').aggregate([
    {
      $match: {
        createdAt: { $gte: cutoffDate },
        cartHash: { $exists: true }
      }
    },
    {
      $group: {
        _id: { userId: "$userId", cartHash: "$cartHash" },
        orders: { 
          $push: { 
            orderId: "$_id", 
            createdAt: "$createdAt",
            idempotencyKey: "$idempotencyKey",
            paymentStatus: "$paymentStatus"
          } 
        },
        count: { $sum: 1 }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    {
      $project: {
        userId: "$_id.userId",
        cartHash: "$_id.cartHash",
        orders: 1,
        count: 1,
        minCreatedAt: { $min: "$orders.createdAt" },
        maxCreatedAt: { $max: "$orders.createdAt" },
        timeDiffMs: {
          $subtract: [
            { $max: "$orders.createdAt" },
            { $min: "$orders.createdAt" }
          ]
        }
      }
    },
    {
      $match: { 
        timeDiffMs: { $lt: 5 * 60 * 1000 } // Within 5 minutes
      }
    }
  ]).toArray();
  
  if (duplicates.length === 0) {
    log('✅ No duplicate orders found (by cart hash within 5 minutes)', colors.green);
    return { passed: true, count: 0 };
  } else {
    log(`❌ Found ${duplicates.length} duplicate order sets (by cart hash within 5 minutes)`, colors.red);
    
    if (verbose) {
      duplicates.forEach((dup, index) => {
        log(`\n  Duplicate Set ${index + 1}:`, colors.yellow);
        log(`    User ID: ${dup.userId}`);
        log(`    Cart Hash: ${dup.cartHash}`);
        log(`    Order Count: ${dup.count}`);
        log(`    Time Difference: ${Math.round(dup.timeDiffMs / 1000)}s`);
        log(`    Orders:`);
        dup.orders.forEach(order => {
          log(`      - ID: ${order.orderId}, Created: ${order.createdAt}, Key: ${order.idempotencyKey}, Status: ${order.paymentStatus}`);
        });
      });
    }
    
    return { passed: false, count: duplicates.length, details: duplicates };
  }
}

async function checkIndexHealth() {
  log('\n📋 Checking index health...', colors.blue);
  
  const indexes = await mongoose.connection.db.collection('orders').indexes();
  
  // Check idempotency key index
  const idempotencyIndex = indexes.find(idx => 
    idx.key.userId && idx.key.idempotencyKey
  );
  
  if (!idempotencyIndex) {
    log('❌ Idempotency key index not found', colors.red);
    return { passed: false, message: 'Idempotency key index missing' };
  }
  
  if (!idempotencyIndex.unique) {
    log('❌ Idempotency key index is not unique', colors.red);
    return { passed: false, message: 'Idempotency key index not unique' };
  }
  
  log('✅ Idempotency key index exists and is unique', colors.green);
  
  // Check cart hash index
  const cartHashIndex = indexes.find(idx => 
    idx.key.userId && idx.key.cartHash
  );
  
  if (!cartHashIndex) {
    log('⚠️  Cart hash index not found (may not be deployed yet)', colors.yellow);
    return { passed: true, message: 'Cart hash index missing (expected if not deployed)' };
  }
  
  if (!cartHashIndex.unique) {
    log('❌ Cart hash index is not unique', colors.red);
    return { passed: false, message: 'Cart hash index not unique' };
  }
  
  log('✅ Cart hash index exists and is unique', colors.green);
  
  return { passed: true };
}

async function main() {
  try {
    log('🔍 Payment Idempotency Verification: No Duplicate Orders', colors.blue);
    log(`📅 Checking orders from last ${days} days\n`);
    
    await connectToDatabase();
    
    // Run all checks
    const results = {
      idempotencyKey: await checkDuplicatesByIdempotencyKey(),
      cartHash: await checkDuplicatesByCartHash(),
      indexes: await checkIndexHealth(),
    };
    
    // Summary
    log('\n' + '='.repeat(60), colors.blue);
    log('📊 VERIFICATION SUMMARY', colors.blue);
    log('='.repeat(60), colors.blue);
    
    const allPassed = results.idempotencyKey.passed && 
                      results.cartHash.passed && 
                      results.indexes.passed;
    
    if (allPassed) {
      log('\n✅ All checks passed - No duplicate orders detected', colors.green);
      log('✅ Indexes are healthy', colors.green);
      log('\n🎉 Verification PASSED', colors.green);
    } else {
      log('\n❌ Some checks failed:', colors.red);
      
      if (!results.idempotencyKey.passed) {
        log(`   - ${results.idempotencyKey.count} duplicate order sets (by idempotency key)`, colors.red);
      }
      
      if (!results.cartHash.passed) {
        log(`   - ${results.cartHash.count} duplicate order sets (by cart hash)`, colors.red);
      }
      
      if (!results.indexes.passed) {
        log(`   - Index issue: ${results.indexes.message}`, colors.red);
      }
      
      log('\n⚠️  Verification FAILED - See details above', colors.red);
      log('📖 Refer to PAYMENT_IDEMPOTENCY_RUNBOOK.md for incident response', colors.yellow);
    }
    
    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    log(`\n❌ Error during verification: ${error.message}`, colors.red);
    if (verbose) {
      console.error(error);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the script
main();
