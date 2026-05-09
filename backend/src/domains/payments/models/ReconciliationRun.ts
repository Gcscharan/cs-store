import mongoose, { Document, Schema } from "mongoose";

export type ReconciliationRunStatus = "RUNNING" | "COMPLETED" | "FAILED" | "ABANDONED";
export type SubServiceName = "LEDGER" | "ZOMBIE" | "IDEMPOTENCY" | "DAILY_SUMMARY";

export const RECONCILIATION_RUN_STATUSES: ReconciliationRunStatus[] = [
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "ABANDONED",
];

export const SUB_SERVICE_NAMES: SubServiceName[] = [
  "LEDGER",
  "ZOMBIE",
  "IDEMPOTENCY",
  "DAILY_SUMMARY",
];

export interface IReconciliationRun extends Document {
  _id: mongoose.Types.ObjectId;
  runId: string;                 // UUID v4 — stable identifier for this run
  subService: SubServiceName;
  status: ReconciliationRunStatus;
  startedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  abandonedAt?: Date;
  error?: string;
  processedCount: number;
  anomalyCount: number;
  autoFixedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReconciliationRunSchema = new Schema<IReconciliationRun>(
  {
    runId: { type: String, required: true, trim: true },
    subService: { type: String, enum: [...SUB_SERVICE_NAMES], required: true },
    status: {
      type: String,
      enum: [...RECONCILIATION_RUN_STATUSES],
      required: true,
      default: "RUNNING",
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    failedAt: { type: Date },
    abandonedAt: { type: Date },
    error: { type: String },
    processedCount: { type: Number, required: true, default: 0, min: 0 },
    anomalyCount: { type: Number, required: true, default: 0, min: 0 },
    autoFixedCount: { type: Number, required: true, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

// Overlap detection query: find RUNNING runs for a given subService within the overlap window
ReconciliationRunSchema.index({ subService: 1, status: 1, startedAt: -1 });

// Lookup by runId — must be unique
ReconciliationRunSchema.index({ runId: 1 }, { unique: true });

// Optional TTL cleanup index — allows MongoDB to expire old run documents
ReconciliationRunSchema.index({ startedAt: 1 });

export const ReconciliationRun = mongoose.model<IReconciliationRun>(
  "ReconciliationRun",
  ReconciliationRunSchema
);
