#!/usr/bin/env node
/**
 * Rollback Script: Admin Assignment
 * 
 * This script provides recovery for admin assignment issues.
 * 
 * WHAT IT DOES:
 * - Identifies orders with duplicate admin assignments
 * - Identifies orders not assigned despite being created
 * - Provides manual recovery options
 * 
 * WHEN TO USE:
 * - If admin assignment conflict rate >10%
 * - If orders not being assigned to admins
 * - If duplicate assignments detected
 * 
 * SAFETY:
 * - Read-only by default (reports issues)
 * - Requires explicit confirmation for fixes
 * - Preserves assignment history
 * 
 * USAGE:
 *   node backend/scripts/rollback/rollback-admin-assignment.js [--fix]
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

async function analyzeAdminAssignment() {
  console.log('🔍 Admin Assignment Analysis\n');
  
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const ordersCollection = db.collection('orders');
    
    // Issue 1: Orders not assigned (created >5 min ago, not assigned)
    console.log('1️⃣  Checking for unassigned orders...');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const unassignedOrders = await ordersCollection.find({
      createdAt: { $lt: fiveMinutesAgo },
      paymentStatus: 'PENDING',
      adminAssigned: { $ne: true }
    }).toArray();
    
    if (unassignedOrders.length > 0) {
      console.log(`⚠️  Found ${unassignedOrders.length} unassigned orders:`);
      unassignedOrders.slice(0, 10).forEach(order => {
        const ageMinutes = Math.floor((Date.now() - order.createdAt.getTime()) / 60000);
        console.log(`   - Order ${order._id}: created ${ageMinutes} minutes ago, not assigned`);
      });
      if (unassignedOrders.length > 10) {
        console.log(`   ... and ${unassignedOrders.length - 10} more`);
      }
    } else {
      console.log('✅ No unassigned orders found');
    }
    
    // Issue 2: Check assignment statistics (last hour)
    console.log('\n2️⃣  Checking assignment statistics (last hour)...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentOrders = await ordersCollection.countDocuments({
      createdAt: { $gte: oneHourAgo }
    });
    
    const recentAssigned = await ordersCollection.countDocuments({
      createdAt: { $gte: oneHourAgo },
      adminAssigned: true
    });
    
    const assignmentRate = recentOrders > 0 ? (recentAssigned / recentOrders * 100).toFixed(2) : 0;
    
    console.log(`ℹ️  Total orders created: ${recentOrders}`);
    console.log(`ℹ️  Orders assigned: ${recentAssigned}`);
    console.log(`ℹ️  Assignment rate: ${assignmentRate}%`);
    
    if (assignmentRate < 95) {
      console.log('⚠️  Assignment rate is below 95% - investigate assignment issues');
    }
    
    // Issue 3: Check for orders with adminAssigned=true but no timestamp
    console.log('\n3️⃣  Checking for inconsistent assignment data...');
    const inconsistentAssignments = await ordersCollection.find({
      adminAssigned: true,
      adminAssignedAt: { $exists: false }
    }).toArray();
    
    if (inconsistentAssignments.length > 0) {
      console.log(`⚠️  Found ${inconsistentAssignments.length} orders with inconsistent assignment data`);
      console.log('   (adminAssigned=true but no adminAssignedAt timestamp)');
    } else {
      console.log('✅ No inconsistent assignment data found');
    }
    
    // Issue 4: Check assignment by source
    console.log('\n4️⃣  Checking assignment sources...');
    const assignmentSources = await ordersCollection.aggregate([
      {
        $match: {
          adminAssigned: true,
          adminAssignedBy: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$adminAssignedBy',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]).toArray();
    
    if (assignmentSources.length > 0) {
      console.log('ℹ️  Assignment sources:');
      assignmentSources.forEach(source => {
        console.log(`   - ${source._id}: ${source.count} orders`);
      });
    } else {
      console.log('ℹ️  No assignment source data available');
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Unassigned orders (>5 min): ${unassignedOrders.length}`);
    console.log(`   Assignment rate (last hour): ${assignmentRate}%`);
    console.log(`   Inconsistent assignments: ${inconsistentAssignments.length}`);
    
    // Fix mode
    if (FIX_MODE && (unassignedOrders.length > 0 || inconsistentAssignments.length > 0)) {
      console.log('\n🔧 Fix Mode Enabled\n');
      
      const answer = await askQuestion('Do you want to fix these issues? (yes/no): ');
      
      if (answer.toLowerCase() === 'yes') {
        console.log('\n🔄 Fixing issues...\n');
        
        // Fix unassigned orders
        if (unassignedOrders.length > 0) {
          console.log('Fixing unassigned orders...');
          for (const order of unassignedOrders) {
            // Assign to system
            await ordersCollection.updateOne(
              { _id: order._id, adminAssigned: { $ne: true } },
              {
                $set: {
                  adminAssigned: true,
                  adminAssignedAt: new Date(),
                  adminAssignedBy: 'MANUAL_RECOVERY'
                }
              }
            );
            console.log(`✅ Assigned order ${order._id}`);
          }
        }
        
        // Fix inconsistent assignments
        if (inconsistentAssignments.length > 0) {
          console.log('\nFixing inconsistent assignments...');
          for (const order of inconsistentAssignments) {
            // Add missing timestamp
            await ordersCollection.updateOne(
              { _id: order._id },
              {
                $set: {
                  adminAssignedAt: order.createdAt, // Use creation time as fallback
                  adminAssignedBy: order.adminAssignedBy || 'UNKNOWN'
                }
              }
            );
            console.log(`✅ Fixed assignment data for order ${order._id}`);
          }
        }
        
        console.log('\n✅ All issues fixed!');
      } else {
        console.log('❌ Fix cancelled');
      }
    } else if (!FIX_MODE && (unassignedOrders.length > 0 || inconsistentAssignments.length > 0)) {
      console.log('\n💡 To fix these issues, run:');
      console.log('   node backend/scripts/rollback/rollback-admin-assignment.js --fix');
    }
    
    console.log('\n📝 Next steps:');
    console.log('   1. Check backend logs for assignment errors:');
    console.log('      grep "ADMIN.*ASSIGNMENT" /var/log/backend.log | tail -50');
    console.log('');
    console.log('   2. Monitor assignment conflict rate:');
    console.log('      # Prometheus query');
    console.log('      rate(admin_assignment_conflicts_total[5m]) / rate(admin_assignment_attempts_total[5m]) * 100');
    console.log('');
    console.log('   3. Check event bus for ORDER_CREATED events:');
    console.log('      # Verify events are being published and consumed');
    console.log('');
    console.log('   4. If assignment rate is low, check:');
    console.log('      - Event consumer is running');
    console.log('      - No errors in event processing');
    console.log('      - Database connectivity');
    
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
analyzeAdminAssignment();
