import mongoose, { Document, Schema } from 'mongoose';

/**
 * PendingDeletion Model
 * 
 * Tracks videos marked for deletion with a 24-hour grace period for rollback safety.
 * Videos are soft-deleted (marked for deletion) when replaced or when product is deleted.
 * Hard deletion from Cloudinary occurs after 24 hours via cleanup job.
 * 
 * Key Features:
 * - 24-hour grace period for rollback
 * - Tracks deletion reason for audit trail
 * - Retry counter for failed deletion attempts
 * - Optional product reference for tracking
 * 
 * Validates: Requirements 8.3
 */
export interface IPendingDeletion extends Document {
  _id: mongoose.Types.ObjectId;
  publicId: string; // Cloudinary publicId
  markedForDeletionAt: Date; // Soft delete timestamp
  reason: 'product_deleted' | 'video_replaced' | 'orphan_cleanup'; // Deletion reason
  productId?: mongoose.Types.ObjectId; // Optional product reference
  retryCount: number; // Track deletion failures
}

const PendingDeletionSchema = new Schema<IPendingDeletion>(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v: string) => !!(v && v.trim().length > 0),
        message: 'PublicId must be a non-empty string',
      },
    },
    markedForDeletionAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    reason: {
      type: String,
      enum: ['product_deleted', 'video_replaced', 'orphan_cleanup'],
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
    },
    retryCount: {
      type: Number,
      default: 0,
      min: [0, 'Retry count cannot be negative'],
    },
  },
  {
    timestamps: false,
  }
);

// Index for efficient cleanup queries
// Query pattern: Find deletions marked >24 hours ago
PendingDeletionSchema.index({ markedForDeletionAt: 1 });

export const PendingDeletion = mongoose.model<IPendingDeletion>(
  'PendingDeletion',
  PendingDeletionSchema
);
