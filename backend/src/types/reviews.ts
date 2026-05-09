/**
 * Core data model interfaces and types for the Product Reviews System
 * 
 * This module defines TypeScript interfaces, types, and validation functions
 * for the reviews system, including Review entities, API request/response formats,
 * pagination, and rating statistics.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 10.1, 10.2
 */

import { ObjectId } from 'mongodb';

// ============================================================================
// Core Entity Interfaces
// ============================================================================

/**
 * Core Review interface representing a product review in the database
 * Requirements: 1.1, 1.4
 */
export interface Review {
  _id: ObjectId;
  productId: string;
  userId: string;
  rating: number;        // 1-5 inclusive, required
  comment?: string;      // Optional text review
  images?: string[];     // Optional array of image URLs
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User interface for review responses (minimal user info)
 * Requirements: 10.2
 */
export interface ReviewUser {
  _id: string;
  name: string;
}

/**
 * Review with populated user information for API responses
 * Requirements: 10.1, 10.2
 */
export interface ReviewWithUser {
  _id: string;
  productId: string;
  userId: string;
  rating: number;
  comment?: string;
  images?: string[];
  createdAt: string;     // ISO 8601 formatted
  updatedAt: string;     // ISO 8601 formatted
  user: ReviewUser;
}

// ============================================================================
// API Request/Response Interfaces
// ============================================================================

/**
 * Request payload for creating a new review
 * Requirements: 1.2, 1.3, 1.4
 */
export interface CreateReviewRequest {
  rating: number;        // Required, 1-5 inclusive
  comment?: string;      // Optional
  images?: string[];     // Optional array of image URLs
}

/**
 * Request payload for updating an existing review
 * Requirements: 1.2, 1.3, 1.4
 */
export interface UpdateReviewRequest {
  rating?: number;       // Optional, 1-5 inclusive if provided
  comment?: string;      // Optional
  images?: string[];     // Optional array of image URLs
}

/**
 * Paginated response for review listings
 * Requirements: 10.1, 10.4
 */
export interface ReviewsResponse {
  reviews: ReviewWithUser[];
  pagination: PaginationMeta;
  stats: RatingStats;
}

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Pagination options for review queries
 */
export interface PaginationOptions {
  page: number;          // Page number (1-based)
  limit: number;         // Items per page
  offset?: number;       // Calculated offset (page-1) * limit
}

/**
 * Pagination metadata for API responses
 * Requirements: 10.4
 */
export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// Rating Statistics Types
// ============================================================================

/**
 * Rating statistics for a product
 * Requirements: 10.5
 */
export interface RatingStats {
  averageRating: number;
  totalReviews: number;
  ratingBreakdown: RatingBreakdown;
}

/**
 * Breakdown of ratings by star level
 * Requirements: 10.5
 */
export interface RatingBreakdown {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

// ============================================================================
// Validation Types and Interfaces
// ============================================================================

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Individual validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Review validation options
 */
export interface ReviewValidationOptions {
  requireRating?: boolean;
  requireComment?: boolean;
  maxCommentLength?: number;
  maxImagesCount?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Valid rating values (1-5 inclusive)
 */
export type ValidRating = 1 | 2 | 3 | 4 | 5;

/**
 * Review creation data (without auto-generated fields)
 */
export type ReviewCreateData = Omit<Review, '_id' | 'createdAt' | 'updatedAt'>;

/**
 * Review update data (partial, without immutable fields)
 */
export type ReviewUpdateData = Partial<Omit<Review, '_id' | 'productId' | 'userId' | 'createdAt' | 'updatedAt'>>;

/**
 * Database query options for reviews
 */
export interface ReviewQueryOptions extends PaginationOptions {
  sortBy?: 'createdAt' | 'rating' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}