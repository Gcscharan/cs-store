/**
 * Review Authentication and Authorization Middleware
 * 
 * Provides authentication validation and authorization checks
 * specifically for review operations.
 * 
 * Requirements: 4.1, 5.1, 5.2, 5.5, 6.1, 6.2, 6.3, 6.5, 8.3
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { Review } from '../models/Review';

/**
 * Authentication middleware for review operations
 * Ensures user is authenticated before allowing review operations
 * Requirements: 4.1, 8.3
 */
export const requireReviewAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  if (!req.user) {
    return res.status(401).json({
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication required for review operations'
      }
    });
  }

  // Ensure userId is available for review operations
  if (!req.user._id) {
    return res.status(401).json({
      error: {
        code: 'INVALID_USER_DATA',
        message: 'Invalid user authentication data'
      }
    });
  }

  next();
};

/**
 * Authorization middleware for review ownership
 * Ensures users can only modify their own reviews (unless admin)
 * Requirements: 5.1, 5.2, 5.5
 */
export const requireReviewOwnership = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?._id?.toString();
    const userRole = req.user?.role?.toLowerCase();

    if (!reviewId) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REVIEW_ID',
          message: 'Review ID is required'
        }
      });
    }

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User authentication required'
        }
      });
    }

    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        error: {
          code: 'REVIEW_NOT_FOUND',
          message: 'Review not found'
        }
      });
    }

    // Check if user is admin (admins can modify any review)
    const isAdmin = userRole === 'admin';
    
    // Check ownership
    const isOwner = review.userId === userId;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You can only modify your own reviews'
        }
      });
    }

    // Add review and permission info to request for use in handlers
    (req as any).review = review;
    (req as any).isAdmin = isAdmin;
    (req as any).isOwner = isOwner;

    next();
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: 'Error checking review permissions'
      }
    });
  }
};

/**
 * Authorization middleware for review deletion
 * Allows review owners and admins to delete reviews
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */
export const requireReviewDeletePermission = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { reviewId } = req.params;
    const userId = req.user?._id?.toString();
    const userRole = req.user?.role?.toLowerCase();

    if (!reviewId) {
      return res.status(400).json({
        error: {
          code: 'MISSING_REVIEW_ID',
          message: 'Review ID is required'
        }
      });
    }

    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User authentication required'
        }
      });
    }

    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        error: {
          code: 'REVIEW_NOT_FOUND',
          message: 'Review not found'
        }
      });
    }

    // Check permissions
    const isAdmin = userRole === 'admin';
    const isOwner = review.userId === userId;

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You can only delete your own reviews or must be an admin'
        }
      });
    }

    // Add review and permission info to request
    (req as any).review = review;
    (req as any).isAdmin = isAdmin;
    (req as any).isOwner = isOwner;

    next();
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'AUTHORIZATION_ERROR',
        message: 'Error checking delete permissions'
      }
    });
  }
};

/**
 * Middleware to check if user has already reviewed a product
 * Used to prevent duplicate reviews
 * Requirements: 2.1, 2.2
 */
export const checkDuplicateReview = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response | void> => {
  try {
    const { productId } = req.params;
    const userId = req.user?._id?.toString();

    if (!productId || !userId) {
      return res.status(400).json({
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'Product ID and user authentication required'
        }
      });
    }

    // Check for existing review
    const existingReview = await Review.findOne({ productId, userId });
    if (existingReview) {
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_REVIEW',
          message: 'You have already reviewed this product. Use update instead.',
          details: {
            existingReviewId: existingReview._id,
            productId,
            userId
          }
        }
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      error: {
        code: 'DUPLICATE_CHECK_ERROR',
        message: 'Error checking for duplicate reviews'
      }
    });
  }
};