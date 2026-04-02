/**
 * Product Click Model
 * 
 * Tracks user clicks for popularity ranking
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IProductClick extends Document {
  productId: string;
  productName: string;
  userId: string;
  query: string;              // Search query that led to click
  isVoice: boolean;           // Was it voice search?
  timestamp: Date;
  sessionId?: string;         // Optional session tracking
}

const ProductClickSchema = new Schema<IProductClick>(
  {
    productId: {
      type: String,
      required: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    query: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    isVoice: {
      type: Boolean,
      required: true,
      default: false,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    sessionId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: false, // We use timestamp field instead
  }
);

// Compound indexes
ProductClickSchema.index({ productId: 1, timestamp: -1 });
ProductClickSchema.index({ userId: 1, timestamp: -1 });
ProductClickSchema.index({ query: 1, productId: 1 });

// 🚨 PRODUCTION INDEXES (MANDATORY)
ProductClickSchema.index({ productId: 1 }); // Fast product lookup
ProductClickSchema.index({ query: 1 }); // Fast query lookup
ProductClickSchema.index({ timestamp: -1 }); // Recent clicks
ProductClickSchema.index({ isVoice: 1, timestamp: -1 }); // Voice-specific analytics

export default mongoose.model<IProductClick>('ProductClick', ProductClickSchema);
