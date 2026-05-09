/**
 * Product Analysis Script - Pre-Cleanup Analysis
 * 
 * Analyzes products with invalid categories to understand:
 * - Which products would be affected
 * - Which are used in orders (cannot be deleted)
 * - Which are in active carts
 * - Migration vs deletion recommendations
 * 
 * SAFETY: Read-only analysis, makes NO changes
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

interface ProductAnalysis {
  _id: mongoose.Types.ObjectId;
  name: string;
  category: string;
  price: number;
  stock: number;
  isActive: boolean;
  isSellable: boolean;
  usedInOrders: boolean;
  inActiveCarts: boolean;
  orderCount: number;
  cartCount: number;
  recommendation: 'MIGRATE' | 'SAFE_TO_DELETE' | 'REVIEW_REQUIRED';
  reason: string;
}

/**
 * Analyze a single product
 */
async function analyzeProduct(product: any): Promise<ProductAnalysis> {
  // Check order usage
  const orderCount = await Order.countDocuments({
    'items.productId': product._id,
  });

  // Check cart usage
  const cartCount = await Cart.countDocuments({
    'items.productId': product._id,
  });

  const usedInOrders = orderCount > 0;
  const inActiveCarts = cartCount > 0;

  // Determine recommendation
  let recommendation: ProductAnalysis['recommendation'];
  let reason: string;

  if (usedInOrders) {
    recommendation = 'MIGRATE';
    reason = `Used in ${orderCount} order(s) - MUST migrate to preserve order history`;
  } else if (inActiveCarts) {
    recommendation = 'REVIEW_REQUIRED';
    reason = `In ${cartCount} active cart(s) - Consider migrating or clearing carts first`;
  } else if (product.stock > 0 && product.isSellable) {
    recommendation = 'MIGRATE';
    reason = `Has stock (${product.stock}) and is sellable - Consider migrating to preserve inventory`;
  } else {
    recommendation = 'SAFE_TO_DELETE';
    reason = 'Not used in orders, carts, and has no sellable stock';
  }

  return {
    _id: product._id,
    name: product.name,
    category: product.category,
    price: product.price,
    stock: product.stock,
    isActive: product.isActive,
    isSellable: product.isSellable,
    usedInOrders,
    inActiveCarts,
    orderCount,
    cartCount,
    recommendation,
    reason,
  };
}

/**
 * Main analysis function
 */
async function analyzeInvalidProducts() {
  console.log('\n🔍 Product Category Analysis\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Find all products with invalid categories
    const invalidProducts = await Product.find({
      category: { $nin: VALID_CATEGORIES },
      deletedAt: null, // Only active products
    }).lean();

    console.log(`📊 Found ${invalidProducts.length} products with invalid categories\n`);

    if (invalidProducts.length === 0) {
      console.log('✅ No products with invalid categories found!\n');
      return;
    }

    // Group by category
    const categoryGroups: Record<string, number> = {};
    invalidProducts.forEach(p => {
      categoryGroups[p.category] = (categoryGroups[p.category] || 0) + 1;
    });

    console.log('Invalid categories breakdown:');
    Object.entries(categoryGroups)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, count]) => {
        console.log(`  - ${cat}: ${count} products`);
      });
    console.log('\n' + '='.repeat(80) + '\n');

    // Analyze each product
    const analyses: ProductAnalysis[] = [];
    
    console.log('Analyzing products...\n');
    for (const product of invalidProducts) {
      const analysis = await analyzeProduct(product);
      analyses.push(analysis);
    }

    // Summary statistics
    const stats = {
      total: analyses.length,
      mustMigrate: analyses.filter(a => a.recommendation === 'MIGRATE').length,
      safeToDelete: analyses.filter(a => a.recommendation === 'SAFE_TO_DELETE').length,
      reviewRequired: analyses.filter(a => a.recommendation === 'REVIEW_REQUIRED').length,
      usedInOrders: analyses.filter(a => a.usedInOrders).length,
      inCarts: analyses.filter(a => a.inActiveCarts).length,
      hasStock: analyses.filter(a => a.stock > 0).length,
    };

    console.log('📊 Analysis Summary:\n');
    console.log(`  Total products analyzed: ${stats.total}`);
    console.log(`  ✅ Must migrate (used in orders): ${stats.mustMigrate}`);
    console.log(`  🗑️  Safe to delete: ${stats.safeToDelete}`);
    console.log(`  ⚠️  Review required: ${stats.reviewRequired}`);
    console.log('');
    console.log(`  Products used in orders: ${stats.usedInOrders}`);
    console.log(`  Products in active carts: ${stats.inCarts}`);
    console.log(`  Products with stock: ${stats.hasStock}`);
    console.log('\n' + '='.repeat(80) + '\n');

    // Detailed breakdown by recommendation
    console.log('📋 Detailed Breakdown:\n');

    if (stats.mustMigrate > 0) {
      console.log(`\n🔄 MUST MIGRATE (${stats.mustMigrate} products):`);
      console.log('   These products are used in orders and CANNOT be deleted\n');
      analyses
        .filter(a => a.recommendation === 'MIGRATE')
        .slice(0, 10) // Show first 10
        .forEach(a => {
          console.log(`   - "${a.name}"`);
          console.log(`     Category: ${a.category}`);
          console.log(`     Orders: ${a.orderCount}, Carts: ${a.cartCount}, Stock: ${a.stock}`);
          console.log(`     Reason: ${a.reason}\n`);
        });
      if (stats.mustMigrate > 10) {
        console.log(`   ... and ${stats.mustMigrate - 10} more\n`);
      }
    }

    if (stats.reviewRequired > 0) {
      console.log(`\n⚠️  REVIEW REQUIRED (${stats.reviewRequired} products):`);
      console.log('   These products need manual review\n');
      analyses
        .filter(a => a.recommendation === 'REVIEW_REQUIRED')
        .slice(0, 10)
        .forEach(a => {
          console.log(`   - "${a.name}"`);
          console.log(`     Category: ${a.category}`);
          console.log(`     Orders: ${a.orderCount}, Carts: ${a.cartCount}, Stock: ${a.stock}`);
          console.log(`     Reason: ${a.reason}\n`);
        });
      if (stats.reviewRequired > 10) {
        console.log(`   ... and ${stats.reviewRequired - 10} more\n`);
      }
    }

    if (stats.safeToDelete > 0) {
      console.log(`\n🗑️  SAFE TO DELETE (${stats.safeToDelete} products):`);
      console.log('   These products can be safely soft-deleted\n');
      analyses
        .filter(a => a.recommendation === 'SAFE_TO_DELETE')
        .slice(0, 10)
        .forEach(a => {
          console.log(`   - "${a.name}"`);
          console.log(`     Category: ${a.category}`);
          console.log(`     Stock: ${a.stock}, Active: ${a.isActive}, Sellable: ${a.isSellable}\n`);
        });
      if (stats.safeToDelete > 10) {
        console.log(`   ... and ${stats.safeToDelete - 10} more\n`);
      }
    }

    console.log('='.repeat(80) + '\n');
    console.log('💡 Recommendations:\n');
    
    if (stats.mustMigrate > 0) {
      console.log(`   1. Run migration script to migrate ${stats.mustMigrate} products:`);
      console.log('      DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories\n');
    }
    
    if (stats.reviewRequired > 0) {
      console.log(`   2. Review ${stats.reviewRequired} products in carts manually`);
      console.log('      Consider clearing carts or migrating these products\n');
    }
    
    if (stats.safeToDelete > 0) {
      console.log(`   3. Optionally soft-delete ${stats.safeToDelete} unused products:`);
      console.log('      DRY_RUN=false npm run cleanup:products\n');
    }

    console.log('   4. After cleanup, validate results:');
    console.log('      npm run validate:categories\n');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    throw error;
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

    // Run analysis
    await analyzeInvalidProducts();

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

export { analyzeInvalidProducts };
