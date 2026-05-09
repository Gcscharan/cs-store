/**
 * Migration: Add Idempotency Fields to Order Model
 * 
 * Phase 1 of Payment Idempotency Fixes
 * 
 * This migration adds:
 * 1. cartHash field for content-based deduplication
 * 2. adminAssigned fields for idempotent admin assignment
 * 3. Updated indexes for idempotency enforcement
 * 
 * SAFETY: This is a NON-BREAKING migration. All fields are optional initially.
 * 
 * Run this BEFORE deploying Phase 1 code changes.
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  process.exit(1);
}

async function runMigration() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const ordersCollection = db.collection('orders');
    
    // 1. VALIDATE EXISTING IDEMPOTENCY KEY INDEX
    console.log('\n🔍 Step 1: Validating existing idempotency key index...');
    const existingIndexes = await ordersCollection.indexes();
    const idempotencyKeyIndex = existingIndexes.find(index => 
      index.key && index.key.userId === 1 && index.key.idempotencyKey === 1
    );
    
    if (!idempotencyKeyIndex) {
      console.error('❌ CRITICAL: Idempotency key index not found');
      console.error('❌ Expected index: { userId: 1, idempotencyKey: 1 }');
      process.exit(1);
    }
    
    console.log('✅ Idempotency key index found:', idempotencyKeyIndex.name);
    
    // 2. UPDATE IDEMPOTENCY KEY INDEX (REMOVE PARTIAL FILTER)
    console.log('\n🔄 Step 2: Updating idempotency key index...');
    
    // Check if index has partial filter
    if (idempotencyKeyIndex.partialFilterExpression) {
      console.log('⚠️  Index has partial filter - will recreate without it');
      
      // Drop old index
      await ordersCollection.dropIndex(idempotencyKeyIndex.name);
      console.log('✅ Dropped old idempotency key index');
      
      // Create new index without partial filter
      await ordersCollection.createIndex(
        { userId: 1, idempotencyKey: 1 },
        { 
          unique: true,
          name: 'userId_1_idempotencyKey_1'
        }
      );
      console.log('✅ Created new idempotency key index (without partial filter)');
    } else {
      console.log('✅ Index already has no partial filter - no update needed');
    }
    
    // 3. CREATE CART HASH INDEX
    console.log('\n🔄 Step 3: Creating cart hash index...');
    try {
      await ordersCollection.createIndex(
        { userId: 1, cartHash: 1, createdAt: 1 },
        { 
          unique: true,
          name: 'userId_1_cartHash_1_createdAt_1',
          background: true // Create in background to avoid blocking
        }
      );
      console.log('✅ Created cart hash index');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  Cart hash index already exists');
      } else if (error.message.includes('duplicate key')) {
        console.error('❌ CRITICAL: Cannot create cart hash index - duplicates exist');
        console.error('❌ This should not happen on initial migration');
        console.error('❌ Run this query to find duplicates:');
        console.error('   db.orders.aggregate([');
        console.error('     { $match: { cartHash: { $exists: true } } },');
        console.error('     { $group: { _id: { userId: "$userId", cartHash: "$cartHash" }, count: { $sum: 1 } } },');
        console.error('     { $match: { count: { $gt: 1 } } }');
        console.error('   ])');
        throw error;
      } else {
        throw error;
      }
    }
    
    // 4. CREATE ADMIN ASSIGNED INDEX
    console.log('\n🔄 Step 4: Creating admin assigned index...');
    try {
      await ordersCollection.createIndex(
        { adminAssigned: 1 },
        { 
          name: 'adminAssigned_1',
          background: true
        }
      );
      console.log('✅ Created admin assigned index');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  Admin assigned index already exists');
      } else {
        throw error;
      }
    }
    
    // 5. VERIFY FINAL INDEX STATE
    console.log('\n🔍 Step 5: Verifying final index state...');
    const finalIndexes = await ordersCollection.indexes();
    console.log('📋 Order collection indexes:');
    finalIndexes.forEach(index => {
      const keyStr = JSON.stringify(index.key);
      const flags = [];
      if (index.unique) flags.push('unique');
      if (index.sparse) flags.push('sparse');
      if (index.background) flags.push('background');
      const flagsStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';
      console.log(`   - ${index.name}: ${keyStr}${flagsStr}`);
    });
    
    // Verify critical indexes exist
    const hasIdempotencyKeyIndex = finalIndexes.some(index => 
      index.key && index.key.userId === 1 && index.key.idempotencyKey === 1 && index.unique === true
    );
    const hasCartHashIndex = finalIndexes.some(index => 
      index.key && index.key.userId === 1 && index.key.cartHash === 1 && index.key.createdAt === 1 && index.unique === true
    );
    const hasAdminAssignedIndex = finalIndexes.some(index => 
      index.key && index.key.adminAssigned === 1
    );
    
    if (!hasIdempotencyKeyIndex) {
      console.error('❌ CRITICAL: Idempotency key index not found');
      process.exit(1);
    }
    if (!hasCartHashIndex) {
      console.error('❌ CRITICAL: Cart hash index not found');
      process.exit(1);
    }
    if (!hasAdminAssignedIndex) {
      console.error('❌ CRITICAL: Admin assigned index not found');
      process.exit(1);
    }
    
    console.log('✅ All critical indexes verified');
    
    // 6. CHECK FOR EXISTING DATA
    console.log('\n🔍 Step 6: Checking existing data...');
    const totalOrders = await ordersCollection.countDocuments();
    const ordersWithCartHash = await ordersCollection.countDocuments({ cartHash: { $exists: true } });
    const ordersWithAdminAssigned = await ordersCollection.countDocuments({ adminAssigned: { $exists: true } });
    
    console.log(`📊 Total orders: ${totalOrders}`);
    console.log(`📊 Orders with cartHash: ${ordersWithCartHash}`);
    console.log(`📊 Orders with adminAssigned: ${ordersWithAdminAssigned}`);
    
    if (ordersWithCartHash > 0) {
      console.log('ℹ️  Some orders already have cartHash (likely from previous migration or code deployment)');
    }
    if (ordersWithAdminAssigned > 0) {
      console.log('ℹ️  Some orders already have adminAssigned (likely from previous migration or code deployment)');
    }
    
    // 7. VALIDATE NO DUPLICATE IDEMPOTENCY KEYS
    console.log('\n🔍 Step 7: Validating no duplicate idempotency keys...');
    const duplicateIdempotencyKeys = await ordersCollection.aggregate([
      { $match: { idempotencyKey: { $exists: true, $ne: null, $ne: "" } } },
      { $group: { _id: { userId: "$userId", idempotencyKey: "$idempotencyKey" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    if (duplicateIdempotencyKeys.length > 0) {
      console.error('❌ CRITICAL: Found duplicate idempotency keys:', duplicateIdempotencyKeys);
      console.error('❌ Cannot proceed with migration - fix duplicates manually first');
      console.error('❌ Use this query to find affected orders:');
      duplicateIdempotencyKeys.forEach(dup => {
        console.error(`   db.orders.find({ userId: ObjectId("${dup._id.userId}"), idempotencyKey: "${dup._id.idempotencyKey}" })`);
      });
      process.exit(1);
    } else {
      console.log('✅ No duplicate idempotency keys found');
    }
    
    console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('✅ Database is ready for Phase 1 code deployment');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Deploy Phase 1 code to staging');
    console.log('   2. Test order creation in staging');
    console.log('   3. Verify indexes are being used');
    console.log('   4. Deploy to production');
    console.log('   5. Monitor for 24 hours');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
console.log('🚀 Starting Payment Idempotency Fields Migration (Phase 1)...');
console.log('📋 This migration will:');
console.log('   1. Validate existing idempotency key index');
console.log('   2. Update idempotency key index (remove partial filter)');
console.log('   3. Create cart hash index');
console.log('   4. Create admin assigned index');
console.log('   5. Verify final index state');
console.log('   6. Check existing data');
console.log('   7. Validate no duplicate idempotency keys');
console.log('');

runMigration();
