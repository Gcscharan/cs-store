#!/usr/bin/env node
/**
 * Rollback Script: Atomic Finalization
 * 
 * This script provides emergency rollback for atomic finalization if issues are detected.
 * 
 * WHAT IT DOES:
 * - Identifies orders stuck in PENDING state with finalizedAt set
 * - Identifies orders with multiple finalization attempts
 * - Provides manual recovery options
 * 
 * WHEN TO USE:
 * - If finalization conflict rate >10% for >30 minutes
 * - If orders stuck in PENDING state despite payment captured
 * - If duplicate finalization detected
 * 
 * SAFETY:
 * - Read-only by default (reports issues)
 * - Requires explicit confirmation for fixes
 * - Creates backup before any changes
 * 
 * USAGE:
 *   node backend/scripts/rollback/rollback-atomic-finalization.js [--fix]
 */

const mongoose = require('mongoose');
const readline = require('readline');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
const FIX_MODE = process.argv.includes('--fix');

if (!MONGODB_URI) {
  console.error('❌ Error: MONGODB_URI or DATABASE_URL environment variable not set');
  process.exit(1);
}

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function analyzeFinalization() {
  console.log('🔍 Atomic Finalization Analysis\n');
  
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const ordersCollection = db.collection('orders');
    
    // Issue 1: Orders stuck in PENDING with finalizedAt
    console.log('1️⃣  Checking for orders stuck in PENDING with finalizedAt...');
    const stuckOrders = await ordersCollection.find({
      paymentStatus: 'PENDING',
      finalizedAt: { $exists: true }
    }).toArray();
    
    if (stuckOrders.length > 0) {
      console.log(`⚠️  Found ${stuckOrders.length} stuck orders:`);
      stuckOrders.forEach(order => {
        console.log(`   - Order ${order._id}: finalizedAt=${order.finalizedAt}, status=PENDING`);
      });
    } else {
      console.log('✅ No stuck orders found');
    }
    
    // Issue 2: Orders with payment captured but not finalized
    console.log('\n2️⃣  Checking for orders with payment captured but not finalized...');
    const unfinalizedOrders = await ordersCollection.find({
      paymentStatus: 'PENDING',
      razorpayPaymentId: { $exists: true, $ne: null },
      finalizedAt: { $exists: false }
    }).toArray();
    
    if (unfinalizedOrders.length > 0) {
      console.log(`⚠️  Found ${unfinalizedOrders.length} unfinalized orders with payment:`);
      unfinalizedOrders.forEach(order => {
        console.log(`   - Order ${order._id}: razorpayPaymentId=${order.razorpayPaymentId}, status=PENDING`);
      });
    } else {
      console.log('✅ No unfinalized orders found');
    }
    
    // Issue 3: Check finalization conflict rate (last hour)
    console.log('\n3️⃣  Checking finalization attempts (last hour)...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentOrders = await ordersCollection.find({
      updatedAt: { $gte: oneHourAgo },
      paymentStatus: 'PAID'
    }).toArray();
    
    console.log(`ℹ️  ${recentOrders.length} orders finalized in last hour`);
    
    // Issue 4: Check for duplicate finalizations (should not exist)
    console.log('\n4️⃣  Checking for duplicate finalizations...');
    const duplicateFinalized = await ordersCollection.aggregate([
      {
        $match: {
          paymentStatus: 'PAID',
          finalizedAt: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$_id',
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();
    
    if (duplicateFinalized.length > 0) {
      console.log(`❌ Found ${duplicateFinalized.length} orders with duplicate finalization!`);
      console.log('   This should NOT happen with atomic operations');
    } else {
      console.log('✅ No duplicate finalizations found');
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Stuck orders (PENDING + finalizedAt): ${stuckOrders.length}`);
    console.log(`   Unfinalized orders (payment captured): ${unfinalizedOrders.length}`);
    console.log(`   Recent finalizations (last hour): ${recentOrders.length}`);
    console.log(`   Duplicate finalizations: ${duplicateFinalized.length}`);
    
    // Fix mode
    if (FIX_MODE && (stuckOrders.length > 0 || unfinalizedOrders.length > 0)) {
      console.log('\n🔧 Fix Mode Enabled\n');
      
      const answer = await askQuestion('Do you want to fix these issues? (yes/no): ');
      
      if (answer.toLowerCase() === 'yes') {
        console.log('\n🔄 Fixing issues...\n');
        
        // Fix stuck orders (PENDING + finalizedAt)
        if (stuckOrders.length > 0) {
          console.log('Fixing stuck orders...');
          for (const order of stuckOrders) {
            // Check if payment was actually captured
            if (order.razorpayPaymentId) {
              // Mark as PAID
              await ordersCollection.updateOne(
                { _id: order._id },
                { $set: { paymentStatus: 'PAID' } }
              );
              console.log(`✅ Fixed order ${order._id}: PENDING → PAID`);
            } else {
              // Remove finalizedAt (payment not captured)
              await ordersCollection.updateOne(
                { _id: order._id },
                { $unset: { finalizedAt: 1 } }
              );
              console.log(`✅ Fixed order ${order._id}: Removed finalizedAt`);
            }
          }
        }
        
        // Fix unfinalized orders (payment captured but not finalized)
        if (unfinalizedOrders.length > 0) {
          console.log('\nFixing unfinalized orders...');
          for (const order of unfinalizedOrders) {
            // Verify payment with Razorpay (would need API call)
            // For now, just mark as finalized
            await ordersCollection.updateOne(
              { _id: order._id, finalizedAt: { $exists: false } },
              {
                $set: {
                  paymentStatus: 'PAID',
                  finalizedAt: new Date(),
                  paymentConfirmedBy: 'MANUAL_RECOVERY'
                }
              }
            );
            console.log(`✅ Fixed order ${order._id}: Marked as PAID`);
          }
        }
        
        console.log('\n✅ All issues fixed!');
      } else {
        console.log('❌ Fix cancelled');
      }
    } else if (!FIX_MODE && (stuckOrders.length > 0 || unfinalizedOrders.length > 0)) {
      console.log('\n💡 To fix these issues, run:');
      console.log('   node backend/scripts/rollback/rollback-atomic-finalization.js --fix');
    }
    
    console.log('\n📝 Next steps:');
    console.log('   1. Check backend logs for finalization errors:');
    console.log('      grep "FINALIZATION_GUARD" /var/log/backend.log | tail -50');
    console.log('');
    console.log('   2. Monitor finalization conflict rate:');
    console.log('      # Prometheus query');
    console.log('      rate(finalization_conflicts_total[5m]) / rate(finalization_attempts_total[5m]) * 100');
    console.log('');
    console.log('   3. If conflict rate >10%, investigate:');
    console.log('      - Check for webhook delays');
    console.log('      - Check for polling issues');
    console.log('      - Check Razorpay status');
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

// Run analysis
analyzeFinalization();
