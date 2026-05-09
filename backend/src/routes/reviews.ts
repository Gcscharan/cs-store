/**
 * Reviews Router - RESTful API endpoints for product reviews
 * 
 * Provides HTTP endpoints for review CRUD operations with proper
 * authentication, authorization, validation, and error handling.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import express, { Request, Response } from 'express';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import {
  requireReviewAuth,
  requireReviewOwnership,
  requireReviewDeletePermission,
  checkDuplicateReview
} from '../middleware/reviewAuth';
import {
  validateProductId,
  validateReviewId,
  validateCreateReview,
  validateUpdateReview,
  validatePagination
} from '../middleware/reviewValidation';
import { reviewService } from '../services/reviewService';
import { CreateReviewRequest, UpdateReviewRequest } from '../types/reviews';

const router = express.Router({ mergeParams: true }); // mergeParams to access :productId

/**
 * GET /api/products/:productId/reviews
 * Get paginated reviews for a product with statistics
 * Requirements: 3.1, 3.4, 3.5, 7.1, 7.4
 */
router.get(
  '/',
  validateProductId,
  validatePagination,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { productId } = req.params;
      const { page, limit } = req.query as any;

      const result = await reviewService.getReviews(productId, { page, limit });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      return res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve reviews',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }
);

/**
 * POST /api/products/:productId/reviews
 * Create a new review for a product
 * Requirements: 4.1, 4.2, 4.4, 4.5, 7.1, 7.4
 */
router.post(
  '/',
  authenticateToken,
  requireReviewAuth,
  validateProductId,
  validateCreateReview,
  checkDuplicateReview,
  async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { productId } = req.params;
      const userId = req.user!._id.toString();
      const reviewData: CreateReviewRequest = req.body;

      const review = await reviewService.createReview(productId, userId, reviewData);

      return res.status(201).json({
        success: true,
        data: review,
        message: 'Review created successfully'
      });
    } catch (error: any) {
      if (error.message.includes('already reviewed')) {
        return res.status(409).json({
          error: {
            code: 'DUPLICATE_REVIEW',
            message: error.message
          }
        });
      }

      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid review data',
            details: error.errors
          }
        });
      }

      return res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create review',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }
);

/**
 * PUT /api/products/:productId/reviews/:reviewId
 * Update an existing review
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.1, 7.4
 */
router.put(
  '/:reviewId',
  authenticateToken,
  requireReviewAuth,
  validateProductId,
  validateReviewId,
  validateUpdateReview,
  requireReviewOwnership,
  async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { reviewId } = req.params;
      const userId = req.user!._id.toString();
      const updateData: UpdateReviewRequest = req.body;
      const isAdmin = (req as any).isAdmin || false;

      const updatedReview = await reviewService.updateReview(
        reviewId,
        userId,
        updateData,
        isAdmin
      );

      return res.status(200).json({
        success: true,
        data: updatedReview,
        message: 'Review updated successfully'
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'REVIEW_NOT_FOUND',
            message: error.message
          }
        });
      }

      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: error.message
          }
        });
      }

      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid review update data',
            details: error.errors
          }
        });
      }

      return res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update review',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }
);

/**
 * DELETE /api/products/:productId/reviews/:reviewId
 * Delete a review
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.4
 */
router.delete(
  '/:reviewId',
  authenticateToken,
  requireReviewAuth,
  validateProductId,
  validateReviewId,
  requireReviewDeletePermission,
  async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const { reviewId } = req.params;
      const userId = req.user!._id.toString();
      const isAdmin = (req as any).isAdmin || false;

      await reviewService.deleteReview(reviewId, userId, isAdmin);

      return res.status(200).json({
        success: true,
        message: 'Review deleted successfully'
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'REVIEW_NOT_FOUND',
            message: error.message
          }
        });
      }

      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: error.message
          }
        });
      }

      return res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete review',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }
);

/**
 * GET /api/products/:productId/reviews/stats
 * Get rating statistics for a product
 * Requirements: 3.2, 3.3, 7.1, 7.4
 */
router.get(
  '/stats',
  validateProductId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { productId } = req.params;

      const stats = await reviewService.calculateRatingStats(productId);

      return res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      return res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to calculate rating statistics',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }
);

/**
 * GET /api/products/:productId/reviews/:reviewId
 * Get a specific review by ID
 * Requirements: 7.1, 7.4
 */
router.get(
  '/:reviewId',
  validateProductId,
  validateReviewId,
  async (req: Request, res: Response): Promise<Response> => {
    try {
      const { reviewId } = req.params;

      const review = await reviewService.getReviewById(reviewId);

      if (!review) {
        return res.status(404).json({
          error: {
            code: 'REVIEW_NOT_FOUND',
            message: 'Review not found'
          }
        });
      }

      return res.status(200).json({
        success: true,
        data: review
      });
    } catch (error: any) {
      return res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve review',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        }
      });
    }
  }
);

export default router;