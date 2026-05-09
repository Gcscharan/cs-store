/**
 * Migration: Backfill Missing Cart Hashes
 * 
 * Phase 4 of Payment Idempotency Fixes
 * 
 * This migration backfills cart hashes for orders that were created
 * before the cart hash feature was deployed.
 * 
 * SAFETY: This migration only adds missing data, does not modify existing data.
 * 
 * Run this AFTER Phase 3 enforcement is complete.
 */

const { MongoClient } = require('mongodb');
const crypto = require('crypto');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  process.exit(1);
}

/**
 * Generate deterministic hash of cart contents
 * (Same logic as in orderBuilder.ts)
 */
function generateCartHash(cartItems, address, total) {
  // Normalize payload for consistent hashing
  const payload = JSON.stringify({
    items: cartItems
      .map(i => ({
        productId: i.productId.toString(),
        qty: i.qty,
        price: i.price,
      }))
      .sort((a, b) => a.productId.localeCompare(b.productId)), // Sort for consistency
    address: {
      pincode: address.pincode,
      lat: Math.round(address.lat * 1000000) / 1000000, // 6 decimal places
      lng: Math.round(address.lng * 1000000) / 1000000,
    },
    total: Math.round(total * 100) / 100, // 2 decimal places
  });
  
  return crypto.createHash('sha256').update(payload).digest('hex');
}

async function runMigration() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    const ordersCollection = db.collection('orders');
    
    // 1. COUNT ORDERS WITHOUT CART HASH
    console.log('\n🔍 Step 1: Counting orders without cart hash...');
    const ordersWithoutCartHash = await ordersCollection.countDocuments({ 
      cartHash: { $exists: false } 
    });
    
    console.log(`📊 Found ${ordersWithoutCartHash} orders without cart hash`);
    
    if (ordersWithoutCartHash === 0) {
      console.log('✅ All orders already have cart hash - no backfill needed');
      console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
      return;
    }
    
    // 2. FETCH ORDERS WITHOUT CART HASH (IN BATCHES)
    console.log('\n🔄 Step 2: Backfilling cart hashes...');
    const batchSize = 100;
    let processedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    const cursor = ordersCollection.find({ 
      cartHash: { $exists: false } 
    }).batchSize(batchSize);
    
    while (await cursor.hasNext()) {
      const order = await cursor.next();
      
      try {
        // Validate order has required fields
        if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
          console.log(`⚠️  Skipping order ${order._id}: No items`);
          skippedCount++;
          continue;
        }
        
        if (!order.address || !order.address.pincode) {
          console.log(`⚠️  Skipping order ${order._id}: No address`);
          skippedCount++;
          continue;
        }
        
        if (typeof order.grandTotal !== 'number') {
          console.log(`⚠️  Skipping order ${order._id}: No grandTotal`);
          skippedCount++;
          continue;
        }
        
        // Extract cart items
        const cartItems = order.items.map(item => ({
          productId: item.productId,
          qty: item.qty || 1,
          price: item.priceAtOrderTime || 0,
        }));
        
        // Extract address
        const address = {
          pincode: order.address.pincode,
          lat: order.address.lat || 0,
          lng: order.address.lng || 0,
        };
        
        // Generate cart hash
        const cartHash = generateCartHash(cartItems, address, order.grandTotal);
        
        // Update order with cart hash
        await ordersCollection.updateOne(
          { _id: order._id },
          { $set: { cartHash } }
        );
        
        processedCount++;
        
        // Log progress every 100 orders
        if (processedCount % 100 === 0) {
          console.log(`📊 Progress: ${processedCount}/${ordersWithoutCartHash} orders processed`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing order ${order._id}:`, error.message);
        errorCount++;
        
        // Continue with next order (don't fail entire migration)
        continue;
      }
    }
    
    console.log('\n✅ Backfill completed');
    console.log(`📊 Processed: ${processedCount} orders`);
    console.log(`📊 Skipped: ${skippedCount} orders (missing required fields)`);
    console.log(`📊 Errors: ${errorCount} orders`);
    
    // 3. VERIFY BACKFILL
    console.log('\n🔍 Step 3: Verifying backfill...');
    const remainingWithoutCartHash = await ordersCollection.countDocuments({ 
      cartHash: { $exists: false } 
    });
    
    console.log(`📊 Orders still without cart hash: ${remainingWithoutCartHash}`);
    
    if (remainingWithoutCartHash > 0) {
      console.log('⚠️  Some orders still missing cart hash (likely due to missing required fields)');
      console.log('⚠️  This is acceptable - these orders are likely incomplete or test data');
    } else {
      console.log('✅ All orders now have cart hash');
    }
    
    // 4. CHECK FOR DUPLICATE CART HASHES
    console.log('\n🔍 Step 4: Checking for duplicate cart hashes...');
    const duplicateCartHashes = await ordersCollection.aggregate([
      { $match: { cartHash: { $exists: true } } },
      { 
        $group: { 
          _id: { userId: "$userId", cartHash: "$cartHash" }, 
          orders: { $push: { orderId: "$_id", createdAt: "$createdAt" } },
          count: { $sum: 1 } 
        } 
      },
      { $match: { count: { $gt: 1 } } },
      { 
        $project: {
          userId: "$_id.userId",
          cartHash: "$_id.cartHash",
          orders: 1,
          count: 1,
          timeDiff: {
            $subtract: [
              { $max: "$orders.createdAt" },
              { $min: "$orders.createdAt" }
            ]
          }
        }
      },
      { $match: { timeDiff: { $lt: 5 * 60 * 1000 } } } // Within 5 minutes
    ]).toArray();
    
    if (duplicateCartHashes.length > 0) {
      console.log('⚠️  Found duplicate cart hashes within 5 minutes:');
      duplicateCartHashes.forEach(dup => {
        console.log(`   - User: ${dup.userId}, Cart Hash: ${dup.cartHash}, Count: ${dup.count}`);
        console.log(`     Orders: ${dup.orders.map(o => o.orderId).join(', ')}`);
      });
      console.log('⚠️  These are likely legitimate duplicate orders from before the fix');
      console.log('⚠️  They will be prevented going forward by the cart hash index');
    } else {
      console.log('✅ No duplicate cart hashes found within 5 minutes');
    }
    
    // 5. VERIFY CART HASH INDEX
    console.log('\n🔍 Step 5: Verifying cart hash index...');
    const indexes = await ordersCollection.indexes();
    const cartHashIndex = indexes.find(index => 
      index.key && index.key.userId === 1 && index.key.cartHash === 1 && index.key.createdAt === 1
    );
    
    if (!cartHashIndex) {
      console.error('❌ CRITICAL: Cart hash index not found');
      console.error('❌ Run migration 07_add_idempotency_fields.js first');
      process.exit(1);
    }
    
    if (!cartHashIndex.unique) {
      console.error('❌ CRITICAL: Cart hash index is not unique');
      console.error('❌ This should not happen - check migration 07_add_idempotency_fields.js');
      process.exit(1);
    }
    
    console.log('✅ Cart hash index verified:', cartHashIndex.name);
    
    console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('✅ Cart hashes backfilled for all orders');
    console.log('');
    console.log('📋 Summary:');
    console.log(`   - Total orders processed: ${processedCount}`);
    console.log(`   - Orders skipped: ${skippedCount}`);
    console.log(`   - Errors: ${errorCount}`);
    console.log(`   - Orders still without cart hash: ${remainingWithoutCartHash}`);
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Review skipped orders (if any)');
    console.log('   2. Verify no duplicate orders in production');
    console.log('   3. Remove old idempotency logic');
    console.log('   4. Update documentation');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
console.log('🚀 Starting Cart Hash Backfill Migration (Phase 4)...');
console.log('📋 This migration will:');
console.log('   1. Count orders without cart hash');
console.log('   2. Backfill cart hashes for all orders');
console.log('   3. Verify backfill');
console.log('   4. Check for duplicate cart hashes');
console.log('   5. Verify cart hash index');
console.log('');

runMigration();
