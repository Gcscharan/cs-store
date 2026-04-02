/**
 * Voice Correction Model
 * 
 * Stores learned corrections from user behavior
 * Supports both user-specific and global learning
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceCorrection extends Document {
  wrong: string;              // User's input (normalized)
  correct: string;            // Correct product name
  productId: string;          // Product ID
  userId?: string;            // User ID (null for global)
  count: number;              // Times this correction was observed
  confidence: number;         // Confidence score (0-1)
  validationScore: number;    // Data quality score (0-1)
  source: 'user' | 'global';  // Source of learning
  lastUsed: Date;             // Last time used
  createdAt: Date;
  updatedAt: Date;
}

const VoiceCorrectionSchema = new Schema<IVoiceCorrection>(
  {
    wrong: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    correct: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    productId: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: String,
      index: true,
      sparse: true, // Allow null for global corrections
    },
    count: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    confidence: {
      type: Number,
      required: true,
      default: 0.7,
      min: 0,
      max: 1,
    },
    validationScore: {
      type: Number,
      required: true,
      default: 0.8,
      min: 0,
      max: 1,
    },
    source: {
      type: String,
      enum: ['user', 'global'],
      required: true,
      default: 'user',
    },
    lastUsed: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
VoiceCorrectionSchema.index({ wrong: 1, userId: 1 }, { unique: true, sparse: true });
VoiceCorrectionSchema.index({ wrong: 1, source: 1 });
VoiceCorrectionSchema.index({ confidence: -1, count: -1 });

// 🚨 PRODUCTION INDEXES (MANDATORY)
VoiceCorrectionSchema.index({ wrong: 1, count: -1 }); // Fast lookup by popularity
VoiceCorrectionSchema.index({ updatedAt: -1 }); // Recent corrections
VoiceCorrectionSchema.index({ userId: 1, confidence: -1 }); // User-specific high-confidence
VoiceCorrectionSchema.index({ source: 1, validationScore: -1 }); // Global quality corrections

// Methods
VoiceCorrectionSchema.methods.incrementUsage = function() {
  this.count += 1;
  this.confidence = Math.min(0.98, this.confidence + 0.02);
  this.lastUsed = new Date();
  this.validationScore = this.calculateValidationScore();
  return this.save();
};

VoiceCorrectionSchema.methods.calculateValidationScore = function(): number {
  let score = 0.5;
  
  // More usage = higher quality
  score += Math.min(0.3, this.count * 0.05);
  
  // Recent usage = higher quality
  const daysSinceUse = (Date.now() - this.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
  score += Math.max(0, 0.2 - daysSinceUse * 0.01);
  
  return Math.min(1, score);
};

export default mongoose.model<IVoiceCorrection>('VoiceCorrection', VoiceCorrectionSchema);
