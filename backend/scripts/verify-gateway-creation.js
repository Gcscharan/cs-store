#!/usr/bin/env node

/**
 * Verification Script: Gateway Creation
 * 
 * This script verifies that gateway order creation is working correctly
 * and no duplicate Razorpay orders are created.
 * 
 * Usage:
 *   node scripts/verify-gateway-creation.js [--days=7] [--verbose]
 * 
 * Options:
 *   --days=N     Check payment intents from last N days (default: 7)
 *   --verbose    Show detailed output
 */

const mongoose = require('mongoose');
const fs = require('fs');
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

async function checkDuplicateRazorpayOrders() {
  log('\n📋 Checking for duplicate Razorpay orders...', colors.blue);
  
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  const duplicates = await mongoose.connection.db.collection('paymentintents').aggregate([
    {
      $match: {
        gatewayOrderId: { $exists: true },
        createdAt: { $gte: cutoffDate }
      }
    },
    {
      $group: {
        _id: "$orderId",
        gatewayOrders: { 
          $push: { 
            intentId: "$_id",
            gatewayOrderId: "$gatewayOrderId",
            createdAt: "$createdAt"
          } 
        },
        count: { $sum: 1 }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    }
  ]).toArray();
  
  if (duplicates.length === 0) {
    log('✅ No duplicate Razorpay orders detected', colors.green);
    return { passed: true, count: 0 };
  } else {
    log(`❌ Found ${duplicates.length} orders with duplicate Razorpay gateway orders`, colors.red);
    
    if (verbose) {
      duplicates.forEach((dup, index) => {
        log(`\n  Order ${index + 1}:`, colors.yellow);
        log(`    Order ID: ${dup._id}`);
        log(`    Gateway Order Count: ${dup.count}`);
        log(`    Gateway Orders:`);
        dup.gatewayOrders.forEach(go => {
          log(`      - Intent: ${go.intentId}, Gateway Order: ${go.gatewayOrderId}, Created: ${go.createdAt}`);
        });
      });
    }
    
    return { passed: false, count: duplicates.length, details: duplicates };
  }
}

async function checkStuckPaymentIntents() {
  log('\n📋 Checking for stuck payment intents...', colors.blue);
  
  const cutoffDate = new Date(Date.now() - 60 * 60 * 1000); // Last hour
  
  const stuck = await mongoose.connection.db.collection('paymentintents').find({
    gatewayCreateAttemptedAt: { $exists: true },
    gatewayOrderId: { $exists: false },
    status: "CREATED",
    createdAt: { $gte: cutoffDate }
  }).toArray();
  
  if (stuck.length === 0) {
    log('✅ No stuck payment intents found', colors.green);
    return { passed: true, count: 0 };
  } else {
    log(`⚠️  Found ${stuck.length} stuck payment intents (attempted but no gatewayOrderId)`, colors.yellow);
    
    if (verbose) {
      stuck.forEach((intent, index) => {
        const ageMinutes = Math.round((Date.now() - new Date(intent.gatewayCreateAttemptedAt).getTime()) / 60000);
        log(`\n  Intent ${index + 1}:`, colors.yellow);
        log(`    Intent ID: ${intent._id}`);
        log(`    Order ID: ${intent.orderId}`);
        log(`    Attempted At: ${intent.gatewayCreateAttemptedAt}`);
        log(`    Age: ${ageMinutes} minutes`);
        log(`    Status: ${intent.status}`);
      });
    }
    
    // Stuck intents are a warning, not a failure (may be in progress)
    // Only fail if there are many (>10)
    if (stuck.length > 10) {
      log(`❌ Too many stuck payment intents (${stuck.length} > 10)`, colors.red);
      return { passed: false, count: stuck.length, details: stuck };
    } else {
      log(`   This is acceptable if they are recent (<5 minutes old)`, colors.yellow);
      return { passed: true, count: stuck.length, warning: true };
    }
  }
}

async function analyzeGatewayCreationConflicts() {
  log('\n📋 Analyzing gateway creation conflicts from logs...', colors.blue);
  
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
    
    // Count gateway creation events
    let claims = 0;
    let claimWins = 0;
    let claimLosses = 0;
    let waitSuccesses = 0;
    let waitTimeouts = 0;
    let waitFailures = 0;
    
    lines.forEach(line => {
      if (line.includes('GATEWAY_CLAIM')) {
        if (line.includes('GATEWAY_CLAIM_WON')) {
          claimWins++;
        } else if (line.includes('GATEWAY_CLAIM_LOST')) {
          claimLosses++;
        } else if (line.includes('GATEWAY_CLAIM_WAIT_SUCCESS')) {
          waitSuccesses++;
        } else if (line.includes('GATEWAY_CLAIM_WAIT_TIMEOUT')) {
          waitTimeouts++;
        } else if (line.includes('GATEWAY_CLAIM_WAIT_FAILED')) {
          waitFailures++;
        }
        claims++;
      }
    });
    
    const claimLossRate = claims > 0 ? (claimLosses / claims * 100).toFixed(2) : 0;
    const waitSuccessRate = claimLosses > 0 ? (waitSuccesses / claimLosses * 100).toFixed(2) : 0;
    
    log(`   Total gateway creation claims: ${claims}`);
    log(`   Claim wins: ${claimWins}`);
    log(`   Claim losses: ${claimLosses} (${claimLossRate}%)`);
    log(`   Wait successes: ${waitSuccesses} (${waitSuccessRate}% of losses)`);
    log(`   Wait timeouts: ${waitTimeouts}`);
    log(`   Wait failures: ${waitFailures}`);
    
    // Claim loss rate 10-30% is expected during concurrent retries
    if (parseFloat(claimLossRate) > 50) {
      log(`⚠️  Claim loss rate ${claimLossRate}% is high (>50%)`, colors.yellow);
      log(`   This indicates many concurrent retries`, colors.yellow);
    } else {
      log(`✅ Claim loss rate ${claimLossRate}% is within expected range`, colors.green);
    }
    
    // Most losers should wait successfully
    if (claimLosses > 0 && parseFloat(waitSuccessRate) < 80) {
      log(`❌ Wait success rate ${waitSuccessRate}% is too low (<80%)`, colors.red);
      return { passed: false, claimLossRate: parseFloat(claimLossRate), waitSuccessRate: parseFloat(waitSuccessRate) };
    } else if (claimLosses > 0) {
      log(`✅ Wait success rate ${waitSuccessRate}% is good (>80%)`, colors.green);
    }
    
    // Timeouts should be rare
    const timeoutRate = claims > 0 ? (waitTimeouts / claims * 100).toFixed(2) : 0;
    if (parseFloat(timeoutRate) > 5) {
      log(`❌ Timeout rate ${timeoutRate}% is too high (>5%)`, colors.red);
      return { passed: false, timeoutRate: parseFloat(timeoutRate) };
    } else if (waitTimeouts > 0) {
      log(`⚠️  Timeout rate ${timeoutRate}% (${waitTimeouts} timeouts)`, colors.yellow);
    }
    
    return { 
      passed: true, 
      claimLossRate: parseFloat(claimLossRate), 
      waitSuccessRate: parseFloat(waitSuccessRate),
      timeoutRate: parseFloat(timeoutRate)
    };
    
  } catch (error) {
    log(`⚠️  Error reading log file: ${error.message}`, colors.yellow);
    log('   Skipping log analysis', colors.yellow);
    return { passed: true, skipped: true };
  }
}

async function main() {
  try {
    log('🔍 Payment Idempotency Verification: Gateway Creation', colors.blue);
    log(`📅 Checking payment intents from last ${days} days\n`);
    
    await connectToDatabase();
    
    // Run all checks
    const results = {
      duplicateRazorpayOrders: await checkDuplicateRazorpayOrders(),
      stuckPaymentIntents: await checkStuckPaymentIntents(),
      gatewayCreationConflicts: await analyzeGatewayCreationConflicts(),
    };
    
    // Summary
    log('\n' + '='.repeat(60), colors.blue);
    log('📊 VERIFICATION SUMMARY', colors.blue);
    log('='.repeat(60), colors.blue);
    
    const allPassed = results.duplicateRazorpayOrders.passed && 
                      results.stuckPaymentIntents.passed && 
                      results.gatewayCreationConflicts.passed;
    
    if (allPassed) {
      log('\n✅ All checks passed', colors.green);
      log('✅ No duplicate Razorpay orders detected', colors.green);
      
      if (results.stuckPaymentIntents.count > 0) {
        log(`⚠️  ${results.stuckPaymentIntents.count} stuck payment intents (acceptable if recent)`, colors.yellow);
      } else {
        log('✅ No stuck payment intents', colors.green);
      }
      
      if (!results.gatewayCreationConflicts.skipped) {
        log(`✅ Claim loss rate: ${results.gatewayCreationConflicts.claimLossRate}% (expected during retries)`, colors.green);
        if (results.gatewayCreationConflicts.waitSuccessRate) {
          log(`✅ Wait success rate: ${results.gatewayCreationConflicts.waitSuccessRate}% (losers wait correctly)`, colors.green);
        }
      }
      
      log('\n🎉 Verification PASSED', colors.green);
    } else {
      log('\n❌ Some checks failed:', colors.red);
      
      if (!results.duplicateRazorpayOrders.passed) {
        log(`   - ${results.duplicateRazorpayOrders.count} orders with duplicate Razorpay gateway orders`, colors.red);
      }
      
      if (!results.stuckPaymentIntents.passed) {
        log(`   - ${results.stuckPaymentIntents.count} stuck payment intents (too many)`, colors.red);
      }
      
      if (!results.gatewayCreationConflicts.passed) {
        if (results.gatewayCreationConflicts.waitSuccessRate !== undefined) {
          log(`   - Wait success rate too low: ${results.gatewayCreationConflicts.waitSuccessRate}%`, colors.red);
        }
        if (results.gatewayCreationConflicts.timeoutRate !== undefined) {
          log(`   - Timeout rate too high: ${results.gatewayCreationConflicts.timeoutRate}%`, colors.red);
        }
      }
      
      log('\n⚠️  Verification FAILED - See details above', colors.red);
      log('📖 Refer to PAYMENT_IDEMPOTENCY_RUNBOOK.md → Procedure 3', colors.yellow);
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
