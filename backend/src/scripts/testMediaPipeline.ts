import { logger } from '../utils/logger';
import { MediaGenerator } from './mediaGenerator';
import { MediaValidator } from './mediaValidator';

/**
 * Test script to validate the media pipeline before running full seed
 */
async function testMediaPipeline() {
  logger.info('🧪 Testing Media Pipeline...\n');

  const generator = new MediaGenerator();
  const validator = new MediaValidator();

  // Test 1: Generate and validate images for a sample product
  logger.info('Test 1: Generate product media');
  try {
    const media = await generator.generateProductMedia({
      productId: 'test-product-1',
      category: 'chocolates',
      index: 0,
      includeVideo: true,
    });

    logger.info('✅ Media generated:', {
      imageCount: media.images.length,
      hasVideo: !!media.video,
      images: media.images,
      video: media.video,
    });
  } catch (error: any) {
    logger.error('❌ Test 1 failed:', error.message);
  }

  // Test 2: Validate multiple URLs in batch
  logger.info('\nTest 2: Batch URL validation');
  const testUrls = [
    'https://picsum.photos/seed/test-1/400/400',
    'https://picsum.photos/seed/test-2/400/400',
    'https://picsum.photos/seed/test-3/400/400',
    'https://invalid-url-that-will-fail.com/image.jpg',
  ];

  try {
    const results = await validator.validateBatch(testUrls);
    
    logger.info('✅ Validation results:');
    results.forEach((result) => {
      const status = result.isValid ? '✅' : '❌';
      logger.info(`  ${status} ${result.url}`, {
        statusCode: result.statusCode,
        error: result.error,
        retries: result.retries,
      });
    });

    const stats = validator.logStats(results);
    logger.info('\n📊 Validation stats:', stats);
  } catch (error: any) {
    logger.error('❌ Test 2 failed:', error.message);
  }

  // Test 3: Test fallback mechanism
  logger.info('\nTest 3: Fallback mechanism');
  try {
    const media = await generator.generateProductMedia({
      productId: 'test-product-fallback',
      category: 'test',
      index: 999,
      includeVideo: false,
    });

    logger.info('✅ Fallback test passed:', {
      imageCount: media.images.length,
      images: media.images,
    });
  } catch (error: any) {
    logger.error('❌ Test 3 failed:', error.message);
  }

  // Test 4: Performance test - generate 10 products
  logger.info('\nTest 4: Performance test (10 products)');
  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  try {
    for (let i = 0; i < 10; i++) {
      try {
        await generator.generateProductMedia({
          productId: `perf-test-${i}`,
          category: 'snacks',
          index: i,
          includeVideo: i < 5,
        });
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const rate = (10 / parseFloat(duration)).toFixed(1);

    logger.info('✅ Performance test completed:', {
      total: 10,
      success: successCount,
      failed: failCount,
      duration: `${duration}s`,
      productsPerSecond: rate,
    });
  } catch (error: any) {
    logger.error('❌ Test 4 failed:', error.message);
  }

  logger.info('\n🎯 Media pipeline testing complete!');
}

// Run tests
testMediaPipeline()
  .then(() => {
    logger.info('\n✅ All tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('\n❌ Testing failed:', error);
    process.exit(1);
  });
