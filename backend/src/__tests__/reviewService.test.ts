/**
 * ReviewService Unit Tests
 * 
 * Tests for the core review service functionality including
 * CRUD operations, validation, and business logic.
 */

import { ReviewService } from '../services/reviewService';
import { Review } from '../models/Review';
import { User } from '../models/User';
import { CreateReviewRequest, UpdateReviewRequest } from '../types/reviews';

// Mock the models
jest.mock('../models/Review');
jest.mock('../models/User');

const MockedReview = Review as jest.Mocked<typeof Review>;
const MockedUser = User as jest.Mocked<typeof User>;

describe('ReviewService', () => {
  let reviewService: ReviewService;

  beforeEach(() => {
    reviewService = new ReviewService();
    jest.clearAllMocks();
  });

  describe('createReview', () => {
    it('should create a new review successfully', async () => {
      const productId = 'product123';
      const userId = 'user123';
      const reviewData: CreateReviewRequest = {
        rating: 5,
        comment: 'Great product!',
        images: ['https://example.com/image1.jpg']
      };

      const mockSavedReview = {
        _id: 'review123',
        productId,
        userId,
        rating: 5,
        comment: 'Great product!',
        images: ['https://example.com/image1.jpg'],
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue({
          _id: 'review123',
          productId,
          userId,
          rating: 5,
          comment: 'Great product!',
          images: ['https://example.com/image1.jpg'],
          createdAt: new Date(),
          updatedAt: new Date()
        })
      };

      const mockUser = {
        _id: userId,
        name: 'Test User'
      };

      MockedReview.findOne = jest.fn().mockResolvedValue(null);
      MockedReview.prototype.save = jest.fn().mockResolvedValue(mockSavedReview);
      MockedUser.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUser)
        })
      });

      // Mock the constructor
      (MockedReview as any).mockImplementation(() => mockSavedReview);

      const result = await reviewService.createReview(productId, userId, reviewData);

      expect(MockedReview.findOne).toHaveBeenCalledWith({ productId, userId });
      expect(result).toMatchObject({
        productId,
        userId,
        rating: 5,
        comment: 'Great product!',
        user: {
          _id: userId,
          name: 'Test User'
        }
      });
    });

    it('should throw error for duplicate review', async () => {
      const productId = 'product123';
      const userId = 'user123';
      const reviewData: CreateReviewRequest = {
        rating: 5,
        comment: 'Great product!'
      };

      const existingReview = {
        _id: 'existing123',
        productId,
        userId,
        rating: 4
      };

      MockedReview.findOne = jest.fn().mockResolvedValue(existingReview);

      await expect(
        reviewService.createReview(productId, userId, reviewData)
      ).rejects.toThrow('User has already reviewed this product');
    });
  });

  describe('calculateRatingStats', () => {
    it('should calculate rating statistics correctly', async () => {
      const productId = 'product123';
      const mockAggregateResult = [{
        _id: null,
        totalReviews: 5,
        averageRating: 4.2,
        ratings: [5, 4, 4, 3, 5]
      }];

      MockedReview.aggregate = jest.fn().mockResolvedValue(mockAggregateResult);

      const result = await reviewService.calculateRatingStats(productId);

      expect(result).toEqual({
        averageRating: 4.2,
        totalReviews: 5,
        ratingBreakdown: {
          1: 0,
          2: 0,
          3: 1,
          4: 2,
          5: 2
        }
      });
    });

    it('should return zero stats for product with no reviews', async () => {
      const productId = 'product123';

      MockedReview.aggregate = jest.fn().mockResolvedValue([]);

      const result = await reviewService.calculateRatingStats(productId);

      expect(result).toEqual({
        averageRating: 0,
        totalReviews: 0,
        ratingBreakdown: {
          1: 0,
          2: 0,
          3: 0,
          4: 0,
          5: 0
        }
      });
    });
  });

  describe('updateReview', () => {
    it('should update review successfully for owner', async () => {
      const reviewId = 'review123';
      const userId = 'user123';
      const updateData: UpdateReviewRequest = {
        rating: 4,
        comment: 'Updated comment'
      };

      const mockReview = {
        _id: reviewId,
        userId,
        productId: 'product123',
        rating: 5,
        comment: 'Original comment',
        save: jest.fn().mockResolvedValue({
          _id: reviewId,
          userId,
          productId: 'product123',
          rating: 4,
          comment: 'Updated comment',
          createdAt: new Date(),
          updatedAt: new Date()
        })
      };

      const mockUser = {
        _id: userId,
        name: 'Test User'
      };

      MockedReview.findById = jest.fn().mockResolvedValue(mockReview);
      MockedUser.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockUser)
        })
      });

      const result = await reviewService.updateReview(reviewId, userId, updateData);

      expect(mockReview.save).toHaveBeenCalled();
      expect(result.rating).toBe(4);
      expect(result.comment).toBe('Updated comment');
    });

    it('should throw error for unauthorized update', async () => {
      const reviewId = 'review123';
      const userId = 'user123';
      const otherUserId = 'user456';
      const updateData: UpdateReviewRequest = {
        rating: 4
      };

      const mockReview = {
        _id: reviewId,
        userId: otherUserId,
        productId: 'product123'
      };

      MockedReview.findById = jest.fn().mockResolvedValue(mockReview);

      await expect(
        reviewService.updateReview(reviewId, userId, updateData)
      ).rejects.toThrow('Unauthorized: You can only update your own reviews');
    });
  });

  describe('deleteReview', () => {
    it('should delete review successfully for owner', async () => {
      const reviewId = 'review123';
      const userId = 'user123';

      const mockReview = {
        _id: reviewId,
        userId,
        productId: 'product123'
      };

      MockedReview.findById = jest.fn().mockResolvedValue(mockReview);
      MockedReview.findByIdAndDelete = jest.fn().mockResolvedValue(mockReview);

      await reviewService.deleteReview(reviewId, userId);

      expect(MockedReview.findByIdAndDelete).toHaveBeenCalledWith(reviewId);
    });

    it('should allow admin to delete any review', async () => {
      const reviewId = 'review123';
      const adminUserId = 'admin123';
      const reviewOwnerUserId = 'user123';

      const mockReview = {
        _id: reviewId,
        userId: reviewOwnerUserId,
        productId: 'product123'
      };

      MockedReview.findById = jest.fn().mockResolvedValue(mockReview);
      MockedReview.findByIdAndDelete = jest.fn().mockResolvedValue(mockReview);

      await reviewService.deleteReview(reviewId, adminUserId, true);

      expect(MockedReview.findByIdAndDelete).toHaveBeenCalledWith(reviewId);
    });
  });
});