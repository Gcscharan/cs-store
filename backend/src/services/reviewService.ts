/**
 * ReviewService - Core service layer for product review management
 * 
 * Provides CRUD operations, business logic validation, rating calculations,
 * and pagination handling for the product reviews system.
 * 
 * Requirements: 2.1, 2.2, 3.1, 3.4, 5.1, 5.2, 6.1, 6.2, 6.3
 */

import { Review } from '../models/Review';
import { User } from '../models/User';
import {
  CreateReviewRequest,
  UpdateReviewRequest,
  ReviewsResponse,
  ReviewWithUser,
  PaginationOptions,
  PaginationMeta,
  RatingStats,
  RatingBreakdown
} from '../types/reviews';
import mongoose from 'mongoose';

export class ReviewService {
  /**
   * Create a new review with uniqueness constraint enforcement
   * Requirements: 2.1, 2.2
   */
  async createReview(
    productId: string,
    userId: string,
    reviewData: CreateReviewRequest
  ): Promise<ReviewWithUser> {
    try {
      // Check for existing review (uniqueness constraint)
      const existingReview = await Review.findOne({ productId, userId });
      if (existingReview) {
        throw new Error('User has already reviewed this product. Use update instead.');
      }

      // Create new review
      const review = new Review({
        productId,
        userId,
        rating: reviewData.rating,
        comment: reviewData.comment,
        images: reviewData.images
      });

      const savedReview = await review.save();
      
      // Return review with user information
      return await this.getReviewWithUser(savedReview);
    } catch (error: any) {
      if (error.code === 11000) {
        // MongoDB duplicate key error
        throw new Error('User has already reviewed this product. Use update instead.');
      }
      throw error;
    }
  }

  /**
   * Get paginated reviews for a product
   * Requirements: 3.1, 3.4
   */
  async getReviews(
    productId: string,
    pagination: PaginationOptions
  ): Promise<ReviewsResponse> {
    const { page = 1, limit = 10 } = pagination;
    const offset = (page - 1) * limit;

    // Get reviews with sorting (newest first)
    const reviews = await Review.find({ productId })
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const totalItems = await Review.countDocuments({ productId });

    // Get reviews with user information
    const reviewsWithUsers = await Promise.all(
      reviews.map(review => this.getReviewWithUser(review))
    );

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limit);
    const paginationMeta: PaginationMeta = {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };

    // Calculate rating statistics
    const stats = await this.calculateRatingStats(productId);

    return {
      reviews: reviewsWithUsers,
      pagination: paginationMeta,
      stats
    };
  }

  /**
   * Update an existing review with ownership validation
   * Requirements: 5.1, 5.2
   */
  async updateReview(
    reviewId: string,
    userId: string,
    updateData: UpdateReviewRequest,
    isAdmin: boolean = false
  ): Promise<ReviewWithUser> {
    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Check ownership (unless admin)
    if (!isAdmin && review.userId !== userId) {
      throw new Error('Unauthorized: You can only update your own reviews');
    }

    // Update the review
    Object.assign(review, updateData);
    const updatedReview = await review.save();

    return await this.getReviewWithUser(updatedReview);
  }

  /**
   * Delete a review with permission checks
   * Requirements: 6.1, 6.2, 6.3
   */
  async deleteReview(
    reviewId: string,
    userId: string,
    isAdmin: boolean = false
  ): Promise<void> {
    // Find the review
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new Error('Review not found');
    }

    // Check permissions (owner or admin)
    if (!isAdmin && review.userId !== userId) {
      throw new Error('Unauthorized: You can only delete your own reviews');
    }

    // Permanently remove the review
    await Review.findByIdAndDelete(reviewId);
  }

  /**
   * Calculate rating statistics for a product
   * Requirements: 3.2, 3.3
   */
  async calculateRatingStats(productId: string): Promise<RatingStats> {
    const pipeline = [
      { $match: { productId } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratings: { $push: '$rating' }
        }
      }
    ];

    const result = await Review.aggregate(pipeline);
    
    if (!result.length) {
      return {
        averageRating: 0,
        totalReviews: 0,
        ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      };
    }

    const { totalReviews, averageRating, ratings } = result[0];

    // Calculate rating breakdown
    const ratingBreakdown: RatingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratings.forEach((rating: number) => {
      ratingBreakdown[rating as keyof RatingBreakdown]++;
    });

    return {
      averageRating: Math.round(averageRating * 100) / 100, // Round to 2 decimal places
      totalReviews,
      ratingBreakdown
    };
  }

  /**
   * Get a review with populated user information
   * Private helper method
   */
  private async getReviewWithUser(review: any): Promise<ReviewWithUser> {
    // Get user information
    const user = await User.findById(review.userId).select('name').lean();
    
    return {
      _id: review._id.toString(),
      productId: review.productId,
      userId: review.userId,
      rating: review.rating,
      comment: review.comment,
      images: review.images,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
      user: {
        _id: user?._id.toString() || review.userId,
        name: user?.name || 'Unknown User'
      }
    };
  }

  /**
   * Get a single review by ID with user information
   */
  async getReviewById(reviewId: string): Promise<ReviewWithUser | null> {
    const review = await Review.findById(reviewId).lean();
    if (!review) {
      return null;
    }
    return await this.getReviewWithUser(review);
  }

  /**
   * Check if a user has already reviewed a product
   */
  async hasUserReviewedProduct(productId: string, userId: string): Promise<boolean> {
    const existingReview = await Review.findOne({ productId, userId });
    return !!existingReview;
  }
}

export const reviewService = new ReviewService();