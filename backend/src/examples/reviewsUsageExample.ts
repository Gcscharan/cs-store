/**
 * Product Reviews System Usage Examples
 * 
 * This file demonstrates how to use the reviews system API endpoints
 * and provides examples of typical usage patterns.
 */

import { reviewService } from '../services/reviewService';
import { CreateReviewRequest, UpdateReviewRequest } from '../types/reviews';

/**
 * Example: Creating a new review
 */
export async function createReviewExample() {
  const productId = 'product123';
  const userId = 'user456';
  const reviewData: CreateReviewRequest = {
    rating: 5,
    comment: 'Excellent product! Highly recommended.',
    images: [
      'https://example.com/review-image1.jpg',
      'https://example.com/review-image2.jpg'
    ]
  };

  try {
    const newReview = await reviewService.createReview(productId, userId, reviewData);
    console.log('Review created successfully:', newReview);
    return newReview;
  } catch (error) {
    console.error('Failed to create review:', error);
    throw error;
  }
}

/**
 * Example: Getting paginated reviews for a product
 */
export async function getProductReviewsExample() {
  const productId = 'product123';
  const pagination = { page: 1, limit: 10 };

  try {
    const reviewsResponse = await reviewService.getReviews(productId, pagination);
    
    console.log('Reviews retrieved successfully:');
    console.log('- Total reviews:', reviewsResponse.stats.totalReviews);
    console.log('- Average rating:', reviewsResponse.stats.averageRating);
    console.log('- Rating breakdown:', reviewsResponse.stats.ratingBreakdown);
    console.log('- Reviews on this page:', reviewsResponse.reviews.length);
    console.log('- Pagination:', reviewsResponse.pagination);
    
    return reviewsResponse;
  } catch (error) {
    console.error('Failed to get reviews:', error);
    throw error;
  }
}

/**
 * Example: Updating an existing review
 */
export async function updateReviewExample() {
  const reviewId = 'review789';
  const userId = 'user456';
  const updateData: UpdateReviewRequest = {
    rating: 4,
    comment: 'Updated my review - still a great product but found a minor issue.'
  };

  try {
    const updatedReview = await reviewService.updateReview(reviewId, userId, updateData);
    console.log('Review updated successfully:', updatedReview);
    return updatedReview;
  } catch (error) {
    console.error('Failed to update review:', error);
    throw error;
  }
}

/**
 * Example: Calculating rating statistics
 */
export async function getRatingStatsExample() {
  const productId = 'product123';

  try {
    const stats = await reviewService.calculateRatingStats(productId);
    
    console.log('Rating Statistics:');
    console.log('- Average Rating:', stats.averageRating);
    console.log('- Total Reviews:', stats.totalReviews);
    console.log('- 5 Stars:', stats.ratingBreakdown[5]);
    console.log('- 4 Stars:', stats.ratingBreakdown[4]);
    console.log('- 3 Stars:', stats.ratingBreakdown[3]);
    console.log('- 2 Stars:', stats.ratingBreakdown[2]);
    console.log('- 1 Star:', stats.ratingBreakdown[1]);
    
    return stats;
  } catch (error) {
    console.error('Failed to get rating stats:', error);
    throw error;
  }
}

/**
 * Example: Deleting a review
 */
export async function deleteReviewExample() {
  const reviewId = 'review789';
  const userId = 'user456';
  const isAdmin = false;

  try {
    await reviewService.deleteReview(reviewId, userId, isAdmin);
    console.log('Review deleted successfully');
  } catch (error) {
    console.error('Failed to delete review:', error);
    throw error;
  }
}

/**
 * Example: Complete workflow - Create, Read, Update, Delete
 */
export async function completeWorkflowExample() {
  const productId = 'product123';
  const userId = 'user456';

  try {
    console.log('=== Complete Reviews Workflow Example ===');

    // 1. Create a review
    console.log('\n1. Creating a review...');
    const newReview = await reviewService.createReview(productId, userId, {
      rating: 5,
      comment: 'Amazing product!'
    });
    console.log('Created review ID:', newReview._id);

    // 2. Get reviews for the product
    console.log('\n2. Getting product reviews...');
    const reviewsResponse = await reviewService.getReviews(productId, { page: 1, limit: 5 });
    console.log('Found', reviewsResponse.reviews.length, 'reviews');

    // 3. Update the review
    console.log('\n3. Updating the review...');
    const updatedReview = await reviewService.updateReview(newReview._id, userId, {
      rating: 4,
      comment: 'Good product, but could be better'
    });
    console.log('Updated review rating:', updatedReview.rating);

    // 4. Get rating statistics
    console.log('\n4. Getting rating statistics...');
    const stats = await reviewService.calculateRatingStats(productId);
    console.log('Average rating:', stats.averageRating);

    // 5. Delete the review
    console.log('\n5. Deleting the review...');
    await reviewService.deleteReview(newReview._id, userId);
    console.log('Review deleted successfully');

    console.log('\n=== Workflow completed successfully ===');
  } catch (error) {
    console.error('Workflow failed:', error);
    throw error;
  }
}

/**
 * API Endpoint Examples
 * 
 * These show the actual HTTP requests you would make to use the reviews API
 */
export const apiExamples = {
  // GET /api/products/product123/reviews?page=1&limit=10
  getReviews: {
    method: 'GET',
    url: '/api/products/product123/reviews?page=1&limit=10',
    headers: {},
    description: 'Get paginated reviews for a product'
  },

  // POST /api/products/product123/reviews
  createReview: {
    method: 'POST',
    url: '/api/products/product123/reviews',
    headers: {
      'Authorization': 'Bearer <jwt_token>',
      'Content-Type': 'application/json'
    },
    body: {
      rating: 5,
      comment: 'Excellent product!',
      images: ['https://example.com/image1.jpg']
    },
    description: 'Create a new review (requires authentication)'
  },

  // PUT /api/products/product123/reviews/review456
  updateReview: {
    method: 'PUT',
    url: '/api/products/product123/reviews/review456',
    headers: {
      'Authorization': 'Bearer <jwt_token>',
      'Content-Type': 'application/json'
    },
    body: {
      rating: 4,
      comment: 'Updated review comment'
    },
    description: 'Update an existing review (requires authentication and ownership)'
  },

  // DELETE /api/products/product123/reviews/review456
  deleteReview: {
    method: 'DELETE',
    url: '/api/products/product123/reviews/review456',
    headers: {
      'Authorization': 'Bearer <jwt_token>'
    },
    description: 'Delete a review (requires authentication and ownership or admin role)'
  },

  // GET /api/products/product123/reviews/stats
  getRatingStats: {
    method: 'GET',
    url: '/api/products/product123/reviews/stats',
    headers: {},
    description: 'Get rating statistics for a product'
  },

  // GET /api/products/product123/reviews/review456
  getSingleReview: {
    method: 'GET',
    url: '/api/products/product123/reviews/review456',
    headers: {},
    description: 'Get a specific review by ID'
  }
};

/**
 * Response Format Examples
 */
export const responseExamples = {
  // Successful review creation response
  createReviewSuccess: {
    success: true,
    data: {
      _id: "507f1f77bcf86cd799439011",
      productId: "product123",
      userId: "user456",
      rating: 5,
      comment: "Excellent product!",
      images: ["https://example.com/image1.jpg"],
      createdAt: "2024-01-01T00:00:00.000Z",
      updatedAt: "2024-01-01T00:00:00.000Z",
      user: {
        _id: "user456",
        name: "John Doe"
      }
    },
    message: "Review created successfully"
  },

  // Paginated reviews response
  getReviewsSuccess: {
    success: true,
    data: {
      reviews: [
        {
          _id: "507f1f77bcf86cd799439011",
          productId: "product123",
          userId: "user456",
          rating: 5,
          comment: "Great product!",
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          user: { _id: "user456", name: "John Doe" }
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
    }
  },

  // Error response example
  validationError: {
    error: {
      code: "VALIDATION_ERROR",
      message: "Invalid review data",
      details: [
        {
          field: "rating",
          message: "Rating must be between 1 and 5 inclusive",
          value: 6
        }
      ]
    }
  }
};

// Export all examples for easy access
export default {
  createReviewExample,
  getProductReviewsExample,
  updateReviewExample,
  getRatingStatsExample,
  deleteReviewExample,
  completeWorkflowExample,
  apiExamples,
  responseExamples
};