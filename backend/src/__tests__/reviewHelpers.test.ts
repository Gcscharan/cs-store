/**
 * Unit tests for review helper utilities
 * 
 * These tests verify pagination, rating statistics calculation,
 * data transformation, and other utility functions.
 */

import {
  createPaginationOptions,
  createPaginationMeta,
  parsePaginationParams,
  calculateRatingStats,
  calculateRatingStatsFromValues,
  transformReviewForResponse,
  createReviewUser,
  createSortOptions,
  normalizeQueryOptions,
  sanitizeProductId,
  sanitizeUserId,
  formatDateForResponse
} from '../utils/reviewHelpers';
import { Review, ReviewUser, ReviewQueryOptions } from '../types/reviews';
import { ObjectId } from 'mongodb';

describe('Review Helper Utilities', () => {
  describe('Pagination Utilities', () => {
    describe('createPaginationOptions', () => {
      it('should create valid pagination options with defaults', () => {
        const options = createPaginationOptions();
        expect(options.page).toBe(1);
        expect(options.limit).toBe(10);
        expect(options.offset).toBe(0);
      });

      it('should create pagination options with custom values', () => {
        const options = createPaginationOptions(3, 20);
        expect(options.page).toBe(3);
        expect(options.limit).toBe(20);
        expect(options.offset).toBe(40); // (3-1) * 20
      });

      it('should enforce minimum page of 1', () => {
        const options = createPaginationOptions(0, 10);
        expect(options.page).toBe(1);
        expect(options.offset).toBe(0);
      });

      it('should enforce maximum limit of 100', () => {
        const options = createPaginationOptions(1, 150);
        expect(options.limit).toBe(100);
      });

      it('should enforce minimum limit of 1', () => {
        const options = createPaginationOptions(1, 0);
        expect(options.limit).toBe(1);
      });
    });

    describe('createPaginationMeta', () => {
      it('should create correct pagination metadata', () => {
        const options = createPaginationOptions(2, 10);
        const meta = createPaginationMeta(25, options);

        expect(meta.currentPage).toBe(2);
        expect(meta.totalPages).toBe(3); // Math.ceil(25/10)
        expect(meta.totalItems).toBe(25);
        expect(meta.itemsPerPage).toBe(10);
        expect(meta.hasNextPage).toBe(true);
        expect(meta.hasPreviousPage).toBe(true);
      });

      it('should handle first page correctly', () => {
        const options = createPaginationOptions(1, 10);
        const meta = createPaginationMeta(25, options);

        expect(meta.hasPreviousPage).toBe(false);
        expect(meta.hasNextPage).toBe(true);
      });

      it('should handle last page correctly', () => {
        const options = createPaginationOptions(3, 10);
        const meta = createPaginationMeta(25, options);

        expect(meta.hasPreviousPage).toBe(true);
        expect(meta.hasNextPage).toBe(false);
      });

      it('should handle empty results', () => {
        const options = createPaginationOptions(1, 10);
        const meta = createPaginationMeta(0, options);

        expect(meta.totalPages).toBe(0);
        expect(meta.hasNextPage).toBe(false);
        expect(meta.hasPreviousPage).toBe(false);
      });
    });

    describe('parsePaginationParams', () => {
      it('should parse valid string parameters', () => {
        const options = parsePaginationParams('2', '20');
        expect(options.page).toBe(2);
        expect(options.limit).toBe(20);
      });

      it('should use defaults for invalid parameters', () => {
        const options = parsePaginationParams('invalid', 'also-invalid');
        expect(options.page).toBe(1);
        expect(options.limit).toBe(10);
      });

      it('should use defaults for undefined parameters', () => {
        const options = parsePaginationParams();
        expect(options.page).toBe(1);
        expect(options.limit).toBe(10);
      });
    });
  });

  describe('Rating Statistics Utilities', () => {
    const mockReviews: Review[] = [
      {
        _id: new ObjectId(),
        productId: 'prod1',
        userId: 'user1',
        rating: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        productId: 'prod1',
        userId: 'user2',
        rating: 4,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        productId: 'prod1',
        userId: 'user3',
        rating: 5,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        productId: 'prod1',
        userId: 'user4',
        rating: 3,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    describe('calculateRatingStats', () => {
      it('should calculate correct rating statistics', () => {
        const stats = calculateRatingStats(mockReviews);

        expect(stats.totalReviews).toBe(4);
        expect(stats.averageRating).toBe(4.3); // (5+4+5+3)/4 = 4.25, rounded to 4.3
        expect(stats.ratingBreakdown[5]).toBe(2);
        expect(stats.ratingBreakdown[4]).toBe(1);
        expect(stats.ratingBreakdown[3]).toBe(1);
        expect(stats.ratingBreakdown[2]).toBe(0);
        expect(stats.ratingBreakdown[1]).toBe(0);
      });

      it('should handle empty reviews array', () => {
        const stats = calculateRatingStats([]);

        expect(stats.totalReviews).toBe(0);
        expect(stats.averageRating).toBe(0);
        expect(stats.ratingBreakdown[1]).toBe(0);
        expect(stats.ratingBreakdown[2]).toBe(0);
        expect(stats.ratingBreakdown[3]).toBe(0);
        expect(stats.ratingBreakdown[4]).toBe(0);
        expect(stats.ratingBreakdown[5]).toBe(0);
      });
    });

    describe('calculateRatingStatsFromValues', () => {
      it('should calculate stats from rating values', () => {
        const ratings = [5, 4, 5, 3];
        const stats = calculateRatingStatsFromValues(ratings);

        expect(stats.totalReviews).toBe(4);
        expect(stats.averageRating).toBe(4.3);
        expect(stats.ratingBreakdown[5]).toBe(2);
        expect(stats.ratingBreakdown[4]).toBe(1);
        expect(stats.ratingBreakdown[3]).toBe(1);
      });

      it('should filter out invalid ratings', () => {
        const ratings = [5, 4, 0, 6, 3]; // 0 and 6 are invalid
        const stats = calculateRatingStatsFromValues(ratings);

        expect(stats.totalReviews).toBe(5); // Still counts all provided ratings
        expect(stats.ratingBreakdown[5]).toBe(1);
        expect(stats.ratingBreakdown[4]).toBe(1);
        expect(stats.ratingBreakdown[3]).toBe(1);
      });
    });
  });

  describe('Data Transformation Utilities', () => {
    const mockReview: Review = {
      _id: new ObjectId('507f1f77bcf86cd799439011'),
      productId: 'prod1',
      userId: 'user1',
      rating: 5,
      comment: 'Great product!',
      images: ['https://example.com/image.jpg'],
      createdAt: new Date('2023-01-01T10:00:00Z'),
      updatedAt: new Date('2023-01-01T10:00:00Z')
    };

    const mockUser: ReviewUser = {
      _id: 'user1',
      name: 'John Doe'
    };

    describe('transformReviewForResponse', () => {
      it('should transform review to API response format', () => {
        const transformed = transformReviewForResponse(mockReview, mockUser);

        expect(transformed._id).toBe('507f1f77bcf86cd799439011');
        expect(transformed.productId).toBe('prod1');
        expect(transformed.userId).toBe('user1');
        expect(transformed.rating).toBe(5);
        expect(transformed.comment).toBe('Great product!');
        expect(transformed.images).toEqual(['https://example.com/image.jpg']);
        expect(transformed.createdAt).toBe('2023-01-01T10:00:00.000Z');
        expect(transformed.updatedAt).toBe('2023-01-01T10:00:00.000Z');
        expect(transformed.user._id).toBe('user1');
        expect(transformed.user.name).toBe('John Doe');
      });
    });

    describe('createReviewUser', () => {
      it('should create review user object', () => {
        const user = createReviewUser('user123', 'Jane Smith');
        expect(user._id).toBe('user123');
        expect(user.name).toBe('Jane Smith');
      });
    });
  });

  describe('Query Building Utilities', () => {
    describe('createSortOptions', () => {
      it('should create default sort options', () => {
        const options: ReviewQueryOptions = { page: 1, limit: 10 };
        const sort = createSortOptions(options);
        expect(sort).toEqual({ createdAt: -1 });
      });

      it('should create custom sort options', () => {
        const options: ReviewQueryOptions = {
          page: 1,
          limit: 10,
          sortBy: 'rating',
          sortOrder: 'asc'
        };
        const sort = createSortOptions(options);
        expect(sort).toEqual({ rating: 1 });
      });
    });

    describe('normalizeQueryOptions', () => {
      it('should normalize query options with defaults', () => {
        const normalized = normalizeQueryOptions();
        expect(normalized.page).toBe(1);
        expect(normalized.limit).toBe(10);
        expect(normalized.sortBy).toBe('createdAt');
        expect(normalized.sortOrder).toBe('desc');
      });

      it('should preserve provided options', () => {
        const options = {
          page: 2,
          limit: 20,
          sortBy: 'rating' as const,
          sortOrder: 'asc' as const
        };
        const normalized = normalizeQueryOptions(options);
        expect(normalized.page).toBe(2);
        expect(normalized.limit).toBe(20);
        expect(normalized.sortBy).toBe('rating');
        expect(normalized.sortOrder).toBe('asc');
      });
    });
  });

  describe('Sanitization Utilities', () => {
    describe('sanitizeProductId', () => {
      it('should sanitize valid product IDs', () => {
        expect(sanitizeProductId('  prod123  ')).toBe('prod123');
        expect(sanitizeProductId('product-456')).toBe('product-456');
      });

      it('should throw error for invalid product IDs', () => {
        expect(() => sanitizeProductId('')).toThrow('non-empty string');
        expect(() => sanitizeProductId('   ')).toThrow('non-empty string');
        expect(() => sanitizeProductId(123)).toThrow('non-empty string');
        expect(() => sanitizeProductId(null)).toThrow('non-empty string');
      });
    });

    describe('sanitizeUserId', () => {
      it('should sanitize valid user IDs', () => {
        expect(sanitizeUserId('  user123  ')).toBe('user123');
        expect(sanitizeUserId('user-456')).toBe('user-456');
      });

      it('should throw error for invalid user IDs', () => {
        expect(() => sanitizeUserId('')).toThrow('non-empty string');
        expect(() => sanitizeUserId('   ')).toThrow('non-empty string');
        expect(() => sanitizeUserId(123)).toThrow('non-empty string');
        expect(() => sanitizeUserId(undefined)).toThrow('non-empty string');
      });
    });
  });

  describe('Date Utilities', () => {
    describe('formatDateForResponse', () => {
      it('should format date as ISO 8601 string', () => {
        const date = new Date('2023-01-01T10:00:00Z');
        const formatted = formatDateForResponse(date);
        expect(formatted).toBe('2023-01-01T10:00:00.000Z');
      });
    });
  });
});