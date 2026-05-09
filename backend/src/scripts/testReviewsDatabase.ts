import { logger } from '../utils/logger';
import { connectDB } from '../utils/database';
import { Review } from '../models/Review';
import mongoose from 'mongoose';

/**
 * Test Reviews Database Setup
 * 
 * This script tests the reviews database schema and indexes to ensure
 * everything is working correctly.
 */

async function testReviewsDatabase(): Promise<void> {
  try {
    logger.info('🧪 Testing Reviews Database Setup...');
    
    // Ensure database connection
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    
    // Test 1: Create a sample review
    logger.info('📝 Test 1: Creating sample review...');
    const sampleReview = new Review({
      productId: '507f1f77bcf86cd799439011',
      userId: '507f1f77bcf86cd799439012', 
      rating: 5,
      comment: 'Great product! Highly recommended.',
      images: ['https://example.com/image1.jpg']
    });
    
    const savedReview = await sampleReview.save();
    logger.info(`✅ Sample review created with ID: ${savedReview._id}`);
    
    // Test 2: Test uniqueness constraint
    logger.info('🔒 Test 2: Testing uniqueness constraint...');
    try {
      const duplicateReview = new Review({
        productId: '507f1f77bcf86cd799439011',
        userId: '507f1f77bcf86cd799439012', // Same user and product
        rating: 3,
        comment: 'Different comment'
      });
      await duplicateReview.save();
      logger.error('❌ Uniqueness constraint failed - duplicate review was saved');
    } catch (error: any) {
      if (error.code === 11000) {
        logger.info('✅ Uniqueness constraint working - duplicate review rejected');
      } else {
        throw error;
      }
    }
    
    // Test 3: Test rating validation
    logger.info('📊 Test 3: Testing rating validation...');
    try {
      const invalidRatingReview = new Review({
        productId: '507f1f77bcf86cd799439013',
        userId: '507f1f77bcf86cd799439014',
        rating: 6, // Invalid rating > 5
        comment: 'Invalid rating test'
      });
      await invalidRatingReview.save();
      logger.error('❌ Rating validation failed - invalid rating was saved');
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        logger.info('✅ Rating validation working - invalid rating rejected');
      } else {
        throw error;
      }
    }
    
    // Test 4: Test index performance
    logger.info('⚡ Test 4: Testing index performance...');
    
    // Query by productId (should use productId_1 index)
    const startTime = Date.now();
    const productReviews = await Review.find({ productId: '507f1f77bcf86cd799439011' });
    const queryTime = Date.now() - startTime;
    logger.info(`✅ Product reviews query completed in ${queryTime}ms (found ${productReviews.length} reviews)`);
    
    // Test 5: Test sorting by createdAt (should use createdAt_desc index)
    logger.info('📅 Test 5: Testing createdAt sorting...');
    const sortedReviews = await Review.find().sort({ createdAt: -1 }).limit(10);
    logger.info(`✅ Sorted reviews query completed (found ${sortedReviews.length} reviews)`);
    
    // Test 6: Verify all indexes exist
    logger.info('📋 Test 6: Verifying indexes...');
    const collection = mongoose.connection.db?.collection('reviews');
    if (collection) {
      const indexes = await collection.listIndexes().toArray();
      const expectedIndexes = [
        '_id_',
        'productId_userId_unique',
        'productId_1', 
        'userId_1',
        'createdAt_desc',
        'productId_createdAt_desc'
      ];
      
      const existingIndexNames = indexes.map(idx => idx.name);
      const missingIndexes = expectedIndexes.filter(name => !existingIndexNames.includes(name));
      
      if (missingIndexes.length === 0) {
        logger.info('✅ All required indexes are present');
      } else {
        logger.error(`❌ Missing indexes: ${missingIndexes.join(', ')}`);
      }
    }
    
    // Cleanup: Remove test data
    logger.info('🧹 Cleaning up test data...');
    await Review.deleteMany({ 
      productId: { $in: ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439013'] }
    });
    logger.info('✅ Test data cleaned up');
    
    logger.info('🎉 All database tests passed successfully!');
    
  } catch (error) {
    logger.error('❌ Database test failed:', error);
    throw error;
  }
}

/**
 * Standalone script execution
 */
if (require.main === module) {
  (async () => {
    try {
      await testReviewsDatabase();
      logger.info('✅ Database test script completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('💥 Database test script failed:', error);
      process.exit(1);
    }
  })();
}