/**
 * Reviews API Integration Tests
 * 
 * Tests for the reviews API endpoints to verify proper
 * request handling, validation, and response formatting.
 */

import request from 'supertest';
import express from 'express';
import reviewsRouter from '../routes/reviews';
import { reviewService } from '../services/reviewService';

// Mock the review service
jest.mock('../services/reviewService');
const mockReviewService = reviewService as jest.Mocked<typeof reviewService>;

// Mock authentication middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    req.user = { _id: 'user123', role: 'customer' };
    next();
  },
  AuthRequest: {}
}));

// Mock review auth middleware
jest.mock('../middleware/reviewAuth', () => ({
  requireReviewAuth: (req: any, res: any, next: any) => next(),
  requireReviewOwnership: (req: any, res: any, next: any) => {
    req.review = { _id: req.params.reviewId, userId: 'user123' };
    req.isAdmin = false;
    req.isOwner = true;
    next();
  },
  requireReviewDeletePermission: (req: any, res: any, next: any) => {
    req.review = { _id: req.params.reviewId, userId: 'user123' };
    req.isAdmin = false;
    req.isOwner = true;
    next();
  },
  checkDuplicateReview: (req: any, res: any, next: any) => next()
}));

// Mock validation middleware
jest.mock('../middleware/reviewValidation', () => ({
  validateProductId: (req: any, res: any, next: any) => next(),
  validateReviewId: (req: any, res: any, next: any) => next(),
  validateCreateReview: (req: any, res: any, next: any) => {
    if (!req.body.rating) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid review data',
          details: [{ field: 'rating', message: 'Rating is required' }]
        }
      });
    }
    if (req.body.rating < 1 || req.body.rating > 5) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid review data',
          details: [{ field: 'rating', message: 'Rating must be between 1 and 5 inclusive', value: req.body.rating }]
        }
      });
    }
    next();
  },
  validateUpdateReview: (req: any, res: any, next: any) => {
    if (!req.body.rating && !req.body.comment && !req.body.images) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one field (rating, comment, or images) must be provided for update'
        }
      });
    }
    next();
  },
  validatePagination: (req: any, res: any, next: any) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const errors = [];
    if (req.query.page && (isNaN(parseInt(req.query.page)) || parseInt(req.query.page) < 1)) {
      errors.push({ field: 'page', message: 'Page must be a positive integer', value: req.query.page });
    }
    if (req.query.limit && (isNaN(parseInt(req.query.limit)) || parseInt(req.query.limit) < 1)) {
      errors.push({ field: 'limit', message: 'Limit must be a positive integer', value: req.query.limit });
    }
    
    if (errors.length > 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid pagination parameters',
          details: errors
        }
      });
    }
    
    req.query.page = page;
    req.query.limit = limit;
    next();
  }
}));

describe('Reviews API', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/products/:productId/reviews', reviewsRouter);
    jest.clearAllMocks();
  });

  describe('GET /api/products/:productId/reviews', () => {
    it('should return paginated reviews successfully', async () => {
      const mockResponse = {
        reviews: [
          {
            _id: 'review1',
            productId: 'product123',
            userId: 'user123',
            rating: 5,
            comment: 'Great product!',
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            user: { _id: 'user123', name: 'Test User' }
          }
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 1,
          itemsPerPage: 10,
          hasNextPage: false,
          hasPreviousPage: false
        },
        stats: {
          averageRating: 5,
          totalReviews: 1,
          ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 }
        }
      };

      mockReviewService.getReviews.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/products/product123/reviews')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResponse);
      expect(mockReviewService.getReviews).toHaveBeenCalledWith('product123', { page: 1, limit: 10 });
    });

    it('should handle pagination parameters', async () => {
      const mockResponse = {
        reviews: [],
        pagination: {
          currentPage: 2,
          totalPages: 3,
          totalItems: 25,
          itemsPerPage: 10,
          hasNextPage: true,
          hasPreviousPage: true
        },
        stats: {
          averageRating: 0,
          totalReviews: 0,
          ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }
      };

      mockReviewService.getReviews.mockResolvedValue(mockResponse);

      const response = await request(app)
        .get('/api/products/product123/reviews?page=2&limit=10')
        .expect(200);

      expect(mockReviewService.getReviews).toHaveBeenCalledWith('product123', { page: 2, limit: 10 });
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app)
        .get('/api/products/product123/reviews?page=0&limit=-5')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details).toHaveLength(2);
    });
  });

  describe('POST /api/products/:productId/reviews', () => {
    it('should create a review successfully', async () => {
      const reviewData = {
        rating: 5,
        comment: 'Excellent product!',
        images: ['https://example.com/image1.jpg']
      };

      const mockCreatedReview = {
        _id: 'review123',
        productId: 'product123',
        userId: 'user123',
        rating: 5,
        comment: 'Excellent product!',
        images: ['https://example.com/image1.jpg'],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        user: { _id: 'user123', name: 'Test User' }
      };

      mockReviewService.createReview.mockResolvedValue(mockCreatedReview);

      const response = await request(app)
        .post('/api/products/product123/reviews')
        .send(reviewData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockCreatedReview);
      expect(response.body.message).toBe('Review created successfully');
      expect(mockReviewService.createReview).toHaveBeenCalledWith('product123', 'user123', reviewData);
    });

    it('should validate required rating field', async () => {
      const invalidData = {
        comment: 'Great product!'
      };

      const response = await request(app)
        .post('/api/products/product123/reviews')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].field).toBe('rating');
      expect(response.body.error.details[0].message).toBe('Rating is required');
    });

    it('should validate rating range', async () => {
      const invalidData = {
        rating: 6,
        comment: 'Great product!'
      };

      const response = await request(app)
        .post('/api/products/product123/reviews')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details[0].field).toBe('rating');
      expect(response.body.error.details[0].message).toBe('Rating must be between 1 and 5 inclusive');
    });

    it('should handle duplicate review error', async () => {
      const reviewData = {
        rating: 5,
        comment: 'Great product!'
      };

      mockReviewService.createReview.mockRejectedValue(
        new Error('User has already reviewed this product. Use update instead.')
      );

      const response = await request(app)
        .post('/api/products/product123/reviews')
        .send(reviewData)
        .expect(409);

      expect(response.body.error.code).toBe('DUPLICATE_REVIEW');
    });
  });

  describe('GET /api/products/:productId/reviews/stats', () => {
    it('should return rating statistics', async () => {
      const mockStats = {
        averageRating: 4.2,
        totalReviews: 5,
        ratingBreakdown: { 1: 0, 2: 0, 3: 1, 4: 2, 5: 2 }
      };

      mockReviewService.calculateRatingStats.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/products/product123/reviews/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockStats);
      expect(mockReviewService.calculateRatingStats).toHaveBeenCalledWith('product123');
    });
  });

  describe('PUT /api/products/:productId/reviews/:reviewId', () => {
    it('should update a review successfully', async () => {
      const updateData = {
        rating: 4,
        comment: 'Updated comment'
      };

      const validReviewId = '507f1f77bcf86cd799439011';
      const mockUpdatedReview = {
        _id: validReviewId,
        productId: 'product123',
        userId: 'user123',
        rating: 4,
        comment: 'Updated comment',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T12:00:00.000Z',
        user: { _id: 'user123', name: 'Test User' }
      };

      mockReviewService.updateReview.mockResolvedValue(mockUpdatedReview);

      const response = await request(app)
        .put(`/api/products/product123/reviews/${validReviewId}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockUpdatedReview);
      expect(response.body.message).toBe('Review updated successfully');
    });

    it('should validate update data', async () => {
      const validReviewId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .put(`/api/products/product123/reviews/${validReviewId}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('At least one field (rating, comment, or images) must be provided for update');
    });
  });

  describe('DELETE /api/products/:productId/reviews/:reviewId', () => {
    it('should delete a review successfully', async () => {
      const validReviewId = '507f1f77bcf86cd799439011';
      mockReviewService.deleteReview.mockResolvedValue();

      const response = await request(app)
        .delete(`/api/products/product123/reviews/${validReviewId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Review deleted successfully');
      expect(mockReviewService.deleteReview).toHaveBeenCalledWith(validReviewId, 'user123', false);
    });
  });
});