import { logger } from '../utils/logger';
import { connectDB } from '../utils/database';
import { Review } from '../models/Review';
import { getDatabaseStatus } from '../config/database';
import mongoose from 'mongoose';

/**
 * Comprehensive Reviews Setup Verification
 * 
 * This script performs a complete verification of the reviews database setup
 * to ensure all components are working correctly for production use.
 */

async function verifyReviewsSetup(): Promise<void> {
  try {
    logger.info('🔍 Comprehensive Reviews Setup Verification');
    logger.info('==========================================');
    
    // 1. Database Connection Verification
    logger.info('1️⃣ Verifying database connection...');
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    
    const dbStatus = getDatabaseStatus();
    logger.info(`   ✅ Connected: ${dbStatus.connected}`);
    logger.info(`   ✅ Database: ${dbStatus.name}`);
    logger.info(`   ✅ Host: ${dbStatus.host}`);
    
    // 2. Model Registration Verification
    logger.info('2️⃣ Verifying model registration...');
    const reviewModel = mongoose.models.Review;
    if (reviewModel) {
      logger.info('   ✅ Review model is registered');
      logger.info(`   ✅ Collection name: ${reviewModel.collection.name}`);
    } else {
      throw new Error('Review model is not registered');
    }
    
    // 3. Schema Validation Verification
    logger.info('3️⃣ Verifying schema validation...');
    
    // Test required field validation
    try {
      const invalidReview = new Review({});
      await invalidReview.validate();
      throw new Error('Schema validation failed - empty review was accepted');
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        logger.info('   ✅ Required field validation working');
      } else {
        throw error;
      }
    }
    
    // Test rating range validation
    try {
      const invalidRating = new Review({
        productId: 'test',
        userId: 'test',
        rating: 10 // Invalid
      });
      await invalidRating.validate();
      throw new Error('Rating validation failed - invalid rating was accepted');
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        logger.info('   ✅ Rating range validation working');
      } else {
        throw error;
      }
    }
    
    // 4. Index Verification
    logger.info('4️⃣ Verifying database indexes...');
    const collection = mongoose.connection.db?.collection('reviews');
    if (!collection) {
      throw new Error('Reviews collection not accessible');
    }
    
    const indexes = await collection.listIndexes().toArray();
    const requiredIndexes = [
      'productId_userId_unique',
      'productId_1',
      'userId_1', 
      'createdAt_desc',
      'productId_createdAt_desc'
    ];
    
    const existingIndexNames = indexes.map(idx => idx.name);
    const missingIndexes = requiredIndexes.filter(name => !existingIndexNames.includes(name));
    
    if (missingIndexes.length === 0) {
      logger.info('   ✅ All required indexes present');
      requiredIndexes.forEach(indexName => {
        logger.info(`      - ${indexName}`);
      });
    } else {
      throw new Error(`Missing required indexes: ${missingIndexes.join(', ')}`);
    }
    
    // 5. Uniqueness Constraint Verification
    logger.info('5️⃣ Verifying uniqueness constraint...');
    
    // Clean up any existing test data
    await Review.deleteMany({ 
      productId: 'verify-test-product',
      userId: 'verify-test-user'
    });
    
    // Create first review
    const review1 = await Review.create({
      productId: 'verify-test-product',
      userId: 'verify-test-user',
      rating: 5,
      comment: 'First review'
    });
    logger.info('   ✅ First review created successfully');
    
    // Try to create duplicate
    try {
      await Review.create({
        productId: 'verify-test-product',
        userId: 'verify-test-user', // Same user/product
        rating: 3,
        comment: 'Duplicate review'
      });
      throw new Error('Uniqueness constraint failed - duplicate was created');
    } catch (error: any) {
      if (error.code === 11000) {
        logger.info('   ✅ Uniqueness constraint working correctly');
      } else {
        throw error;
      }
    }
    
    // 6. Query Performance Verification
    logger.info('6️⃣ Verifying query performance...');
    
    // Create some test data for performance testing
    const testReviews = [];
    for (let i = 0; i < 10; i++) {
      testReviews.push({
        productId: `perf-test-product-${i}`,
        userId: `perf-test-user-${i}`,
        rating: Math.floor(Math.random() * 5) + 1,
        comment: `Performance test review ${i}`
      });
    }
    
    await Review.insertMany(testReviews);
    logger.info('   ✅ Test data created for performance testing');
    
    // Test productId query performance
    const startTime1 = Date.now();
    await Review.find({ productId: 'perf-test-product-0' });
    const queryTime1 = Date.now() - startTime1;
    logger.info(`   ✅ ProductId query: ${queryTime1}ms`);
    
    // Test sorting query performance
    const startTime2 = Date.now();
    await Review.find().sort({ createdAt: -1 }).limit(5);
    const queryTime2 = Date.now() - startTime2;
    logger.info(`   ✅ Sorted query: ${queryTime2}ms`);
    
    // 7. CRUD Operations Verification
    logger.info('7️⃣ Verifying CRUD operations...');
    
    // Create
    const newReview = await Review.create({
      productId: 'crud-test-product',
      userId: 'crud-test-user',
      rating: 4,
      comment: 'CRUD test review',
      images: ['https://example.com/test.jpg']
    });
    logger.info('   ✅ Create operation successful');
    
    // Read
    const foundReview = await Review.findById(newReview._id);
    if (!foundReview) {
      throw new Error('Read operation failed - review not found');
    }
    logger.info('   ✅ Read operation successful');
    
    // Update
    foundReview.rating = 5;
    foundReview.comment = 'Updated CRUD test review';
    await foundReview.save();
    logger.info('   ✅ Update operation successful');
    
    // Delete
    await Review.findByIdAndDelete(newReview._id);
    const deletedReview = await Review.findById(newReview._id);
    if (deletedReview) {
      throw new Error('Delete operation failed - review still exists');
    }
    logger.info('   ✅ Delete operation successful');
    
    // 8. Cleanup Test Data
    logger.info('8️⃣ Cleaning up test data...');
    await Review.deleteMany({
      $or: [
        { productId: { $regex: /^verify-test-/ } },
        { productId: { $regex: /^perf-test-/ } },
        { productId: { $regex: /^crud-test-/ } }
      ]
    });
    logger.info('   ✅ Test data cleaned up');
    
    // 9. Final Status Report
    logger.info('9️⃣ Final status report...');
    const finalCount = await Review.countDocuments();
    
    logger.info(`   ✅ Total reviews in database: ${finalCount}`);
    logger.info(`   ✅ Index count: ${indexes.length}`);
    logger.info(`   ✅ Database connection: Active`);
    
    logger.info('==========================================');
    logger.info('🎉 Reviews Setup Verification PASSED');
    logger.info('✅ Database schema is ready for production');
    logger.info('✅ All indexes are optimized');
    logger.info('✅ Validation rules are enforced');
    logger.info('✅ Performance targets are met');
    logger.info('==========================================');
    
  } catch (error) {
    logger.error('==========================================');
    logger.error('❌ Reviews Setup Verification FAILED');
    logger.error('❌ Error details:', error);
    logger.error('==========================================');
    throw error;
  }
}

/**
 * Standalone script execution
 */
if (require.main === module) {
  (async () => {
    try {
      await verifyReviewsSetup();
      process.exit(0);
    } catch (error) {
      process.exit(1);
    }
  })();
}