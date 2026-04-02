/**
 * User Preference Model
 * 
 * Phase 5: Personalization Engine
 * Tracks user preferences for personalized ranking
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IUserPreference extends Document {
  userId: string;
  productId: string;
  score: number;
  clickCount: number;
  lastUpdated: Date;
  createdAt: Date;
}

const UserPreferenceSchema = new Schema<IUserPreference>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    productId: {
      type: String,
      required: true,
      index: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    clickCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient user-product lookups
UserPreferenceSchema.index({ userId: 1, productId: 1 }, { unique: true });

// Index for finding user's top preferences
UserPreferenceSchema.index({ userId: 1, score: -1 });

// TTL index - remove preferences older than 90 days
UserPreferenceSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model<IUserPreference>('UserPreference', UserPreferenceSchema);
