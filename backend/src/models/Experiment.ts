/**
 * Experiment Model
 * 
 * A/B testing engine for voice AI system
 * Enables data-driven optimization
 * 
 * PURPOSE:
 * - Test different configurations
 * - Measure impact on accuracy
 * - Select best behavior automatically
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IExperiment extends Document {
  name: string;                    // Experiment name (e.g., "threshold_test_v1")
  description?: string;            // What are we testing?
  isActive: boolean;               // Is experiment running?
  
  // Variants
  variants: string[];              // ['A', 'B'] or ['control', 'treatment']
  trafficSplit: number;            // 0.5 = 50/50 split
  rolloutPercentage: number;       // Gradual rollout (1% → 100%)
  
  // Configuration per variant
  config: Map<string, any>;        // { A: { threshold: 0.6 }, B: { threshold: 0.7 } }
  
  // Metadata
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  createdBy?: string;              // Admin who created it
  
  // Results (cached)
  results?: {
    lastUpdated: Date;
    variantStats: Map<string, {
      total: number;
      accuracy: number;
      trueAccuracy: number;
    }>;
  };
}

const ExperimentSchema = new Schema<IExperiment>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    variants: {
      type: [String],
      required: true,
      default: ['A', 'B'],
    },
    trafficSplit: {
      type: Number,
      required: true,
      default: 0.5,
      min: 0,
      max: 1,
    },
    rolloutPercentage: {
      type: Number,
      required: true,
      default: 100,
      min: 0,
      max: 100,
    },
    config: {
      type: Map,
      of: Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    createdBy: {
      type: String,
    },
    results: {
      lastUpdated: Date,
      variantStats: {
        type: Map,
        of: Schema.Types.Mixed,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ExperimentSchema.index({ isActive: 1, createdAt: -1 });
ExperimentSchema.index({ name: 1 }, { unique: true });

export default mongoose.model<IExperiment>('Experiment', ExperimentSchema);
