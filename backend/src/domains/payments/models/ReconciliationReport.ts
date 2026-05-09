import mongoose, { Document, Schema } from "mongoose";

import type { SubServiceName } from "./ReconciliationRun";
import { SUB_SERVICE_NAMES } from "./ReconciliationRun";

export interface IReconciliationReport extends Document {
  _id: mongoose.Types.ObjectId;
  runId: string;
  subService: SubServiceName;
  generatedAt: Date;
  totalScanned: number;
  // Anomaly counts by type
  falsePaidCount: number;
  phantomPaidCount: number;
  orphanLedgerCount: number;
  missingLedgerCount: number;
  amountMismatchCount: number;
  partialCaptureCount: number;
  piStatusMismatchCount: number;
  zombieRecoveredCount: number;
  zombieFailedCount: number;
  idempotencyViolationCount: number;
  // Summary
  mismatchCount: number;           // sum of all anomaly counts
  mismatchRate: number;            // mismatchCount / totalScanned * 100
  autoFixedCount: number;
  manualReviewCount: number;
  criticalAnomalyCount: number;    // FALSE_PAID + AMOUNT_MISMATCH counts
  errorCount: number;
  createdAt: Date;
}

const ReconciliationReportSchema = new Schema<IReconciliationReport>(
  {
    runId: { type: String, required: true, trim: true },
    subService: { type: String, enum: [...SUB_SERVICE_NAMES], required: true },
    generatedAt: { type: Date, required: true },
    totalScanned: { type: Number, required: true, default: 0, min: 0 },
    // Anomaly counts by type
    falsePaidCount: { type: Number, required: true, default: 0, min: 0 },
    phantomPaidCount: { type: Number, required: true, default: 0, min: 0 },
    orphanLedgerCount: { type: Number, required: true, default: 0, min: 0 },
    missingLedgerCount: { type: Number, required: true, default: 0, min: 0 },
    amountMismatchCount: { type: Number, required: true, default: 0, min: 0 },
    partialCaptureCount: { type: Number, required: true, default: 0, min: 0 },
    piStatusMismatchCount: { type: Number, required: true, default: 0, min: 0 },
    zombieRecoveredCount: { type: Number, required: true, default: 0, min: 0 },
    zombieFailedCount: { type: Number, required: true, default: 0, min: 0 },
    idempotencyViolationCount: { type: Number, required: true, default: 0, min: 0 },
    // Summary
    mismatchCount: { type: Number, required: true, default: 0, min: 0 },
    mismatchRate: { type: Number, required: true, default: 0, min: 0 },
    autoFixedCount: { type: Number, required: true, default: 0, min: 0 },
    manualReviewCount: { type: Number, required: true, default: 0, min: 0 },
    criticalAnomalyCount: { type: Number, required: true, default: 0, min: 0 },
    errorCount: { type: Number, required: true, default: 0, min: 0 },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Lookup by runId — must be unique
ReconciliationReportSchema.index({ runId: 1 }, { unique: true });

// Query reports in reverse-chronological order
ReconciliationReportSchema.index({ generatedAt: -1 });

// Query reports by sub-service in reverse-chronological order
ReconciliationReportSchema.index({ subService: 1, generatedAt: -1 });

export const ReconciliationReport = mongoose.model<IReconciliationReport>(
  "ReconciliationReport",
  ReconciliationReportSchema
);
