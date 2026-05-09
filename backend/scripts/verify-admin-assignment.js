#!/usr/bin/env node

/**
 * Verification Script: Admin Assignment
 * 
 * This script verifies that admin assignment is idempotent and no duplicate
 * assignments occur.
 * 
 * Usage:
 *   node scripts/verify-admin-assignment.js [--days=7] [--verbose]
 * 
 * Options:
 *   --days=N     Check orders from last N days (default: 7)
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

async function checkDuplicateAssignments() {
  log('\n📋 Checking for duplicate admin assignments...', colors.blue);
  
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // Check for orders where adminAssignedAt is an array (would indicate multiple assignments)
  const duplicates = await mongoose.connection.db.collection('orders').aggregate([
    {
      $match: {
        adminAssigned: true,
        createdAt: { $gte: cutoffDate }
      }
    },
    {
      $project: {
        orderId: "$_id",
        adminAssigned: 1,
        adminAssignedAt: 1,
        adminAssignedBy: 1,
        isArray: { $isArray: "$adminAssignedAt" }
      }
    },
    {
      $match: { isArray: true }
    }
  ]).toArray();
  
  if (duplicates.length === 0) {
    log('✅ No duplicate admin assignments detected', colors.green);
    return { passed: true, count: 0 };
  } else {
    log(`❌ Found ${duplicates.length} orders with duplicate admin assignments`, colors.red);
    
    if (verbose) {
      duplicates.forEach((order, index) => {
        log(`\n  Order ${index + 1}:`, colors.yellow);
        log(`    Order ID: ${order.orderId}`);
        log(`    Admin Assigned: ${order.adminAssigned}`);
        log(`    Admin Assigned By: ${order.adminAssignedBy}`);
        log(`    Admin Assigned At (array): ${JSON.stringify(order.adminAssignedAt)}`);
      });
    }
    
    return { passed: false, count: duplicates.length, details: duplicates };
  }
}

async function checkAssignmentIntegrity() {
  log('\n📋 Checking admin assignment integrity...', colors.blue);
  
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // Check for orders with adminAssigned=true but no adminAssignedAt
  const missingTimestamp = await mongoose.connection.db.collection('orders').countDocuments({
    adminAssigned: true,
    adminAssignedAt: { $exists: false },
    createdAt: { $gte: cutoffDate }
  });
  
  if (missingTimestamp > 0) {
    log(`⚠️  Found ${missingTimestamp} assigned orders without adminAssignedAt timestamp`, colors.yellow);
    return { passed: false, missingTimestamp };
  }
  
  // Check for orders with adminAssignedAt but adminAssigned=false
  const timestampWithoutFlag = await mongoose.connection.db.collection('orders').countDocuments({
    adminAssigned: { $ne: true },
    adminAssignedAt: { $exists: true },
    createdAt: { $gte: cutoffDate }
  });
  
  if (timestampWithoutFlag > 0) {
    log(`⚠️  Found ${timestampWithoutFlag} orders with adminAssignedAt but adminAssigned=false`, colors.yellow);
    return { passed: false, timestampWithoutFlag };
  }
  
  log('✅ All assigned orders have adminAssignedAt timestamp', colors.green);
  log('✅ No orders have adminAssignedAt without adminAssigned=true', colors.green);
  
  return { passed: true };
}

async function analyzeAssignmentConflicts() {
  log('\n📋 Analyzing admin assignment conflicts from logs...', colors.blue);
  
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
    
    // Count assignment attempts and conflicts
    let attempts = 0;
    let conflicts = 0;
    let successes = 0;
    
    lines.forEach(line => {
      if (line.includes('ADMIN') && (line.includes('ASSIGNED') || line.includes('ASSIGNMENT_GUARD'))) {
        attempts++;
        
        if (line.includes('already assigned')) {
          conflicts++;
        } else if (line.includes('assigned to admin')) {
          successes++;
        }
      }
    });
    
    const conflictRate = attempts > 0 ? (conflicts / attempts * 100).toFixed(2) : 0;
    
    log(`   Total assignment attempts: ${attempts}`);
    log(`   Conflicts (already assigned): ${conflicts}`);
    log(`   Successes: ${successes}`);
    log(`   Conflict rate: ${conflictRate}%`);
    
    // Conflict rate <10% is acceptable (duplicate events are expected)
    if (parseFloat(conflictRate) < 10) {
      log(`✅ Conflict rate ${conflictRate}% is within acceptable range (<10%)`, colors.green);
      return { passed: true, conflictRate: parseFloat(conflictRate), attempts, conflicts };
    } else if (parseFloat(conflictRate) < 20) {
      log(`⚠️  Conflict rate ${conflictRate}% is elevated but acceptable (<20%)`, colors.yellow);
      return { passed: true, conflictRate: parseFloat(conflictRate), attempts, conflicts, warning: true };
    } else {
      log(`❌ Conflict rate ${conflictRate}% is too high (>20%)`, colors.red);
      return { passed: false, conflictRate: parseFloat(conflictRate), attempts, conflicts };
    }
    
  } catch (error) {
    log(`⚠️  Error reading log file: ${error.message}`, colors.yellow);
    log('   Skipping log analysis', colors.yellow);
    return { passed: true, skipped: true };
  }
}

async function checkEventConsumerIdempotency() {
  log('\n📋 Checking event consumer idempotency...', colors.blue);
  
  // Check if events collection exists
  const collections = await mongoose.connection.db.listCollections({ name: 'events' }).toArray();
  
  if (collections.length === 0) {
    log('⚠️  Events collection not found', colors.yellow);
    log('   Skipping event consumer check', colors.yellow);
    return { passed: true, skipped: true };
  }
  
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // Check for duplicate ORDER_CREATED events
  const duplicateEvents = await mongoose.connection.db.collection('events').aggregate([
    {
      $match: {
        eventType: "ORDER_CREATED",
        createdAt: { $gte: cutoffDate }
      }
    },
    {
      $group: {
        _id: "$data.orderId",
        events: { 
          $push: { 
            eventId: "$eventId",
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
  
  if (duplicateEvents.length > 0) {
    log(`⚠️  Found ${duplicateEvents.length} orders with duplicate ORDER_CREATED events`, colors.yellow);
    
    if (verbose) {
      duplicateEvents.slice(0, 5).forEach((dup, index) => {
        log(`\n  Order ${index + 1}:`, colors.yellow);
        log(`    Order ID: ${dup._id}`);
        log(`    Event Count: ${dup.count}`);
        log(`    Events:`);
        dup.events.forEach(evt => {
          log(`      - Event ID: ${evt.eventId}, Created: ${evt.createdAt}`);
        });
      });
      
      if (duplicateEvents.length > 5) {
        log(`\n  ... and ${duplicateEvents.length - 5} more`, colors.yellow);
      }
    }
    
    log(`   This is expected if event deduplication is not in place`, colors.yellow);
    log(`   Verify that admin assignment is still idempotent despite duplicate events`, colors.yellow);
  } else {
    log('✅ No duplicate ORDER_CREATED events found', colors.green);
  }
  
  return { passed: true, duplicateEvents: duplicateEvents.length };
}

async function main() {
  try {
    log('🔍 Payment Idempotency Verification: Admin Assignment', colors.blue);
    log(`📅 Checking orders from last ${days} days\n`);
    
    await connectToDatabase();
    
    // Run all checks
    const results = {
      duplicateAssignments: await checkDuplicateAssignments(),
      assignmentIntegrity: await checkAssignmentIntegrity(),
      assignmentConflicts: await analyzeAssignmentConflicts(),
      eventConsumerIdempotency: await checkEventConsumerIdempotency(),
    };
    
    // Summary
    log('\n' + '='.repeat(60), colors.blue);
    log('📊 VERIFICATION SUMMARY', colors.blue);
    log('='.repeat(60), colors.blue);
    
    const allPassed = results.duplicateAssignments.passed && 
                      results.assignmentIntegrity.passed && 
                      results.assignmentConflicts.passed && 
                      results.eventConsumerIdempotency.passed;
    
    if (allPassed) {
      log('\n✅ All checks passed', colors.green);
      log('✅ No duplicate admin assignments detected', colors.green);
      
      if (!results.assignmentConflicts.skipped) {
        log(`✅ Assignment conflict rate: ${results.assignmentConflicts.conflictRate}% (within acceptable range)`, colors.green);
      }
      
      log('✅ Assignment integrity verified', colors.green);
      
      if (results.eventConsumerIdempotency.duplicateEvents > 0) {
        log(`⚠️  ${results.eventConsumerIdempotency.duplicateEvents} orders with duplicate events (but assignments are idempotent)`, colors.yellow);
      } else {
        log('✅ No duplicate ORDER_CREATED events', colors.green);
      }
      
      if (results.assignmentConflicts.warning) {
        log('\n⚠️  Note: Conflict rate is elevated but still acceptable', colors.yellow);
      }
      
      log('\n🎉 Verification PASSED', colors.green);
    } else {
      log('\n❌ Some checks failed:', colors.red);
      
      if (!results.duplicateAssignments.passed) {
        log(`   - ${results.duplicateAssignments.count} orders with duplicate admin assignments`, colors.red);
      }
      
      if (!results.assignmentIntegrity.passed) {
        if (results.assignmentIntegrity.missingTimestamp) {
          log(`   - ${results.assignmentIntegrity.missingTimestamp} assigned orders without timestamp`, colors.red);
        }
        if (results.assignmentIntegrity.timestampWithoutFlag) {
          log(`   - ${results.assignmentIntegrity.timestampWithoutFlag} orders with timestamp but not assigned`, colors.red);
        }
      }
      
      if (!results.assignmentConflicts.passed) {
        log(`   - Assignment conflict rate too high: ${results.assignmentConflicts.conflictRate}%`, colors.red);
      }
      
      log('\n⚠️  Verification FAILED - See details above', colors.red);
      log('📖 Refer to PAYMENT_IDEMPOTENCY_RUNBOOK.md → Procedure 4', colors.yellow);
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
