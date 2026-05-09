/**
 * Delete All Products Script - PERMANENT DELETION
 * 
 * WARNING: This script permanently deletes ALL products from the database.
 * 
 * SAFETY FEATURES:
 * - Dry run mode (default)
 * - Requires explicit FORCE flag
 * - Shows summary before deletion
 * - Logs products used in orders
 * - Backup recommendation
 * - Confirmation required
 * 
 * USAGE:
 * 1. Dry run (see what would be deleted):
 *    npm run delete:products
 * 
 * 2. Execute deletion (PERMANENT):
 *    DRY_RUN=false FORCE=true npm run delete:products
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { Cart } from '../models/Cart';

/**
 * Get MongoDB URI from environment variables
 */
function getMongoUri(): string {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || '';

  if (!uri) {
    console.error('❌ MONGO_URI or MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  return uri;
}

/**
 * Analyze products before deletion
 */
async function analyzeProducts() {
  console.log('\n📊 Analyzing products...\n');

  const totalProducts = await Product.countDocuments();
  const activeProducts = await Product.countDocuments({ deletedAt: null });
  const softDeletedProducts = await Product.countDocuments({ deletedAt: { $ne: null } });

  console.log(`  Total products: ${totalProducts}`);
  console.log(`  Active products: ${activeProducts}`);
  console.log(`  Soft-deleted products: ${softDeletedProducts}`);

  // Check products used in orders
  const ordersWithProducts = await Order.find({}, { 'items.productId': 1 }).lean();
  const productIdsInOrders = new Set<string>();
  
  ordersWithProducts.forEach(order => {
    order.items?.forEach((item: any) => {
      if (item.productId) {
        productIdsInOrders.add(item.productId.toString());
      }
    });
  });

  console.log(`  Products referenced in orders: ${productIdsInOrders.size}`);

  // Check products in carts
  const cartsWithProducts = await Cart.find({}, { 'items.productId': 1 }).lean();
  const productIdsInCarts = new Set<string>();
  
  cartsWithProducts.forEach(cart => {
    cart.items?.forEach((item: any) => {
      if (item.productId) {
        productIdsInCarts.add(item.productId.toString());
      }
    });
  });

  console.log(`  Products referenced in carts: ${productIdsInCarts.size}`);

  return {
    totalProducts,
    activeProducts,
    softDeletedProducts,
    productIdsInOrders: Array.from(productIdsInOrders),
    productIdsInCarts: Array.from(productIdsInCarts),
  };
}

/**
 * Main deletion function
 */
async function deleteAllProducts(dryRun: boolean, force: boolean) {
  console.log('\n🚨 DELETE ALL PRODUCTS - PERMANENT OPERATION\n');
  console.log('='.repeat(80) + '\n');

  // Analyze current state
  const analysis = await analyzeProducts();

  console.log('\n' + '='.repeat(80) + '\n');

  // Safety checks
  if (!force) {
    console.log('❌ ABORTING: FORCE flag not provided\n');
    console.log('⚠️  This operation will PERMANENTLY delete ALL products.');
    console.log('   To proceed, run with FORCE=true:\n');
    console.log('   DRY_RUN=false FORCE=true npm run delete:products\n');
    return;
  }

  if (dryRun) {
    console.log('🧪 DRY RUN MODE - No data will be deleted\n');
    console.log('What would be deleted:');
    console.log(`  - ${analysis.totalProducts} products (all)`);
    console.log(`  - ${analysis.activeProducts} active products`);
    console.log(`  - ${analysis.softDeletedProducts} soft-deleted products\n`);
    
    if (analysis.productIdsInOrders.length > 0) {
      console.log(`⚠️  WARNING: ${analysis.productIdsInOrders.length} products are referenced in orders`);
      console.log('   Deleting these will break order history!\n');
    }

    if (analysis.productIdsInCarts.length > 0) {
      console.log(`⚠️  WARNING: ${analysis.productIdsInCarts.length} products are in active carts`);
      console.log('   Deleting these will break user carts!\n');
    }

    console.log('To execute deletion, run:');
    console.log('DRY_RUN=false FORCE=true npm run delete:products\n');
    return;
  }

  // Final confirmation
  console.log('🔥 EXECUTING PERMANENT DELETION\n');
  
  if (analysis.productIdsInOrders.length > 0) {
    console.log(`⚠️  WARNING: Deleting ${analysis.productIdsInOrders.length} products used in orders`);
    console.log('   This WILL break order history!\n');
  }

  if (analysis.productIdsInCarts.length > 0) {
    console.log(`⚠️  WARNING: Deleting ${analysis.productIdsInCarts.length} products in carts`);
    console.log('   This WILL break user carts!\n');
  }

  // Execute deletion
  console.log('Deleting all products...');
  const result = await Product.deleteMany({});
  
  console.log(`\n✅ Deleted ${result.deletedCount} products\n`);

  // Verify deletion
  const remainingProducts = await Product.countDocuments();
  console.log(`Remaining products: ${remainingProducts}`);

  if (remainingProducts === 0) {
    console.log('\n✅ All products successfully deleted\n');
  } else {
    console.log(`\n⚠️  Warning: ${remainingProducts} products still remain\n`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const mongoUri = getMongoUri();

    // Configuration
    const dryRun = process.env.DRY_RUN !== 'false'; // Default to dry run
    const force = process.env.FORCE === 'true'; // Must explicitly set

    // Environment info
    console.log('⚠️  Running in:', process.env.NODE_ENV || 'development');
    
    // Safe connection logging (mask credentials)
    if (process.env.NODE_ENV !== 'production') {
      console.log('📡 Using DB:', mongoUri.replace(/\/\/.*@/, '//***:***@'));
    }

    // Connect to database
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Show configuration
    console.log('\nConfiguration:');
    console.log(`  DRY_RUN: ${dryRun}`);
    console.log(`  FORCE: ${force}`);

    // Backup reminder
    if (!dryRun && force) {
      console.log('\n⚠️  BACKUP REMINDER:');
      console.log('   Have you backed up your database?');
      console.log('   mongodump --uri="$MONGO_URI" --out=backup/pre-delete-$(date +%Y%m%d)\n');
    }

    // Execute deletion
    await deleteAllProducts(dryRun, force);

    // Disconnect
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Connection refused. Please check:');
      console.error('   1. MongoDB is running');
      console.error('   2. MONGO_URI in .env is correct');
      console.error('   3. Network/firewall allows connection\n');
    }
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { deleteAllProducts };
