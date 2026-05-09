import mongoose, { Document, Schema } from 'mongoose';

/**
 * TemporaryUpload Model
 * 
 * Tracks video uploads not yet associated with saved products to prevent orphans.
 * Videos are marked as 'temporary' on upload and 'permanent' when a product is saved.
 * Orphaned temporary uploads (>2 hours old) are automatically cleaned up.
 * 
 * Key Features:
 * - Tracks upload status (temporary/permanent)
 * - Records upload timestamp for age-based cleanup
 * - Links to admin user for audit trail
 * 
 * Validates: Requirements 11.7, 8.3
 */
export interface ITemporaryUpload extends Document {
  _id: mongoose.Types.ObjectId;
  publicId: string; // Cloudinary publicId
  uploadedAt: Date; // Upload timestamp
  status: 'temporary' | 'permanent'; // Upload status
  uploadedBy: mongoose.Types.ObjectId; // Admin user ID
}

const TemporaryUploadSchema = new Schema<ITemporaryUpload>(
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
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['temporary', 'permanent'],
      required: true,
      default: 'temporary',
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index for efficient cleanup queries
// Query pattern: Find temporary uploads older than 2 hours
TemporaryUploadSchema.index({ status: 1, uploadedAt: 1 });

export const TemporaryUpload = mongoose.model<ITemporaryUpload>(
  'TemporaryUpload',
  TemporaryUploadSchema
);
