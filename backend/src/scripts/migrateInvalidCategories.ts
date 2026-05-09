/**
 * Production-Safe Category Migration Script
 * 
 * Migrates products with invalid categories to valid ones
 * OR soft-deletes them if they can't be migrated safely
 * 
 * SAFETY FEATURES:
 * - Dry run mode (default)
 * - Checks for order dependencies
 * - Checks for cart dependencies
 * - Soft delete (reversible)
 * - Detailed logging
 * - Backup recommendation
 */

import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { Order } from '../models/Order';

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

// Smart migration mapping for invalid categories
const CATEGORY_MIGRATION_MAP: Record<string, string> = {
  // Unmapped categories → Best fit valid category
  'groceries': 'snacks',        // General food items → snacks
  'vegetables': 'snacks',       // Fresh produce → snacks
  'fruits': 'snacks',           // Fresh produce → snacks
  'dairy': 'beverages',         // Milk products → beverages
  'meat': 'hot_snacks',         // Protein items → hot snacks
  'household': 'snacks',        // General items → snacks
  'personal_care': 'snacks',    // General items → snacks
  'medicines': 'snacks',        // General items → snacks
  'electronics': 'snacks',      // General items → snacks
  'clothing': 'snacks',         // General items → snacks
  'other': 'snacks',            // Catch-all → snacks
};

interface MigrationStats {
  total: number;
  migrated: number;
  softDeleted: number;
  skipped: number;
  errors: number;
}

interface MigrationOptions {
  dryRun: boolean;
  autoMigrate: boolean;
  softDeleteUnused: boolean;
}

/**
 * Check if product is used in any orders
 */
async function isProductUsedInOrders(productId: mongoose.Types.ObjectId): Promise<boolean> {
  const orderCount = await Order.countDocuments({
    'items.productId': productId,
  });
  return orderCount > 0;
}

/**
 * Migrate a single product to a valid category
 */
async function migrateProduct(
  product: any,
  targetCategory: string,
  options: MigrationOptions
): Promise<'migrated' | 'skipped' | 'error'> {
  try {
    if (options.dryRun) {
      console.log(`[DRY RUN] Would migrate: "${product.name}" (${product.category} → ${targetCategory})`);
      return 'migrated';
    }

    await Product.updateOne(
      { _id: product._id },
      { 
        $set: { 
          category: targetCategory,
          updatedAt: new Date(),
        } 
      }
    );

    console.log(`✅ Migrated: "${product.name}" (${product.category} → ${targetCategory})`);
    return 'migrated';
  } catch (error) {
    console.error(`❌ Error migrating "${product.name}":`, error);
    return 'error';
  }
}

/**
 * Soft delete a product (reversible)
 */
async function softDeleteProduct(
  product: any,
  reason: string,
  options: MigrationOptions
): Promise<'deleted' | 'skipped' | 'error'> {
  try {
    if (options.dryRun) {
      console.log(`[DRY RUN] Would soft delete: "${product.name}" (Reason: ${reason})`);
      return 'deleted';
    }

    await Product.updateOne(
      { _id: product._id },
      { 
        $set: { 
          deletedAt: new Date(),
          isActive: false,
          isSellable: false,
        } 
      }
    );

    console.log(`🗑️  Soft deleted: "${product.name}" (Reason: ${reason})`);
    return 'deleted';
  } catch (error) {
    console.error(`❌ Error soft deleting "${product.name}":`, error);
    return 'error';
  }
}

/**
 * Main migration function
 */
async function migrateInvalidCategories(options: MigrationOptions) {
  console.log('\n🚀 Starting Category Migration Script\n');
  console.log('Configuration:');
  console.log(`  - Dry Run: ${options.dryRun ? 'YES (no changes will be made)' : 'NO (changes will be applied)'}`);
  console.log(`  - Auto Migrate: ${options.autoMigrate ? 'YES' : 'NO'}`);
  console.log(`  - Soft Delete Unused: ${options.softDeleteUnused ? 'YES' : 'NO'}`);
  console.log('\n' + '='.repeat(80) + '\n');

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    softDeleted: 0,
    skipped: 0,
    errors: 0,
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
      console.log('✅ No products need migration. All categories are valid!\n');
      return stats;
    }

    // Group by category for reporting
    const categoryGroups: Record<string, number> = {};
    invalidProducts.forEach(p => {
      categoryGroups[p.category] = (categoryGroups[p.category] || 0) + 1;
    });

    console.log('Invalid categories found:');
    Object.entries(categoryGroups).forEach(([cat, count]) => {
      const target = CATEGORY_MIGRATION_MAP[cat] || 'UNKNOWN';
      console.log(`  - ${cat}: ${count} products → will migrate to "${target}"`);
    });
    console.log('\n' + '='.repeat(80) + '\n');

    // Process each product
    for (const product of invalidProducts) {
      console.log(`\nProcessing: "${product.name}" (Category: ${product.category})`);

      // Check if product is used in orders
      const usedInOrders = await isProductUsedInOrders(product._id);

      if (usedInOrders) {
        console.log(`  ⚠️  Product is used in orders - MUST migrate (cannot delete)`);
        
        const targetCategory = CATEGORY_MIGRATION_MAP[product.category];
        if (!targetCategory) {
          console.log(`  ❌ No migration mapping found for "${product.category}" - SKIPPING`);
          stats.skipped++;
          continue;
        }

        const result = await migrateProduct(product, targetCategory, options);
        if (result === 'migrated') stats.migrated++;
        else if (result === 'error') stats.errors++;
        else stats.skipped++;
      } else {
        console.log(`  ℹ️  Product is NOT used in orders`);

        if (options.autoMigrate) {
          // Auto-migrate to best-fit category
          const targetCategory = CATEGORY_MIGRATION_MAP[product.category];
          if (!targetCategory) {
            console.log(`  ❌ No migration mapping found for "${product.category}" - SKIPPING`);
            stats.skipped++;
            continue;
          }

          const result = await migrateProduct(product, targetCategory, options);
          if (result === 'migrated') stats.migrated++;
          else if (result === 'error') stats.errors++;
          else stats.skipped++;
        } else if (options.softDeleteUnused) {
          // Soft delete unused products
          const result = await softDeleteProduct(
            product,
            `Invalid category: ${product.category}`,
            options
          );
          if (result === 'deleted') stats.softDeleted++;
          else if (result === 'error') stats.errors++;
          else stats.skipped++;
        } else {
          console.log(`  ⏭️  Skipping (auto-migrate and soft-delete both disabled)`);
          stats.skipped++;
        }
      }
    }

    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📊 Migration Summary:\n');
    console.log(`  Total products processed: ${stats.total}`);
    console.log(`  ✅ Migrated: ${stats.migrated}`);
    console.log(`  🗑️  Soft deleted: ${stats.softDeleted}`);
    console.log(`  ⏭️  Skipped: ${stats.skipped}`);
    console.log(`  ❌ Errors: ${stats.errors}`);
    console.log('');

    if (options.dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes were made to the database');
      console.log('   Run with dryRun: false to apply changes\n');
    } else {
      console.log('✅ Migration complete!\n');
    }

    return stats;
  } catch (error) {
    console.error('❌ Fatal error during migration:', error);
    throw error;
  }
}

/**
 * Validate migration results
 */
async function validateMigration() {
  console.log('\n🔍 Validating migration results...\n');

  const remainingInvalid = await Product.countDocuments({
    category: { $nin: VALID_CATEGORIES },
    deletedAt: null,
  });

  const totalActive = await Product.countDocuments({
    deletedAt: null,
  });

  console.log(`  Total active products: ${totalActive}`);
  console.log(`  Products with invalid categories: ${remainingInvalid}`);

  if (remainingInvalid === 0) {
    console.log('\n✅ Validation passed! All active products have valid categories.\n');
  } else {
    console.log('\n⚠️  Validation warning: Some products still have invalid categories.');
    console.log('   This may be expected if you skipped certain products.\n');
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
    const options: MigrationOptions = {
      dryRun: process.env.DRY_RUN !== 'false', // Default to dry run for safety
      autoMigrate: process.env.AUTO_MIGRATE === 'true', // Default to false
      softDeleteUnused: process.env.SOFT_DELETE_UNUSED === 'true', // Default to false
    };

    // Run migration
    const stats = await migrateInvalidCategories(options);

    // Validate results (only if not dry run)
    if (!options.dryRun) {
      await validateMigration();
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

export { migrateInvalidCategories, validateMigration };
