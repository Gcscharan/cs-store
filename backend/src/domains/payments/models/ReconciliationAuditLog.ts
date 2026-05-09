import mongoose, { Document, Schema } from "mongoose";

import type { SubServiceName } from "./ReconciliationRun";

export type AnomalyType =
  | "FALSE_PAID"
  | "PHANTOM_PAID"
  | "ORPHAN_LEDGER"
  | "MISSING_LEDGER"
  | "AMOUNT_MISMATCH"
  | "PARTIAL_CAPTURE"
  | "PI_STATUS_MISMATCH"
  | "ZOMBIE_GATEWAY_RECOVERY"
  | "IDEMPOTENCY_VIOLATION";

export type FixAction = "AUTO_FIXED" | "FLAGGED_FOR_REVIEW" | "NO_OP";
export type AlertSeverity = "CRITICAL" | "WARNING" | "INFO";

export const ANOMALY_TYPES: AnomalyType[] = [
  "FALSE_PAID",
  "PHANTOM_PAID",
  "ORPHAN_LEDGER",
  "MISSING_LEDGER",
  "AMOUNT_MISMATCH",
  "PARTIAL_CAPTURE",
  "PI_STATUS_MISMATCH",
  "ZOMBIE_GATEWAY_RECOVERY",
  "IDEMPOTENCY_VIOLATION",
];

export const FIX_ACTIONS: FixAction[] = ["AUTO_FIXED", "FLAGGED_FOR_REVIEW", "NO_OP"];
export const ALERT_SEVERITIES: AlertSeverity[] = ["CRITICAL", "WARNING", "INFO"];

export interface IReconciliationAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  dedupeKey: string;               // UNIQUE — "{anomalyType}:{entityId}:{action}"
  runId: string;
  category: AnomalyType;
  subService: SubServiceName;
  orderId?: mongoose.Types.ObjectId;
  paymentIntentId?: mongoose.Types.ObjectId;
  action: FixAction;
  alertSeverity: AlertSeverity;
  beforeState: Record<string, unknown>;
  afterState: Record<string, unknown>;
  recordedAt: Date;
  createdAt: Date;
}

const ReconciliationAuditLogSchema = new Schema<IReconciliationAuditLog>(
  {
    dedupeKey: { type: String, required: true, trim: true },
    runId: { type: String, required: true, trim: true },
    category: { type: String, enum: [...ANOMALY_TYPES], required: true },
    subService: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent" },
    action: { type: String, enum: [...FIX_ACTIONS], required: true },
    alertSeverity: { type: String, enum: [...ALERT_SEVERITIES], required: true },
    beforeState: { type: Schema.Types.Mixed, required: true, default: {} },
    afterState: { type: Schema.Types.Mixed, required: true, default: {} },
    recordedAt: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Idempotency of audit writes — prevents duplicate fix actions across runs
ReconciliationAuditLogSchema.index({ dedupeKey: 1 }, { unique: true });

// Query by order in reverse-chronological order
ReconciliationAuditLogSchema.index({ orderId: 1, recordedAt: -1 });

// Query by run in reverse-chronological order
ReconciliationAuditLogSchema.index({ runId: 1, recordedAt: -1 });

// Query by anomaly type in reverse-chronological order
ReconciliationAuditLogSchema.index({ category: 1, recordedAt: -1 });

export const ReconciliationAuditLog = mongoose.model<IReconciliationAuditLog>(
  "ReconciliationAuditLog",
  ReconciliationAuditLogSchema
);
