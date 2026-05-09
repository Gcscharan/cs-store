/**
 * Validation functions for the Product Reviews System
 * 
 * This module provides comprehensive validation functions for review data,
 * including rating range validation, required field validation, and input sanitization.
 * 
 * Requirements: 1.2, 1.3, 1.4
 */

import {
  CreateReviewRequest,
  UpdateReviewRequest,
  ValidationResult,
  ValidationError,
  ReviewValidationOptions,
  ValidRating
} from '../types/reviews';

// ============================================================================
// Core Validation Functions
// ============================================================================

/**
 * Validates a rating value to ensure it's within the valid range (1-5)
 * Requirements: 1.2, 1.3
 * 
 * @param rating - The rating value to validate
 * @returns ValidationResult indicating if the rating is valid
 */
export function validateRating(rating: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Check if rating is provided
  if (rating === null || rating === undefined) {
    errors.push({
      field: 'rating',
      message: 'Rating is required',
      value: rating
    });
    return { isValid: false, errors };
  }

  // Check if rating is a number
  if (typeof rating !== 'number') {
    errors.push({
      field: 'rating',
      message: 'Rating must be a number',
      value: rating
    });
    return { isValid: false, errors };
  }

  // Check if rating is an integer
  if (!Number.isInteger(rating)) {
    errors.push({
      field: 'rating',
      message: 'Rating must be an integer',
      value: rating
    });
    return { isValid: false, errors };
  }

  // Check if rating is within valid range (1-5 inclusive)
  if (rating < 1 || rating > 5) {
    errors.push({
      field: 'rating',
      message: 'Rating must be between 1 and 5 inclusive',
      value: rating
    });
    return { isValid: false, errors };
  }

  return { isValid: true, errors: [] };
}

/**
 * Validates required fields for review creation
 * Requirements: 1.3, 1.4
 * 
 * @param data - The review data to validate
 * @returns ValidationResult indicating if required fields are present
 */
export function validateRequiredFields(data: CreateReviewRequest): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate rating (required field)
  const ratingValidation = validateRating(data.rating);
  if (!ratingValidation.isValid) {
    errors.push(...ratingValidation.errors);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates optional comment field
 * Requirements: 1.4
 * 
 * @param comment - The comment to validate
 * @param maxLength - Maximum allowed length (default: 1000)
 * @returns ValidationResult indicating if the comment is valid
 */
export function validateComment(comment: string | undefined, maxLength: number = 1000): ValidationResult {
  const errors: ValidationError[] = [];

  if (comment !== undefined) {
    // Check if comment is a string
    if (typeof comment !== 'string') {
      errors.push({
        field: 'comment',
        message: 'Comment must be a string',
        value: comment
      });
      return { isValid: false, errors };
    }

    // Check comment length
    if (comment.length > maxLength) {
      errors.push({
        field: 'comment',
        message: `Comment cannot exceed ${maxLength} characters`,
        value: comment
      });
    }
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates optional images array
 * Requirements: 1.4
 * 
 * @param images - The images array to validate
 * @param maxCount - Maximum number of images allowed (default: 10)
 * @returns ValidationResult indicating if the images are valid
 */
export function validateImages(images: string[] | undefined, maxCount: number = 10): ValidationResult {
  const errors: ValidationError[] = [];

  if (images !== undefined) {
    // Check if images is an array
    if (!Array.isArray(images)) {
      errors.push({
        field: 'images',
        message: 'Images must be an array',
        value: images
      });
      return { isValid: false, errors };
    }

    // Check array length
    if (images.length > maxCount) {
      errors.push({
        field: 'images',
        message: `Cannot exceed ${maxCount} images`,
        value: images
      });
    }

    // Validate each image URL
    images.forEach((image, index) => {
      if (typeof image !== 'string') {
        errors.push({
          field: `images[${index}]`,
          message: 'Image URL must be a string',
          value: image
        });
      } else if (!isValidUrl(image)) {
        errors.push({
          field: `images[${index}]`,
          message: 'Invalid image URL format',
          value: image
        });
      }
    });
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================================
// Comprehensive Validation Functions
// ============================================================================

/**
 * Validates a complete review creation request
 * Requirements: 1.2, 1.3, 1.4
 * 
 * @param data - The review creation data to validate
 * @param options - Validation options
 * @returns ValidationResult indicating if the review data is valid
 */
export function validateCreateReviewRequest(
  data: CreateReviewRequest,
  options: ReviewValidationOptions = {}
): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate required fields
  const requiredFieldsValidation = validateRequiredFields(data);
  if (!requiredFieldsValidation.isValid) {
    errors.push(...requiredFieldsValidation.errors);
  }

  // Validate optional comment
  const commentValidation = validateComment(data.comment, options.maxCommentLength);
  if (!commentValidation.isValid) {
    errors.push(...commentValidation.errors);
  }

  // Validate optional images
  const imagesValidation = validateImages(data.images, options.maxImagesCount);
  if (!imagesValidation.isValid) {
    errors.push(...imagesValidation.errors);
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates a review update request
 * Requirements: 1.2, 1.3, 1.4
 * 
 * @param data - The review update data to validate
 * @param options - Validation options
 * @returns ValidationResult indicating if the update data is valid
 */
export function validateUpdateReviewRequest(
  data: UpdateReviewRequest,
  options: ReviewValidationOptions = {}
): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate rating if provided
  if (data.rating !== undefined) {
    const ratingValidation = validateRating(data.rating);
    if (!ratingValidation.isValid) {
      errors.push(...ratingValidation.errors);
    }
  }

  // Validate comment if provided
  if (data.comment !== undefined) {
    const commentValidation = validateComment(data.comment, options.maxCommentLength);
    if (!commentValidation.isValid) {
      errors.push(...commentValidation.errors);
    }
  }

  // Validate images if provided
  if (data.images !== undefined) {
    const imagesValidation = validateImages(data.images, options.maxImagesCount);
    if (!imagesValidation.isValid) {
      errors.push(...imagesValidation.errors);
    }
  }

  // Ensure at least one field is being updated
  if (data.rating === undefined && data.comment === undefined && data.images === undefined) {
    errors.push({
      field: 'request',
      message: 'At least one field must be provided for update',
      value: data
    });
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if a string is a valid URL
 * 
 * @param url - The URL string to validate
 * @returns boolean indicating if the URL is valid
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes a comment by trimming whitespace
 * 
 * @param comment - The comment to sanitize
 * @returns Sanitized comment or undefined
 */
export function sanitizeComment(comment: string | undefined): string | undefined {
  if (comment === undefined || comment === null) {
    return undefined;
  }
  
  const trimmed = comment.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Sanitizes an array of image URLs by filtering out invalid ones
 * 
 * @param images - The images array to sanitize
 * @returns Sanitized images array or undefined
 */
export function sanitizeImages(images: string[] | undefined): string[] | undefined {
  if (!Array.isArray(images) || images.length === 0) {
    return undefined;
  }
  
  const validImages = images
    .filter(image => typeof image === 'string' && image.trim().length > 0)
    .map(image => image.trim());
    
  return validImages.length > 0 ? validImages : undefined;
}

/**
 * Type guard to check if a value is a valid rating
 * 
 * @param value - The value to check
 * @returns boolean indicating if the value is a valid rating
 */
export function isValidRating(value: any): value is ValidRating {
  return typeof value === 'number' && 
         Number.isInteger(value) && 
         value >= 1 && 
         value <= 5;
}

/**
 * Converts a rating to a ValidRating type with validation
 * 
 * @param rating - The rating to convert
 * @returns ValidRating or throws an error if invalid
 */
export function toValidRating(rating: any): ValidRating {
  const validation = validateRating(rating);
  if (!validation.isValid) {
    throw new Error(validation.errors[0]?.message || 'Invalid rating');
  }
  return rating as ValidRating;
}