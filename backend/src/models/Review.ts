import mongoose, { Document, Schema } from "mongoose";

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;
  productId: string;
  userId: string;
  rating: number; // 1-5 inclusive, required
  comment?: string; // Optional text review
  images?: string[]; // Optional array of image URLs
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    productId: {
      type: String,
      required: [true, "Product ID is required"],
      trim: true,
      index: true, // Individual index for productId queries
    },
    userId: {
      type: String,
      required: [true, "User ID is required"],
      trim: true,
      index: true, // Individual index for userId queries
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"],
      validate: {
        validator: function(value: number) {
          return Number.isInteger(value) && value >= 1 && value <= 5;
        },
        message: "Rating must be an integer between 1 and 5"
      }
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
    images: [{
      type: String,
      trim: true,
      validate: {
        validator: function(url: string) {
          // Basic URL validation
          try {
            new URL(url);
            return true;
          } catch {
            return false;
          }
        },
        message: "Invalid image URL format"
      }
    }],
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt
  }
);

// Performance-critical indexes as specified in requirements
// Compound index for uniqueness constraint (one review per user per product)
ReviewSchema.index(
  { productId: 1, userId: 1 }, 
  { 
    unique: true,
    name: "productId_userId_unique"
  }
);

// Index for sorting by creation date (newest first)
ReviewSchema.index(
  { createdAt: -1 },
  { name: "createdAt_desc" }
);

// Compound index for efficient product review queries with sorting
ReviewSchema.index(
  { productId: 1, createdAt: -1 },
  { name: "productId_createdAt_desc" }
);

export const Review = mongoose.model<IReview>("Review", ReviewSchema);