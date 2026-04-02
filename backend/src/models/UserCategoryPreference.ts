/**
 * User Category Preference Model
 * 
 * Phase 5: Category-Level Personalization
 * Tracks user preferences at category level for better generalization
 * 
 * Example:
 * - User clicks multiple chip products → learns user likes "Snacks" category
 * - Next time: boost ALL snack products, not just clicked ones
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IUserCategoryPreference extends Document {
  userId: string;
  category: string;
  score: number;
  productCount: number; // Number of products clicked in this category
  lastUpdated: Date;
  createdAt: Date;
}

const UserCategoryPreferenceSchema = new Schema<IUserCategoryPreference>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    score: {
      type: Number,
      default: 0,
      min: 0,
    },
    productCount: {
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

// Compound index for efficient user-category lookups
UserCategoryPreferenceSchema.index({ userId: 1, category: 1 }, { unique: true });

// Index for finding user's top categories
UserCategoryPreferenceSchema.index({ userId: 1, score: -1 });

// TTL index - remove preferences older than 90 days
UserCategoryPreferenceSchema.index({ lastUpdated: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model<IUserCategoryPreference>('UserCategoryPreference', UserCategoryPreferenceSchema);
