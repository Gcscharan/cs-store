/**
 * Unit tests for review validation functions
 * 
 * These tests verify that the validation functions correctly validate
 * rating ranges, required fields, and other review data constraints.
 */

import {
  validateRating,
  validateRequiredFields,
  validateComment,
  validateImages,
  validateCreateReviewRequest,
  validateUpdateReviewRequest,
  isValidRating,
  toValidRating,
  sanitizeComment,
  sanitizeImages
} from '../utils/reviewValidation';
import { CreateReviewRequest, UpdateReviewRequest } from '../types/reviews';

describe('Review Validation Functions', () => {
  describe('validateRating', () => {
    it('should accept valid ratings (1-5)', () => {
      for (let rating = 1; rating <= 5; rating++) {
        const result = validateRating(rating);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should reject ratings outside 1-5 range', () => {
      const invalidRatings = [0, 6, -1, 10];
      
      invalidRatings.forEach(rating => {
        const result = validateRating(rating);
        expect(result.isValid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('rating');
        expect(result.errors[0].message).toContain('between 1 and 5');
      });
    });

    it('should reject non-integer ratings', () => {
      const nonIntegerRatings = [1.5, 2.7, 3.14];
      
      nonIntegerRatings.forEach(rating => {
        const result = validateRating(rating);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain('integer');
      });
    });

    it('should reject null and undefined ratings', () => {
      const result1 = validateRating(null);
      expect(result1.isValid).toBe(false);
      expect(result1.errors[0].message).toContain('required');

      const result2 = validateRating(undefined);
      expect(result2.isValid).toBe(false);
      expect(result2.errors[0].message).toContain('required');
    });

    it('should reject non-number ratings', () => {
      const nonNumbers = ['5', true, {}, []];
      
      nonNumbers.forEach(rating => {
        const result = validateRating(rating);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain('number');
      });
    });
  });

  describe('validateRequiredFields', () => {
    it('should accept valid review data with required rating', () => {
      const validData: CreateReviewRequest = {
        rating: 4,
        comment: 'Great product!',
        images: ['https://example.com/image.jpg']
      };

      const result = validateRequiredFields(validData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject review data without rating', () => {
      const invalidData = {
        comment: 'Great product!'
      } as CreateReviewRequest;

      const result = validateRequiredFields(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'rating')).toBe(true);
    });
  });

  describe('validateComment', () => {
    it('should accept valid comments', () => {
      const validComments = [
        'Great product!',
        'This is a longer comment with more details about the product.',
        undefined // Optional field
      ];

      validComments.forEach(comment => {
        const result = validateComment(comment);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject comments that are too long', () => {
      const longComment = 'a'.repeat(1001); // Exceeds default 1000 char limit
      
      const result = validateComment(longComment);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('cannot exceed');
    });

    it('should reject non-string comments', () => {
      const nonStringComments = [123, true, {}, []];
      
      nonStringComments.forEach(comment => {
        const result = validateComment(comment as any);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain('string');
      });
    });
  });

  describe('validateImages', () => {
    it('should accept valid image arrays', () => {
      const validImageArrays = [
        ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
        ['https://example.com/image.png'],
        undefined // Optional field
      ];

      validImageArrays.forEach(images => {
        const result = validateImages(images);
        expect(result.isValid).toBe(true);
      });
    });

    it('should reject too many images', () => {
      const tooManyImages = Array(11).fill('https://example.com/image.jpg');
      
      const result = validateImages(tooManyImages);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('Cannot exceed');
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = ['not-a-url', 'ftp://invalid.com', ''];
      
      const result = validateImages(invalidUrls);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.message.includes('Invalid image URL'))).toBe(true);
    });

    it('should reject non-array input', () => {
      const nonArrays = ['string', 123, {}, true];
      
      nonArrays.forEach(images => {
        const result = validateImages(images as any);
        expect(result.isValid).toBe(false);
        expect(result.errors[0].message).toContain('array');
      });
    });
  });

  describe('validateCreateReviewRequest', () => {
    it('should accept valid create review request', () => {
      const validRequest: CreateReviewRequest = {
        rating: 5,
        comment: 'Excellent product!',
        images: ['https://example.com/image.jpg']
      };

      const result = validateCreateReviewRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept minimal valid request (rating only)', () => {
      const minimalRequest: CreateReviewRequest = {
        rating: 3
      };

      const result = validateCreateReviewRequest(minimalRequest);
      expect(result.isValid).toBe(true);
    });

    it('should reject request with invalid rating', () => {
      const invalidRequest: CreateReviewRequest = {
        rating: 6, // Invalid rating
        comment: 'Good product'
      };

      const result = validateCreateReviewRequest(invalidRequest);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'rating')).toBe(true);
    });
  });

  describe('validateUpdateReviewRequest', () => {
    it('should accept valid update request', () => {
      const validUpdate: UpdateReviewRequest = {
        rating: 4,
        comment: 'Updated comment'
      };

      const result = validateUpdateReviewRequest(validUpdate);
      expect(result.isValid).toBe(true);
    });

    it('should reject empty update request', () => {
      const emptyUpdate: UpdateReviewRequest = {};

      const result = validateUpdateReviewRequest(emptyUpdate);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].message).toContain('At least one field');
    });

    it('should accept partial updates', () => {
      const partialUpdates = [
        { rating: 5 },
        { comment: 'New comment' },
        { images: ['https://example.com/new-image.jpg'] }
      ];

      partialUpdates.forEach(update => {
        const result = validateUpdateReviewRequest(update);
        expect(result.isValid).toBe(true);
      });
    });
  });

  describe('utility functions', () => {
    describe('isValidRating', () => {
      it('should correctly identify valid ratings', () => {
        for (let i = 1; i <= 5; i++) {
          expect(isValidRating(i)).toBe(true);
        }
      });

      it('should correctly identify invalid ratings', () => {
        const invalidValues = [0, 6, 1.5, '3', null, undefined, true];
        invalidValues.forEach(value => {
          expect(isValidRating(value)).toBe(false);
        });
      });
    });

    describe('toValidRating', () => {
      it('should convert valid ratings', () => {
        for (let i = 1; i <= 5; i++) {
          expect(toValidRating(i)).toBe(i);
        }
      });

      it('should throw error for invalid ratings', () => {
        expect(() => toValidRating(0)).toThrow();
        expect(() => toValidRating(6)).toThrow();
        expect(() => toValidRating('3')).toThrow();
      });
    });

    describe('sanitizeComment', () => {
      it('should trim whitespace from comments', () => {
        expect(sanitizeComment('  hello  ')).toBe('hello');
        expect(sanitizeComment('\n\ttest\n\t')).toBe('test');
      });

      it('should return undefined for empty or null comments', () => {
        expect(sanitizeComment('')).toBeUndefined();
        expect(sanitizeComment('   ')).toBeUndefined();
        expect(sanitizeComment(undefined)).toBeUndefined();
        expect(sanitizeComment(null as any)).toBeUndefined();
      });
    });

    describe('sanitizeImages', () => {
      it('should filter and trim valid image URLs', () => {
        const input = ['  https://example.com/1.jpg  ', '', 'https://example.com/2.jpg', '   '];
        const result = sanitizeImages(input);
        expect(result).toEqual(['https://example.com/1.jpg', 'https://example.com/2.jpg']);
      });

      it('should return undefined for empty or invalid arrays', () => {
        expect(sanitizeImages([])).toBeUndefined();
        expect(sanitizeImages(['', '   '])).toBeUndefined();
        expect(sanitizeImages(undefined)).toBeUndefined();
      });
    });
  });
});