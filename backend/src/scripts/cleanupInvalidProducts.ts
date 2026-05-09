/**
 * Product Cleanup Script - Safe Soft Delete
 * 
 * Soft-deletes products with invalid categories that are:
 * - NOT used in orders
 * - NOT in active carts
 * - Have no sellable stock OR are marked inactive
 * 
 * SAFETY FEATURES:
 * - Dry run mode (default)
 * - Order dependency check
 * - Cart dependency check
 * - Soft delete only (reversible)
 * - Detailed logging
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { Cart } from '../models/Cart';

/**
 * Get MongoDB URI from environment variables
 * Fails fast if not found
 */
function getMongoUri(): string {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || '';

  if (!uri) {
    console.error('❌ MONGO_URI or MONGODB_URI not found in environment variables');
    console.error('   Please set one of these in your .env file');
    process.exit(1);
  }

  return uri;
}

// Valid categories after standardization
const VALID_CATEGORIES = [
  'chocolates',
  'biscuits',
  'snacks',
  'beverages',
  'hot_snacks',
  'ladoos',
  'cakes',
];

interface CleanupStats {
  total: number;
  softDeleted: number;
  skipped: number;
  errors: number;
  skippedReasons: {
    usedInOrders: number;
    inCarts: number;
    hasStock: number;
    other: number;
  };
}

/**
 * Check if product can be safely deleted
 */
async function canSafelyDelete(product: any): Promise<{
  canDelete: boolean;
  reason: string;
}> {
  // Check orders
  const orderCount = await Order.countDocuments({
    'items.productId': product._id,
  });

  if (orderCount > 0) {
    return {
      canDelete: false,
      reason: `Used in ${orderCount} order(s) - CANNOT delete`,
    };
  }

  // Check carts
  const cartCount = await Cart.countDocuments({
    'items.productId': product._id,
  });

  if (cartCount > 0) {
    return {
      canDelete: false,
      reason: `In ${cartCount} active cart(s) - CANNOT delete`,
    };
  }

  // Check stock and sellability
  if (product.stock > 0 && product.isSellable) {
    return {
      canDelete: false,
      reason: `Has sellable stock (${product.stock}) - CANNOT delete`,
    };
  }

  return {
    canDelete: true,
    reason: 'Safe to delete',
  };
}

/**
 * Soft delete a product
 */
async function softDeleteProduct(
  product: any,
  dryRun: boolean
): Promise<'deleted' | 'error'> {
  try {
    if (dryRun) {
      console.log(`[DRY RUN] Would soft delete: "${product.name}"`);
      return 'deleted';
    }

    await Product.updateOne(
      { _id: product._id },
      {
        $set: {
          deletedAt: new Date(),
          isActive: false,
          isSellable: false,
        },
      }
    );

    console.log(`🗑️  Soft deleted: "${product.name}"`);
    return 'deleted';
  } catch (error) {
    console.error(`❌ Error soft deleting "${product.name}":`, error);
    return 'error';
  }
}

/**
 * Main cleanup function
 */
async function cleanupInvalidProducts(dryRun: boolean = true) {
  console.log('\n🧹 Product Cleanup Script\n');
  console.log('Configuration:');
  console.log(`  - Dry Run: ${dryRun ? 'YES (no changes will be made)' : 'NO (changes will be applied)'}`);
  console.log('\n' + '='.repeat(80) + '\n');

  const stats: CleanupStats = {
    total: 0,
    softDeleted: 0,
    skipped: 0,
    errors: 0,
    skippedReasons: {
      usedInOrders: 0,
      inCarts: 0,
      hasStock: 0,
      other: 0,
    },
  };

  try {
    // Find all products with invalid categories
    const invalidProducts = await Product.find({
      category: { $nin: VALID_CATEGORIES },
      deletedAt: null, // Only active products
    }).lean();

    stats.total = invalidProducts.length;

    console.log(`📊 Found ${stats.total} products with invalid categories\n`);

    if (stats.total === 0) {
      console.log('✅ No products need cleanup. All categories are valid!\n');
      return stats;
    }

    // Process each product
    for (const product of invalidProducts) {
      console.log(`\nProcessing: "${product.name}" (Category: ${product.category})`);

      // Check if safe to delete
      const { canDelete, reason } = await canSafelyDelete(product);

      if (!canDelete) {
        console.log(`  ⏭️  Skipping: ${reason}`);
        stats.skipped++;

        // Track skip reason
        if (reason.includes('order')) {
          stats.skippedReasons.usedInOrders++;
        } else if (reason.includes('cart')) {
          stats.skippedReasons.inCarts++;
        } else if (reason.includes('stock')) {
          stats.skippedReasons.hasStock++;
        } else {
          stats.skippedReasons.other++;
        }

        continue;
      }

      // Safe to delete
      console.log(`  ✅ ${reason}`);
      const result = await softDeleteProduct(product, dryRun);

      if (result === 'deleted') {
        stats.softDeleted++;
      } else {
        stats.errors++;
      }
    }

    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📊 Cleanup Summary:\n');
    console.log(`  Total products processed: ${stats.total}`);
    console.log(`  🗑️  Soft deleted: ${stats.softDeleted}`);
    console.log(`  ⏭️  Skipped: ${stats.skipped}`);
    console.log(`  ❌ Errors: ${stats.errors}`);
    console.log('');
    console.log('  Skip reasons:');
    console.log(`    - Used in orders: ${stats.skippedReasons.usedInOrders}`);
    console.log(`    - In active carts: ${stats.skippedReasons.inCarts}`);
    console.log(`    - Has sellable stock: ${stats.skippedReasons.hasStock}`);
    console.log(`    - Other: ${stats.skippedReasons.other}`);
    console.log('');

    if (dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes were made to the database');
      console.log('   Run with DRY_RUN=false to apply changes\n');
    } else {
      console.log('✅ Cleanup complete!\n');
    }

    // Recommendations
    if (stats.skippedReasons.usedInOrders > 0) {
      console.log('💡 Recommendation:');
      console.log(`   ${stats.skippedReasons.usedInOrders} products are used in orders and must be migrated:`);
      console.log('   DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories\n');
    }

    if (stats.skippedReasons.inCarts > 0) {
      console.log('💡 Recommendation:');
      console.log(`   ${stats.skippedReasons.inCarts} products are in active carts.`);
      console.log('   Consider clearing carts or migrating these products.\n');
    }

    if (stats.skippedReasons.hasStock > 0) {
      console.log('💡 Recommendation:');
      console.log(`   ${stats.skippedReasons.hasStock} products have sellable stock.`);
      console.log('   Consider migrating instead of deleting to preserve inventory.\n');
    }

    return stats;
  } catch (error) {
    console.error('❌ Fatal error during cleanup:', error);
    throw error;
  }
}

/**
 * Validate cleanup results
 */
async function validateCleanup() {
  console.log('\n🔍 Validating cleanup results...\n');

  const remainingInvalid = await Product.countDocuments({
    category: { $nin: VALID_CATEGORIES },
    deletedAt: null,
  });

  const totalActive = await Product.countDocuments({
    deletedAt: null,
  });

  const totalDeleted = await Product.countDocuments({
    deletedAt: { $ne: null },
  });

  console.log(`  Total active products: ${totalActive}`);
  console.log(`  Total soft-deleted products: ${totalDeleted}`);
  console.log(`  Active products with invalid categories: ${remainingInvalid}`);

  if (remainingInvalid === 0) {
    console.log('\n✅ Validation passed! All active products have valid categories.\n');
  } else {
    console.log('\n⚠️  Validation warning: Some products still have invalid categories.');
    console.log('   These may be products that are used in orders or carts.');
    console.log('   Run migration script to fix these:\n');
    console.log('   DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories\n');
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const mongoUri = getMongoUri();

    // Environment info
    console.log('⚠️  Running in:', process.env.NODE_ENV || 'development');
    
    // Safe connection logging (mask credentials)
    if (process.env.NODE_ENV !== 'production') {
      console.log('📡 Using DB:', mongoUri.replace(/\/\/.*@/, '//***:***@'));
    }

    // Connect to database
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Add runtime error handler
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB runtime error:', err);
    });

    // Configuration
    const dryRun = process.env.DRY_RUN !== 'false'; // Default to dry run for safety

    // Run cleanup
    const stats = await cleanupInvalidProducts(dryRun);

    // Validate results (only if not dry run)
    if (!dryRun) {
      await validateCleanup();
    }

    // Disconnect
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');

    process.exit(stats.errors > 0 ? 1 : 0);
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

export { cleanupInvalidProducts, validateCleanup };
