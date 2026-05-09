/**
 * Property-Based Tests: Product Video Support - VideoRegistry Schema Validation
 * 
 * Tests Property 1 from design.md: Video Metadata String Validation
 * Uses fast-check for property-based testing with 100 iterations
 * 
 * Feature: product-video-support
 * Property 1: Video Metadata String Validation
 * Validates: Requirements 1.3, 1.4, 1.5, 1.7
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import { Product } from '../../src/models/Product';

describe('Property-Based Tests: VideoRegistry Schema Validation', () => {
  beforeEach(async () => {
    // Clean up before each test
    await Product.deleteMany({});
  });

  // Feature: product-video-support, Property 1: Video Metadata String Validation
  it('should reject empty or whitespace-only strings for video url', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t'),
          fc.constant('\n'),
          fc.constant('\t\n'),
          fc.constant('  \t  \n  '),
          fc.stringMatching(/^[\s]+$/)
        ),
        async (invalidString) => {
          const product = new Product({
            name: 'Test Product',
            description: 'Test Description',
            category: 'chocolates',
            price: 100,
            stock: 10,
            weight: 1,
            video: {
              url: invalidString,
              thumbnail: 'https://example.com/thumb.jpg',
              publicId: 'valid-public-id',
            },
          });

          await expect(product.save()).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 1: Video Metadata String Validation
  it('should reject empty or whitespace-only strings for video thumbnail', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t'),
          fc.constant('\n'),
          fc.constant('\t\n'),
          fc.constant('  \t  \n  '),
          fc.stringMatching(/^[\s]+$/)
        ),
        async (invalidString) => {
          const product = new Product({
            name: 'Test Product',
            description: 'Test Description',
            category: 'chocolates',
            price: 100,
            stock: 10,
            weight: 1,
            video: {
              url: 'https://example.com/video.mp4',
              thumbnail: invalidString,
              publicId: 'valid-public-id',
            },
          });

          await expect(product.save()).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 1: Video Metadata String Validation
  it('should reject empty or whitespace-only strings for video publicId', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t'),
          fc.constant('\n'),
          fc.constant('\t\n'),
          fc.constant('  \t  \n  '),
          fc.stringMatching(/^[\s]+$/)
        ),
        async (invalidString) => {
          const product = new Product({
            name: 'Test Product',
            description: 'Test Description',
            category: 'chocolates',
            price: 100,
            stock: 10,
            weight: 1,
            video: {
              url: 'https://example.com/video.mp4',
              thumbnail: 'https://example.com/thumb.jpg',
              publicId: invalidString,
            },
          });

          await expect(product.save()).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 1: Video Metadata String Validation
  it('should reject non-positive duration values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(0),
          fc.constant(-1),
          fc.constant(-10),
          fc.constant(-100),
          fc.float({ min: Math.fround(-1000), max: Math.fround(0), noNaN: true })
        ),
        async (invalidDuration) => {
          const product = new Product({
            name: 'Test Product',
            description: 'Test Description',
            category: 'chocolates',
            price: 100,
            stock: 10,
            weight: 1,
            video: {
              url: 'https://example.com/video.mp4',
              thumbnail: 'https://example.com/thumb.jpg',
              publicId: 'valid-public-id',
              duration: invalidDuration,
            },
          });

          await expect(product.save()).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 1: Video Metadata String Validation
  it('should reject empty or whitespace-only strings for video hash when provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t'),
          fc.constant('\n'),
          fc.constant('\t\n'),
          fc.constant('  \t  \n  '),
          fc.stringMatching(/^[\s]+$/)
        ),
        async (invalidString) => {
          const product = new Product({
            name: 'Test Product',
            description: 'Test Description',
            category: 'chocolates',
            price: 100,
            stock: 10,
            weight: 1,
            video: {
              url: 'https://example.com/video.mp4',
              thumbnail: 'https://example.com/thumb.jpg',
              publicId: 'valid-public-id',
              hash: invalidString,
            },
          });

          await expect(product.save()).rejects.toThrow();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 1: Video Metadata String Validation
  it('should accept valid video metadata with all required fields', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          url: fc.webUrl(),
          thumbnail: fc.webUrl(),
          publicId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          duration: fc.float({ min: Math.fround(0.1), max: Math.fround(30), noNaN: true }),
          hash: fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'), { minLength: 64, maxLength: 64 }).map(arr => arr.join('')),
        }),
        async (validVideo) => {
          const product = new Product({
            name: 'Test Product',
            description: 'Test Description',
            category: 'chocolates',
            price: 100,
            stock: 10,
            weight: 1,
            video: validVideo,
          });

          const savedProduct = await product.save();
          expect(savedProduct.video).toBeDefined();
          expect(savedProduct.video?.url).toBe(validVideo.url);
          expect(savedProduct.video?.thumbnail).toBe(validVideo.thumbnail);
          expect(savedProduct.video?.publicId).toBe(validVideo.publicId);
          expect(savedProduct.video?.duration).toBe(validVideo.duration);
          expect(savedProduct.video?.hash).toBe(validVideo.hash);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 1: Video Metadata String Validation
  it('should accept valid video metadata without optional fields (duration and hash)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          url: fc.webUrl(),
          thumbnail: fc.webUrl(),
          publicId: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        }),
        async (validVideo) => {
          const product = new Product({
            name: 'Test Product',
            description: 'Test Description',
            category: 'chocolates',
            price: 100,
            stock: 10,
            weight: 1,
            video: validVideo,
          });

          const savedProduct = await product.save();
          expect(savedProduct.video).toBeDefined();
          expect(savedProduct.video?.url).toBe(validVideo.url);
          expect(savedProduct.video?.thumbnail).toBe(validVideo.thumbnail);
          expect(savedProduct.video?.publicId).toBe(validVideo.publicId);
          expect(savedProduct.video?.duration).toBeUndefined();
          expect(savedProduct.video?.hash).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 1: Video Metadata String Validation
  it('should allow products without video field (backward compatibility)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
          description: fc.string({ minLength: 1, maxLength: 1000 }).filter(s => s.trim().length > 0),
          price: fc.integer({ min: 1, max: 10000 }),
          stock: fc.integer({ min: 0, max: 1000 }),
          weight: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
        }),
        async (productData) => {
          const product = new Product({
            ...productData,
            category: 'chocolates',
          });

          const savedProduct = await product.save();
          expect(savedProduct.video).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 1: Video Metadata String Validation
  it('should validate all string fields simultaneously with various invalid inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          urlValid: fc.boolean(),
          thumbnailValid: fc.boolean(),
          publicIdValid: fc.boolean(),
        }),
        async ({ urlValid, thumbnailValid, publicIdValid }) => {
          const invalidString = fc.sample(
            fc.oneof(
              fc.constant(''),
              fc.constant('   '),
              fc.constant('\t\n')
            ),
            1
          )[0];

          const validUrl = 'https://example.com/video.mp4';
          const validThumbnail = 'https://example.com/thumb.jpg';
          const validPublicId = 'valid-public-id';

          const product = new Product({
            name: 'Test Product',
            description: 'Test Description',
            category: 'chocolates',
            price: 100,
            stock: 10,
            weight: 1,
            video: {
              url: urlValid ? validUrl : invalidString,
              thumbnail: thumbnailValid ? validThumbnail : invalidString,
              publicId: publicIdValid ? validPublicId : invalidString,
            },
          });

          // Should only succeed if all fields are valid
          if (urlValid && thumbnailValid && publicIdValid) {
            const savedProduct = await product.save();
            expect(savedProduct.video).toBeDefined();
          } else {
            await expect(product.save()).rejects.toThrow();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
