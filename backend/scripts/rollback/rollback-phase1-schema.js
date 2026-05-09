#!/usr/bin/env node
/**
 * Rollback Script: Phase 1 - Schema Changes
 * 
 * This script reverts the schema changes made in Phase 1 of the payment idempotency fixes.
 * 
 * WHAT IT DOES:
 * - Drops the cartHash index
 * - Drops the adminAssigned index
 * - Restores the old idempotency key index (with partialFilterExpression)
 * 
 * WHEN TO USE:
 * - If Phase 1 deployment causes errors
 * - If index creation fails
 * - If order creation starts failing
 * 
 * SAFETY:
 * - Does NOT drop fields (backward compatible)
 * - Does NOT delete data
 * - Can be run multiple times (idempotent)
 * 
 * USAGE:
 *   node backend/scripts/rollback/rollback-phase1-schema.js
 */

const mongoose = require('mongoose');
const readline = require('readline');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL;

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

async function rollbackPhase1() {
  console.log('🔄 Payment Idempotency Rollback - Phase 1 (Schema Changes)\n');
  
  try {
    // Connect to MongoDB
    console.log('📡 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    const db = mongoose.connection.db;
    const ordersCollection = db.collection('orders');
    
    // Show current indexes
    console.log('📋 Current indexes on orders collection:');
    const currentIndexes = await ordersCollection.indexes();
    currentIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    console.log('');
    
    // Confirm rollback
    console.log('⚠️  WARNING: This will rollback Phase 1 schema changes');
    console.log('   - Drop cartHash index');
    console.log('   - Drop adminAssigned index');
    console.log('   - Restore old idempotency key index (with partial filter)');
    console.log('');
    
    const answer = await askQuestion('Do you want to proceed? (yes/no): ');
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Rollback cancelled');
      process.exit(0);
    }
    
    console.log('\n🔄 Starting rollback...\n');
    
    // Step 1: Drop cartHash index
    console.log('1️⃣  Dropping cartHash index...');
    try {
      await ordersCollection.dropIndex('userId_1_cartHash_1_createdAt_1');
      console.log('✅ Dropped cartHash index');
    } catch (err) {
      if (err.code === 27 || err.message.includes('index not found')) {
        console.log('ℹ️  cartHash index not found (already dropped or never created)');
      } else {
        throw err;
      }
    }
    
    // Step 2: Drop adminAssigned index
    console.log('\n2️⃣  Dropping adminAssigned index...');
    try {
      await ordersCollection.dropIndex('adminAssigned_1');
      console.log('✅ Dropped adminAssigned index');
    } catch (err) {
      if (err.code === 27 || err.message.includes('index not found')) {
        console.log('ℹ️  adminAssigned index not found (already dropped or never created)');
      } else {
        throw err;
      }
    }
    
    // Step 3: Drop new idempotency key index (if exists)
    console.log('\n3️⃣  Dropping new idempotency key index...');
    try {
      await ordersCollection.dropIndex('userId_1_idempotencyKey_1');
      console.log('✅ Dropped new idempotency key index');
    } catch (err) {
      if (err.code === 27 || err.message.includes('index not found')) {
        console.log('ℹ️  New idempotency key index not found');
      } else {
        throw err;
      }
    }
    
    // Step 4: Restore old idempotency key index (with partial filter)
    console.log('\n4️⃣  Restoring old idempotency key index (with partial filter)...');
    try {
      await ordersCollection.createIndex(
        { userId: 1, idempotencyKey: 1 },
        {
          unique: true,
          name: 'userId_1_idempotencyKey_1',
          partialFilterExpression: {
            idempotencyKey: { $type: 'string' }
          }
        }
      );
      console.log('✅ Restored old idempotency key index');
    } catch (err) {
      if (err.code === 85 || err.message.includes('already exists')) {
        console.log('ℹ️  Old idempotency key index already exists');
      } else {
        throw err;
      }
    }
    
    // Show final indexes
    console.log('\n📋 Final indexes on orders collection:');
    const finalIndexes = await ordersCollection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    console.log('\n✅ Phase 1 rollback completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart backend application');
    console.log('   2. Verify order creation works');
    console.log('   3. Monitor logs for errors');
    console.log('   4. Check metrics dashboard');
    
  } catch (error) {
    console.error('\n❌ Rollback failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
    await mongoose.disconnect();
  }
}

// Run rollback
rollbackPhase1();
