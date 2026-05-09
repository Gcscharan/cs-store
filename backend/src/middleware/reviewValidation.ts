/**
 * Review Input Validation Middleware
 * 
 * Provides comprehensive input validation for review operations
 * including parameter validation, request body validation, and
 * descriptive error handling.
 * 
 * Requirements: 4.4, 8.1, 8.2
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import mongoose from 'mongoose';

/**
 * Validation result interface
 */
interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Validate productId parameter
 * Requirements: 4.4, 8.1
 */
export const validateProductId = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const { productId } = req.params;

  if (!productId) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Product ID is required',
        details: {
          field: 'productId',
          constraint: 'required'
        }
      }
    });
  }

  if (typeof productId !== 'string' || productId.trim().length === 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Product ID must be a non-empty string',
        details: {
          field: 'productId',
          value: productId,
          constraint: 'non-empty string'
        }
      }
    });
  }

  next();
};

/**
 * Validate reviewId parameter
 * Requirements: 4.4, 8.1
 */
export const validateReviewId = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const { reviewId } = req.params;

  if (!reviewId) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Review ID is required',
        details: {
          field: 'reviewId',
          constraint: 'required'
        }
      }
    });
  }

  if (!mongoose.Types.ObjectId.isValid(reviewId)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Review ID must be a valid MongoDB ObjectId',
        details: {
          field: 'reviewId',
          value: reviewId,
          constraint: 'valid ObjectId'
        }
      }
    });
  }

  next();
};

/**
 * Validate review creation request body
 * Requirements: 1.2, 1.3, 4.4, 8.1
 */
export const validateCreateReview = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  const errors: ValidationError[] = [];
  const { rating, comment, images } = req.body;

  // Validate rating (required)
  if (rating === undefined || rating === null) {
    errors.push({
      field: 'rating',
      message: 'Rating is required'
    });
  } else if (typeof rating !== 'number') {
    errors.push({
      field: 'rating',
      message: 'Rating must be a number',
      value: rating
    });
  } else if (!Number.isInteger(rating)) {
    errors.push({
      field: 'rating',
      message: 'Rating must be an integer',
      value: rating
    });
  } else if (rating < 1 || rating > 5) {
    errors.push({
      field: 'rating',
      message: 'Rating must be between 1 and 5 inclusive',
      value: rating
    });
  }

  // Validate comment (optional)
  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') {
      errors.push({
        field: 'comment',
        message: 'Comment must be a string',
        value: comment
      });
    } else if (comment.length > 1000) {
      errors.push({
        field: 'comment',
        message: 'Comment cannot exceed 1000 characters',
        value: comment.length
      });
    }
  }

  // Validate images (optional)
  if (images !== undefined && images !== null) {
    if (!Array.isArray(images)) {
      errors.push({
        field: 'images',
        message: 'Images must be an array',
        value: images
      });
    } else {
      images.forEach((image, index) => {
        if (typeof image !== 'string') {
          errors.push({
            field: `images[${index}]`,
            message: 'Each image must be a string URL',
            value: image
          });
        } else {
          try {
            new URL(image);
          } catch {
            errors.push({
              field: `images[${index}]`,
              message: 'Invalid image URL format',
              value: image
            });
          }
        }
      });

      if (images.length > 10) {
        errors.push({
          field: 'images',
          message: 'Cannot upload more than 10 images',
          value: images.length
        });
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid review data',
        details: errors
      }
    });
  }

  next();
};

/**
 * Validate review update request body
 * Requirements: 1.2, 1.3, 4.4, 8.1
 */
export const validateUpdateReview = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Response | void => {
  const errors: ValidationError[] = [];
  const { rating, comment, images } = req.body;

  // Check if at least one field is provided for update
  if (rating === undefined && comment === undefined && images === undefined) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'At least one field (rating, comment, or images) must be provided for update'
      }
    });
  }

  // Validate rating (optional for updates)
  if (rating !== undefined && rating !== null) {
    if (typeof rating !== 'number') {
      errors.push({
        field: 'rating',
        message: 'Rating must be a number',
        value: rating
      });
    } else if (!Number.isInteger(rating)) {
      errors.push({
        field: 'rating',
        message: 'Rating must be an integer',
        value: rating
      });
    } else if (rating < 1 || rating > 5) {
      errors.push({
        field: 'rating',
        message: 'Rating must be between 1 and 5 inclusive',
        value: rating
      });
    }
  }

  // Validate comment (optional)
  if (comment !== undefined && comment !== null) {
    if (typeof comment !== 'string') {
      errors.push({
        field: 'comment',
        message: 'Comment must be a string',
        value: comment
      });
    } else if (comment.length > 1000) {
      errors.push({
        field: 'comment',
        message: 'Comment cannot exceed 1000 characters',
        value: comment.length
      });
    }
  }

  // Validate images (optional)
  if (images !== undefined && images !== null) {
    if (!Array.isArray(images)) {
      errors.push({
        field: 'images',
        message: 'Images must be an array',
        value: images
      });
    } else {
      images.forEach((image, index) => {
        if (typeof image !== 'string') {
          errors.push({
            field: `images[${index}]`,
            message: 'Each image must be a string URL',
            value: image
          });
        } else {
          try {
            new URL(image);
          } catch {
            errors.push({
              field: `images[${index}]`,
              message: 'Invalid image URL format',
              value: image
            });
          }
        }
      });

      if (images.length > 10) {
        errors.push({
          field: 'images',
          message: 'Cannot upload more than 10 images',
          value: images.length
        });
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid review update data',
        details: errors
      }
    });
  }

  next();
};

/**
 * Validate pagination query parameters
 * Requirements: 3.1, 3.4, 8.1
 */
export const validatePagination = (
  req: Request,
  res: Response,
  next: NextFunction
): Response | void => {
  const errors: ValidationError[] = [];
  let { page, limit } = req.query;

  // Set defaults
  const defaultPage = 1;
  const defaultLimit = 10;
  const maxLimit = 100;

  // Validate page
  if (page !== undefined) {
    const pageNum = parseInt(page as string, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      errors.push({
        field: 'page',
        message: 'Page must be a positive integer',
        value: page
      });
    } else {
      (req.query as any).page = pageNum;
    }
  } else {
    (req.query as any).page = defaultPage;
  }

  // Validate limit
  if (limit !== undefined) {
    const limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      errors.push({
        field: 'limit',
        message: 'Limit must be a positive integer',
        value: limit
      });
    } else if (limitNum > maxLimit) {
      errors.push({
        field: 'limit',
        message: `Limit cannot exceed ${maxLimit}`,
        value: limitNum
      });
    } else {
      (req.query as any).limit = limitNum;
    }
  } else {
    (req.query as any).limit = defaultLimit;
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

  next();
};