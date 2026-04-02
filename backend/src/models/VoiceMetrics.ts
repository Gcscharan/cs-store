/**
 * Voice Metrics Model
 * 
 * Tracks every voice search to measure system intelligence
 * 
 * PURPOSE:
 * - Measure correction accuracy
 * - Identify failure patterns
 * - Track system performance
 * - Enable auto-tuning
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IVoiceMetrics extends Document {
  query: string;              // Original user query
  correctedTo: string;        // Final query after correction
  productId?: string;         // Product clicked (if any)
  correctedProductId?: string; // Product ID from correction mapping
  
  // Outcome
  success: boolean;           // User clicked a product
  isCorrectProduct: boolean;  // User clicked THE CORRECT product (productId === correctedProductId)
  wasCorrected: boolean;      // Correction was applied
  confidence: number;         // Correction confidence (0-1)
  
  // A/B Testing
  variant?: string;           // Experiment variant ('A', 'B', 'control', etc.)
  experimentName?: string;    // Experiment name
  
  // Timing
  latency: number;            // Processing time (ms)
  queueDelay?: number;        // Queue wait time (ms)
  
  // Context
  userId?: string;            // User ID (optional)
  sessionId?: string;         // Session ID
  timestamp: Date;            // When this happened
}

const VoiceMetricsSchema = new Schema<IVoiceMetrics>(
  {
    query: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    correctedTo: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    productId: {
      type: String,
      index: true,
    },
    correctedProductId: {
      type: String,
      index: true,
    },
    success: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    isCorrectProduct: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    wasCorrected: {
      type: Boolean,
      required: true,
      default: false,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0,
    },
    latency: {
      type: Number,
      required: true,
      min: 0,
    },
    queueDelay: {
      type: Number,
      min: 0,
    },
    userId: {
      type: String,
      index: true,
    },
    sessionId: {
      type: String,
    },
    variant: {
      type: String,
      index: true,
    },
    experimentName: {
      type: String,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false, // We use timestamp field instead
  }
);

// Compound indexes for analytics queries
VoiceMetricsSchema.index({ timestamp: -1 }); // Recent metrics
VoiceMetricsSchema.index({ query: 1, success: 1 }); // Query success rate
VoiceMetricsSchema.index({ query: 1, isCorrectProduct: 1 }); // TRUE accuracy
VoiceMetricsSchema.index({ wasCorrected: 1, success: 1 }); // Correction effectiveness
VoiceMetricsSchema.index({ wasCorrected: 1, isCorrectProduct: 1 }); // TRUE correction effectiveness
VoiceMetricsSchema.index({ userId: 1, timestamp: -1 }); // User-specific metrics
VoiceMetricsSchema.index({ variant: 1, timestamp: -1 }); // A/B testing analysis
VoiceMetricsSchema.index({ experimentName: 1, variant: 1 }); // Experiment results

export default mongoose.model<IVoiceMetrics>('VoiceMetrics', VoiceMetricsSchema);
