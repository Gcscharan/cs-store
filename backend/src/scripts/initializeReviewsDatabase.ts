import { logger } from '../utils/logger';
import { connectDB } from '../utils/database';
import { Review } from '../models/Review';
import mongoose from 'mongoose';

/**
 * Initialize Reviews Database Schema and Indexes
 * 
 * This script sets up the MongoDB collection for the product reviews system
 * with all required indexes for optimal performance.
 * 
 * Indexes created:
 * 1. Compound unique index: { productId: 1, userId: 1 } - Ensures one review per user per product
 * 2. Individual index: { productId: 1 } - Fast product review queries
 * 3. Individual index: { userId: 1 } - Fast user review queries  
 * 4. Descending index: { createdAt: -1 } - Fast sorting by creation date
 * 5. Compound index: { productId: 1, createdAt: -1 } - Optimized product reviews with sorting
 */

export async function initializeReviewsDatabase(): Promise<void> {
  try {
    logger.info('🔧 Initializing Reviews Database Schema and Indexes...');
    
    // Ensure database connection
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    
    // Get the reviews collection
    const collection = mongoose.connection.db?.collection('reviews');
    if (!collection) {
      throw new Error('Failed to access reviews collection');
    }
    
    logger.info('📊 Creating database indexes for reviews collection...');
    
    // Create indexes explicitly to ensure they exist
    // Note: Mongoose will also create these indexes from the schema, but we want to be explicit
    
    // 1. Compound unique index for one review per user per product constraint
    await collection.createIndex(
      { productId: 1, userId: 1 }, 
      { 
        unique: true,
        name: 'productId_userId_unique',
        background: true
      }
    );
    logger.info('✅ Created unique compound index: productId_userId_unique');
    
    // 2. Individual index on productId for fast product review queries
    await collection.createIndex(
      { productId: 1 },
      {
        name: 'productId_1',
        background: true
      }
    );
    logger.info('✅ Created index: productId_1');
    
    // 3. Individual index on userId for fast user review queries
    await collection.createIndex(
      { userId: 1 },
      {
        name: 'userId_1', 
        background: true
      }
    );
    logger.info('✅ Created index: userId_1');
    
    // 4. Descending index on createdAt for sorting (newest first)
    await collection.createIndex(
      { createdAt: -1 },
      {
        name: 'createdAt_desc',
        background: true
      }
    );
    logger.info('✅ Created index: createdAt_desc');
    
    // 5. Compound index for efficient product review queries with sorting
    await collection.createIndex(
      { productId: 1, createdAt: -1 },
      {
        name: 'productId_createdAt_desc',
        background: true
      }
    );
    logger.info('✅ Created compound index: productId_createdAt_desc');
    
    // Verify all indexes were created
    const indexes = await collection.listIndexes().toArray();
    logger.info('📋 Current indexes on reviews collection:');
    indexes.forEach(index => {
      logger.info(`   - ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
    // Test the Review model to ensure schema is properly loaded
    const reviewCount = await Review.countDocuments();
    logger.info(`📊 Current review count: ${reviewCount}`);
    
    logger.info('✅ Reviews database initialization completed successfully');
    
  } catch (error) {
    logger.error('❌ Failed to initialize reviews database:', error);
    throw error;
  }
}

/**
 * Standalone script execution
 * Run with: npm run ts-node src/scripts/initializeReviewsDatabase.ts
 */
if (require.main === module) {
  (async () => {
    try {
      await initializeReviewsDatabase();
      logger.info('🎉 Database initialization script completed');
      process.exit(0);
    } catch (error) {
      logger.error('💥 Database initialization script failed:', error);
      process.exit(1);
    }
  })();
}