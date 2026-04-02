/**
 * User Session Model
 * 
 * Phase 5: Session Memory
 * Tracks user session context for "add one more" queries
 * 
 * Example:
 * - User searches "chips" → clicks Lays
 * - User says "add one more" → system knows context
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSession extends Document {
  userId: string;
  sessionId: string;
  lastQuery: string;
  lastProducts: string[]; // Product IDs from last search
  lastClickedProduct?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSessionSchema = new Schema<IUserSession>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    lastQuery: {
      type: String,
      required: true,
    },
    lastProducts: {
      type: [String],
      default: [],
    },
    lastClickedProduct: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient user-session lookups
UserSessionSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

// TTL index - remove sessions older than 24 hours
UserSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export default mongoose.model<IUserSession>('UserSession', UserSessionSchema);
