import mongoose, { Document, Schema } from 'mongoose';

/**
 * VideoRegistry Model
 * 
 * Tracks unique videos by hash with reference counting for deduplication.
 * This prevents duplicate video storage when the same video is used for multiple products.
 * 
 * Key Features:
 * - Hash-based deduplication using SHA-256
 * - Reference counting to track usage across products
 * - Atomic operations for thread-safe refCount updates
 * 
 * Validates: Requirements 11.7, 13.2
 */
export interface IVideoRegistry extends Document {
  _id: mongoose.Types.ObjectId;
  hash: string; // SHA-256 hash of video file content
  publicId: string; // Cloudinary publicId for deletion operations
  url: string; // Cloudinary video URL
  thumbnail: string; // Cloudinary thumbnail URL
  duration: number; // Video duration in seconds
  uploadedAt: Date; // Timestamp of initial upload
  referenceCount: number; // Number of products using this video
  lockedForDeletion?: boolean; // Atomic lock to prevent race conditions during deletion
  deletedAt?: Date; // Soft delete marker for audit trail and recovery
}

const VideoRegistrySchema = new Schema<IVideoRegistry>(
  {
    hash: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v: string) => !!(v && v.trim().length > 0),
        message: 'Video hash must be a non-empty string',
      },
    },
    publicId: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: (v: string) => !!(v && v.trim().length > 0),
        message: 'Video publicId must be a non-empty string',
      },
    },
    url: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => !!(v && v.trim().length > 0),
        message: 'Video URL must be a non-empty string',
      },
    },
    thumbnail: {
      type: String,
      required: true,
      validate: {
        validator: (v: string) => !!(v && v.trim().length > 0),
        message: 'Video thumbnail must be a non-empty string',
      },
    },
    duration: {
      type: Number,
      required: true,
      min: [0, 'Video duration cannot be negative'],
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    referenceCount: {
      type: Number,
      required: true,
      default: 1,
      min: [0, 'Reference count cannot be negative'],
    },
    lockedForDeletion: {
      type: Boolean,
      required: false,
      default: false,
    },
    deletedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: false,
  }
);

// Indexes for efficient lookups
// Note: hash and publicId already have unique indexes from schema definition
VideoRegistrySchema.index({ referenceCount: 1 });

// Pre-save validation to ensure refCount never goes negative
VideoRegistrySchema.pre('save', function (next) {
  if ((this as any).referenceCount < 0) {
    next(new Error('referenceCount cannot be negative'));
  } else {
    next();
  }
});

export const VideoRegistry = mongoose.model<IVideoRegistry>(
  'VideoRegistry',
  VideoRegistrySchema
);
