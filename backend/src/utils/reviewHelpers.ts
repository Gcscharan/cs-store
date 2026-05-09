/**
 * Helper utilities for the Product Reviews System
 * 
 * This module provides utility functions for pagination, rating statistics,
 * data transformation, and other common operations used throughout the reviews system.
 * 
 * Requirements: 10.1, 10.2, 10.4, 10.5
 */

import {
  Review,
  ReviewWithUser,
  ReviewUser,
  PaginationOptions,
  PaginationMeta,
  RatingStats,
  RatingBreakdown,
  ReviewQueryOptions
} from '../types/reviews';

// ============================================================================
// Pagination Utilities
// ============================================================================

/**
 * Creates pagination options with defaults and validation
 * Requirements: 10.4
 * 
 * @param page - Page number (1-based)
 * @param limit - Items per page
 * @returns Validated PaginationOptions
 */
export function createPaginationOptions(page: number = 1, limit: number = 10): PaginationOptions {
  // Ensure page is at least 1
  const validPage = Math.max(1, Math.floor(page));
  
  // Ensure limit is between 1 and 100
  const validLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  
  // Calculate offset
  const offset = (validPage - 1) * validLimit;
  
  return {
    page: validPage,
    limit: validLimit,
    offset
  };
}

/**
 * Creates pagination metadata for API responses
 * Requirements: 10.4
 * 
 * @param totalItems - Total number of items
 * @param options - Pagination options used for the query
 * @returns PaginationMeta object
 */
export function createPaginationMeta(totalItems: number, options: PaginationOptions): PaginationMeta {
  const { page, limit } = options;
  const totalPages = Math.ceil(totalItems / limit);
  
  return {
    currentPage: page,
    totalPages,
    totalItems,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

/**
 * Validates and normalizes pagination parameters from query strings
 * 
 * @param pageParam - Page parameter from query string
 * @param limitParam - Limit parameter from query string
 * @returns Validated PaginationOptions
 */
export function parsePaginationParams(pageParam?: string, limitParam?: string): PaginationOptions {
  const page = pageParam ? parseInt(pageParam, 10) : 1;
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  
  // Handle NaN values by using defaults
  const validPage = isNaN(page) ? 1 : page;
  const validLimit = isNaN(limit) ? 10 : limit;
  
  return createPaginationOptions(validPage, validLimit);
}

// ============================================================================
// Rating Statistics Utilities
// ============================================================================

/**
 * Calculates rating statistics from an array of reviews
 * Requirements: 10.5
 * 
 * @param reviews - Array of reviews to analyze
 * @returns RatingStats object with average and breakdown
 */
export function calculateRatingStats(reviews: Review[]): RatingStats {
  if (reviews.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }

  // Initialize rating breakdown
  const ratingBreakdown: RatingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRating = 0;

  // Count ratings and calculate total
  reviews.forEach(review => {
    const rating = review.rating as keyof RatingBreakdown;
    ratingBreakdown[rating]++;
    totalRating += review.rating;
  });

  // Calculate average rating (rounded to 1 decimal place)
  const averageRating = Math.round((totalRating / reviews.length) * 10) / 10;

  return {
    averageRating,
    totalReviews: reviews.length,
    ratingBreakdown
  };
}

/**
 * Calculates rating statistics from raw rating values
 * 
 * @param ratings - Array of rating numbers
 * @returns RatingStats object
 */
export function calculateRatingStatsFromValues(ratings: number[]): RatingStats {
  if (ratings.length === 0) {
    return {
      averageRating: 0,
      totalReviews: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    };
  }

  const ratingBreakdown: RatingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let totalRating = 0;

  ratings.forEach(rating => {
    if (rating >= 1 && rating <= 5) {
      const ratingKey = rating as keyof RatingBreakdown;
      ratingBreakdown[ratingKey]++;
      totalRating += rating;
    }
  });

  const averageRating = Math.round((totalRating / ratings.length) * 10) / 10;

  return {
    averageRating,
    totalReviews: ratings.length,
    ratingBreakdown
  };
}

// ============================================================================
// Data Transformation Utilities
// ============================================================================

/**
 * Transforms a Review document to ReviewWithUser format for API responses
 * Requirements: 10.1, 10.2
 * 
 * @param review - Review document from database
 * @param user - User information to include
 * @returns ReviewWithUser object formatted for API response
 */
export function transformReviewForResponse(review: Review, user: ReviewUser): ReviewWithUser {
  return {
    _id: review._id.toString(),
    productId: review.productId,
    userId: review.userId,
    rating: review.rating,
    comment: review.comment,
    images: review.images,
    createdAt: review.createdAt.toISOString(), // ISO 8601 format
    updatedAt: review.updatedAt.toISOString(), // ISO 8601 format
    user: {
      _id: user._id,
      name: user.name
    }
  };
}

/**
 * Transforms an array of reviews with user data for API responses
 * 
 * @param reviews - Array of review documents
 * @param users - Map of userId to user data
 * @returns Array of ReviewWithUser objects
 */
export function transformReviewsForResponse(
  reviews: Review[], 
  users: Map<string, ReviewUser>
): ReviewWithUser[] {
  return reviews.map(review => {
    const user = users.get(review.userId);
    if (!user) {
      throw new Error(`User not found for review ${review._id}`);
    }
    return transformReviewForResponse(review, user);
  });
}

/**
 * Creates a minimal user object for review responses
 * 
 * @param userId - User ID
 * @param userName - User name
 * @returns ReviewUser object
 */
export function createReviewUser(userId: string, userName: string): ReviewUser {
  return {
    _id: userId,
    name: userName
  };
}

// ============================================================================
// Query Building Utilities
// ============================================================================

/**
 * Creates MongoDB sort options from ReviewQueryOptions
 * 
 * @param options - Query options with sorting preferences
 * @returns MongoDB sort object
 */
export function createSortOptions(options: ReviewQueryOptions): Record<string, 1 | -1> {
  const { sortBy = 'createdAt', sortOrder = 'desc' } = options;
  const direction = sortOrder === 'asc' ? 1 : -1;
  
  return { [sortBy]: direction };
}

/**
 * Creates MongoDB query filter for reviews
 * 
 * @param productId - Product ID to filter by
 * @param additionalFilters - Additional filter criteria
 * @returns MongoDB filter object
 */
export function createReviewFilter(
  productId: string, 
  additionalFilters: Record<string, any> = {}
): Record<string, any> {
  return {
    productId,
    ...additionalFilters
  };
}

// ============================================================================
// Validation and Sanitization Utilities
// ============================================================================

/**
 * Validates and normalizes query options
 * 
 * @param options - Raw query options
 * @returns Validated ReviewQueryOptions
 */
export function normalizeQueryOptions(options: Partial<ReviewQueryOptions> = {}): ReviewQueryOptions {
  const pagination = createPaginationOptions(options.page, options.limit);
  
  return {
    ...pagination,
    sortBy: options.sortBy || 'createdAt',
    sortOrder: options.sortOrder || 'desc'
  };
}

/**
 * Sanitizes product ID parameter
 * 
 * @param productId - Raw product ID from request
 * @returns Sanitized product ID
 * @throws Error if product ID is invalid
 */
export function sanitizeProductId(productId: any): string {
  if (typeof productId !== 'string' || productId.trim().length === 0) {
    throw new Error('Product ID must be a non-empty string');
  }
  
  return productId.trim();
}

/**
 * Sanitizes user ID parameter
 * 
 * @param userId - Raw user ID from request
 * @returns Sanitized user ID
 * @throws Error if user ID is invalid
 */
export function sanitizeUserId(userId: any): string {
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('User ID must be a non-empty string');
  }
  
  return userId.trim();
}

// ============================================================================
// Date and Time Utilities
// ============================================================================

/**
 * Formats a date for consistent API responses
 * 
 * @param date - Date to format
 * @returns ISO 8601 formatted date string
 */
export function formatDateForResponse(date: Date): string {
  return date.toISOString();
}

/**
 * Creates a date range filter for queries
 * 
 * @param startDate - Start date (optional)
 * @param endDate - End date (optional)
 * @returns MongoDB date range filter
 */
export function createDateRangeFilter(startDate?: Date, endDate?: Date): Record<string, any> {
  const filter: Record<string, any> = {};
  
  if (startDate || endDate) {
    filter.createdAt = {};
    
    if (startDate) {
      filter.createdAt.$gte = startDate;
    }
    
    if (endDate) {
      filter.createdAt.$lte = endDate;
    }
  }
  
  return filter;
}