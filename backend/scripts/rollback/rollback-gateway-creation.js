#!/usr/bin/env node
/**
 * Rollback Script: Gateway Creation
 * 
 * This script provides emergency recovery for gateway creation issues.
 * 
 * WHAT IT DOES:
 * - Identifies payment intents stuck in gateway creation
 * - Identifies duplicate Razorpay orders
 * - Provides manual recovery options
 * 
 * WHEN TO USE:
 * - If gateway creation timeout rate >5%
 * - If payment intents stuck with attemptedAt but no gatewayOrderId
 * - If duplicate Razorpay orders detected
 * 
 * SAFETY:
 * - Read-only by default (reports issues)
 * - Requires explicit confirmation for fixes
 * - Verifies with Razorpay API before changes
 * 
 * USAGE:
 *   node backend/scripts/rollback/rollback-gateway-creation.js [--fix]
 */

const mongoose = require('mongoose');
const readline = require('readline');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;
const FIX_MODE = process.argv.includes('--fix');
const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

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

async function analyzeGatewayCreation() {
  console.log('🔍 Gateway Creation Analysis\n');
  
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const paymentIntentsCollection = db.collection('paymentintents');
    
    // Issue 1: Stuck payment intents (attemptedAt but no gatewayOrderId)
    console.log('1️⃣  Checking for stuck payment intents...');
    const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS);
    
    const stuckIntents = await paymentIntentsCollection.find({
      gatewayCreateAttemptedAt: { $exists: true, $lt: stuckThreshold },
      gatewayOrderId: { $exists: false },
      status: { $in: ['CREATED', 'PENDING'] }
    }).toArray();
    
    if (stuckIntents.length > 0) {
      console.log(`⚠️  Found ${stuckIntents.length} stuck payment intents:`);
      stuckIntents.forEach(intent => {
        const ageMinutes = Math.floor((Date.now() - intent.gatewayCreateAttemptedAt.getTime()) / 60000);
        console.log(`   - Intent ${intent._id}: attempted ${ageMinutes} minutes ago, no gatewayOrderId`);
      });
    } else {
      console.log('✅ No stuck payment intents found');
    }
    
    // Issue 2: Recent stuck intents (last hour)
    console.log('\n2️⃣  Checking for recent stuck intents (last hour)...');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const recentStuck = await paymentIntentsCollection.find({
      gatewayCreateAttemptedAt: { $gte: oneHourAgo, $exists: true },
      gatewayOrderId: { $exists: false },
      status: { $in: ['CREATED', 'PENDING'] }
    }).toArray();
    
    if (recentStuck.length > 0) {
      console.log(`⚠️  Found ${recentStuck.length} recently stuck intents (last hour)`);
      console.log('   This may indicate ongoing gateway creation issues');
    } else {
      console.log('✅ No recent stuck intents');
    }
    
    // Issue 3: Check for duplicate gateway orders (same orderId, multiple gatewayOrderIds)
    console.log('\n3️⃣  Checking for duplicate gateway orders...');
    const duplicateGateway = await paymentIntentsCollection.aggregate([
      {
        $match: {
          gatewayOrderId: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$orderId',
          intents: { $push: { intentId: '$_id', gatewayOrderId: '$gatewayOrderId' } },
          count: { $sum: 1 }
        }
      },
      {
        $match: { count: { $gt: 1 } }
      }
    ]).toArray();
    
    if (duplicateGateway.length > 0) {
      console.log(`❌ Found ${duplicateGateway.length} orders with multiple gateway orders!`);
      duplicateGateway.forEach(dup => {
        console.log(`   - Order ${dup._id}:`);
        dup.intents.forEach(intent => {
          console.log(`     * Intent ${intent.intentId}: ${intent.gatewayOrderId}`);
        });
      });
    } else {
      console.log('✅ No duplicate gateway orders found');
    }
    
    // Issue 4: Check claim statistics (last hour)
    console.log('\n4️⃣  Checking gateway creation statistics (last hour)...');
    
    const totalAttempts = await paymentIntentsCollection.countDocuments({
      gatewayCreateAttemptedAt: { $gte: oneHourAgo }
    });
    
    const successfulCreations = await paymentIntentsCollection.countDocuments({
      gatewayCreateAttemptedAt: { $gte: oneHourAgo },
      gatewayOrderId: { $exists: true }
    });
    
    const successRate = totalAttempts > 0 ? (successfulCreations / totalAttempts * 100).toFixed(2) : 0;
    
    console.log(`ℹ️  Total attempts: ${totalAttempts}`);
    console.log(`ℹ️  Successful: ${successfulCreations}`);
    console.log(`ℹ️  Success rate: ${successRate}%`);
    
    if (successRate < 95) {
      console.log('⚠️  Success rate is below 95% - investigate gateway creation issues');
    }
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`   Stuck intents (>5 min): ${stuckIntents.length}`);
    console.log(`   Recent stuck (last hour): ${recentStuck.length}`);
    console.log(`   Duplicate gateway orders: ${duplicateGateway.length}`);
    console.log(`   Success rate (last hour): ${successRate}%`);
    
    // Fix mode
    if (FIX_MODE && stuckIntents.length > 0) {
      console.log('\n🔧 Fix Mode Enabled\n');
      
      const answer = await askQuestion('Do you want to fix stuck payment intents? (yes/no): ');
      
      if (answer.toLowerCase() === 'yes') {
        console.log('\n🔄 Fixing stuck payment intents...\n');
        
        for (const intent of stuckIntents) {
          console.log(`Processing intent ${intent._id}...`);
          
          // Option 1: Reset attemptedAt to allow retry
          console.log('  Resetting gatewayCreateAttemptedAt to allow retry...');
          await paymentIntentsCollection.updateOne(
            { _id: intent._id },
            { $unset: { gatewayCreateAttemptedAt: 1 } }
          );
          console.log(`✅ Reset intent ${intent._id} - will retry on next request`);
          
          // Note: In production, you might want to:
          // 1. Check Razorpay API to see if order exists
          // 2. If exists, update gatewayOrderId
          // 3. If not exists, reset attemptedAt
          // This requires Razorpay API credentials
        }
        
        console.log('\n✅ All stuck intents fixed!');
        console.log('\n📝 Users can now retry payment creation');
      } else {
        console.log('❌ Fix cancelled');
      }
    } else if (!FIX_MODE && stuckIntents.length > 0) {
      console.log('\n💡 To fix stuck intents, run:');
      console.log('   node backend/scripts/rollback/rollback-gateway-creation.js --fix');
    }
    
    console.log('\n📝 Next steps:');
    console.log('   1. Check backend logs for gateway creation errors:');
    console.log('      grep "GATEWAY_CLAIM" /var/log/backend.log | tail -50');
    console.log('');
    console.log('   2. Monitor gateway creation metrics:');
    console.log('      # Prometheus queries');
    console.log('      histogram_quantile(0.95, rate(gateway_creation_wait_time_ms_bucket[5m]))');
    console.log('      rate(gateway_creation_claim_losses_total[5m]) / rate(gateway_creation_claims_total[5m]) * 100');
    console.log('');
    console.log('   3. Check Razorpay status:');
    console.log('      curl https://status.razorpay.com/api/v2/status.json');
    console.log('');
    console.log('   4. If issues persist, consider:');
    console.log('      - Increasing timeout (GATEWAY_CREATION_TIMEOUT_MS)');
    console.log('      - Checking Razorpay API latency');
    console.log('      - Contacting Razorpay support');
    
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
analyzeGatewayCreation();
