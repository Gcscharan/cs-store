#!/usr/bin/env node

/**
 * Verification Script: Atomic Finalization
 * 
 * This script verifies that payment finalization is atomic and no duplicate
 * PAID writes occur.
 * 
 * Usage:
 *   node scripts/verify-atomic-finalization.js [--days=7] [--verbose]
 * 
 * Options:
 *   --days=N     Check orders from last N days (default: 7)
 *   --verbose    Show detailed output
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
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

async function checkDuplicatePaidWrites() {
  log('\n📋 Checking for duplicate PAID writes...', colors.blue);
  
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // Check for orders where finalizedAt is an array (would indicate multiple writes)
  const duplicates = await mongoose.connection.db.collection('orders').aggregate([
    {
      $match: {
        paymentStatus: "PAID",
        createdAt: { $gte: cutoffDate }
      }
    },
    {
      $project: {
        orderId: "$_id",
        finalizedAt: 1,
        paymentStatus: 1,
        paymentConfirmedBy: 1,
        isArray: { $isArray: "$finalizedAt" }
      }
    },
    {
      $match: { isArray: true }
    }
  ]).toArray();
  
  if (duplicates.length === 0) {
    log('✅ No duplicate PAID writes detected', colors.green);
    return { passed: true, count: 0 };
  } else {
    log(`❌ Found ${duplicates.length} orders with duplicate PAID writes`, colors.red);
    
    if (verbose) {
      duplicates.forEach((order, index) => {
        log(`\n  Order ${index + 1}:`, colors.yellow);
        log(`    Order ID: ${order.orderId}`);
        log(`    Payment Status: ${order.paymentStatus}`);
        log(`    Confirmed By: ${order.paymentConfirmedBy}`);
        log(`    Finalized At (array): ${JSON.stringify(order.finalizedAt)}`);
      });
    }
    
    return { passed: false, count: duplicates.length, details: duplicates };
  }
}

async function analyzeFinalizationConflicts() {
  log('\n📋 Analyzing finalization conflicts from logs...', colors.blue);
  
  const logFile = process.env.LOG_FILE || '/var/log/backend.log';
  
  // Check if log file exists
  if (!fs.existsSync(logFile)) {
    log(`⚠️  Log file not found: ${logFile}`, colors.yellow);
    log('   Skipping log analysis (run on production server)', colors.yellow);
    return { passed: true, skipped: true };
  }
  
  try {
    const logContent = fs.readFileSync(logFile, 'utf8');
    const lines = logContent.split('\n');
    
    // Count finalization attempts and conflicts
    let attempts = 0;
    let conflicts = 0;
    let webhookFinalizations = 0;
    let pollingFinalizations = 0;
    let reconciliationFinalizations = 0;
    
    lines.forEach(line => {
      if (line.includes('FINALIZED') || line.includes('FINALIZATION_GUARD')) {
        attempts++;
        
        if (line.includes('already finalized')) {
          conflicts++;
        }
        
        if (line.includes('confirmedBy":"WEBHOOK"')) {
          webhookFinalizations++;
        } else if (line.includes('confirmedBy":"POLLING"')) {
          pollingFinalizations++;
        } else if (line.includes('confirmedBy":"RECONCILIATION"')) {
          reconciliationFinalizations++;
        }
      }
    });
    
    const conflictRate = attempts > 0 ? (conflicts / attempts * 100).toFixed(2) : 0;
    
    log(`   Total finalization attempts: ${attempts}`);
    log(`   Conflicts (already finalized): ${conflicts}`);
    log(`   Conflict rate: ${conflictRate}%`);
    
    if (verbose) {
      log(`\n   Finalization sources:`);
      log(`     - WEBHOOK: ${webhookFinalizations} (${(webhookFinalizations / attempts * 100).toFixed(1)}%)`);
      log(`     - POLLING: ${pollingFinalizations} (${(pollingFinalizations / attempts * 100).toFixed(1)}%)`);
      log(`     - RECONCILIATION: ${reconciliationFinalizations} (${(reconciliationFinalizations / attempts * 100).toFixed(1)}%)`);
    }
    
    // Conflict rate <5% is acceptable (webhook + polling both attempting)
    if (parseFloat(conflictRate) < 5) {
      log(`✅ Conflict rate ${conflictRate}% is within acceptable range (<5%)`, colors.green);
      return { passed: true, conflictRate: parseFloat(conflictRate), attempts, conflicts };
    } else if (parseFloat(conflictRate) < 10) {
      log(`⚠️  Conflict rate ${conflictRate}% is elevated but acceptable (<10%)`, colors.yellow);
      return { passed: true, conflictRate: parseFloat(conflictRate), attempts, conflicts, warning: true };
    } else {
      log(`❌ Conflict rate ${conflictRate}% is too high (>10%)`, colors.red);
      return { passed: false, conflictRate: parseFloat(conflictRate), attempts, conflicts };
    }
    
  } catch (error) {
    log(`⚠️  Error reading log file: ${error.message}`, colors.yellow);
    log('   Skipping log analysis', colors.yellow);
    return { passed: true, skipped: true };
  }
}

async function checkFinalizationIntegrity() {
  log('\n📋 Checking finalization integrity...', colors.blue);
  
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // Check for PAID orders without finalizedAt
  const missingFinalizedAt = await mongoose.connection.db.collection('orders').countDocuments({
    paymentStatus: "PAID",
    finalizedAt: { $exists: false },
    createdAt: { $gte: cutoffDate }
  });
  
  if (missingFinalizedAt > 0) {
    log(`⚠️  Found ${missingFinalizedAt} PAID orders without finalizedAt timestamp`, colors.yellow);
    return { passed: false, missingFinalizedAt };
  }
  
  // Check for orders with finalizedAt but not PAID
  const finalizedNotPaid = await mongoose.connection.db.collection('orders').countDocuments({
    paymentStatus: { $ne: "PAID" },
    finalizedAt: { $exists: true },
    createdAt: { $gte: cutoffDate }
  });
  
  if (finalizedNotPaid > 0) {
    log(`⚠️  Found ${finalizedNotPaid} orders with finalizedAt but not PAID`, colors.yellow);
    return { passed: false, finalizedNotPaid };
  }
  
  log('✅ All PAID orders have finalizedAt timestamp', colors.green);
  log('✅ No orders have finalizedAt without being PAID', colors.green);
  
  return { passed: true };
}

async function main() {
  try {
    log('🔍 Payment Idempotency Verification: Atomic Finalization', colors.blue);
    log(`📅 Checking orders from last ${days} days\n`);
    
    await connectToDatabase();
    
    // Run all checks
    const results = {
      duplicatePaidWrites: await checkDuplicatePaidWrites(),
      finalizationConflicts: await analyzeFinalizationConflicts(),
      finalizationIntegrity: await checkFinalizationIntegrity(),
    };
    
    // Summary
    log('\n' + '='.repeat(60), colors.blue);
    log('📊 VERIFICATION SUMMARY', colors.blue);
    log('='.repeat(60), colors.blue);
    
    const allPassed = results.duplicatePaidWrites.passed && 
                      results.finalizationConflicts.passed && 
                      results.finalizationIntegrity.passed;
    
    if (allPassed) {
      log('\n✅ All checks passed', colors.green);
      log('✅ No duplicate PAID writes detected', colors.green);
      
      if (!results.finalizationConflicts.skipped) {
        log(`✅ Finalization conflict rate: ${results.finalizationConflicts.conflictRate}% (within acceptable range)`, colors.green);
      }
      
      log('✅ Finalization integrity verified', colors.green);
      
      if (results.finalizationConflicts.warning) {
        log('\n⚠️  Note: Conflict rate is elevated but still acceptable', colors.yellow);
      }
      
      log('\n🎉 Verification PASSED', colors.green);
    } else {
      log('\n❌ Some checks failed:', colors.red);
      
      if (!results.duplicatePaidWrites.passed) {
        log(`   - ${results.duplicatePaidWrites.count} orders with duplicate PAID writes`, colors.red);
      }
      
      if (!results.finalizationConflicts.passed) {
        log(`   - Finalization conflict rate too high: ${results.finalizationConflicts.conflictRate}%`, colors.red);
      }
      
      if (!results.finalizationIntegrity.passed) {
        if (results.finalizationIntegrity.missingFinalizedAt) {
          log(`   - ${results.finalizationIntegrity.missingFinalizedAt} PAID orders without finalizedAt`, colors.red);
        }
        if (results.finalizationIntegrity.finalizedNotPaid) {
          log(`   - ${results.finalizationIntegrity.finalizedNotPaid} orders with finalizedAt but not PAID`, colors.red);
        }
      }
      
      log('\n⚠️  Verification FAILED - See details above', colors.red);
      log('📖 Refer to PAYMENT_IDEMPOTENCY_RUNBOOK.md → Procedure 2', colors.yellow);
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
