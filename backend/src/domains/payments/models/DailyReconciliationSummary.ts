import mongoose, { Document, Schema } from "mongoose";

export interface IDailyReconciliationSummary extends Document {
  _id: mongoose.Types.ObjectId;
  date: string;                    // YYYY-MM-DD UTC — unique
  totalRuns: number;
  totalScanned: number;
  totalMismatches: number;
  totalAutoFixed: number;
  totalManualReview: number;
  peakMismatchRate: number;
  criticalAnomalyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const DailyReconciliationSummarySchema = new Schema<IDailyReconciliationSummary>(
  {
    date: { type: String, required: true, trim: true },
    totalRuns: { type: Number, required: true, default: 0, min: 0 },
    totalScanned: { type: Number, required: true, default: 0, min: 0 },
    totalMismatches: { type: Number, required: true, default: 0, min: 0 },
    totalAutoFixed: { type: Number, required: true, default: 0, min: 0 },
    totalManualReview: { type: Number, required: true, default: 0, min: 0 },
    peakMismatchRate: { type: Number, required: true, default: 0, min: 0 },
    criticalAnomalyCount: { type: Number, required: true, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

// Unique index on date — one summary document per calendar day (UTC)
DailyReconciliationSummarySchema.index({ date: 1 }, { unique: true });

export const DailyReconciliationSummary = mongoose.model<IDailyReconciliationSummary>(
  "DailyReconciliationSummary",
  DailyReconciliationSummarySchema
);
