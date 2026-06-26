import mongoose, { Document, Schema } from "mongoose";

/**
 * BulkNotificationJob — Tracks bulk notification dispatch jobs.
 *
 * Created when an admin initiates a bulk notification to a user segment.
 * Tracks progress (total, sent, failed) and supports mid-execution cancellation.
 */

export type BulkJobStatus = "pending" | "processing" | "completed" | "cancelled";

export interface IBulkJobProgress {
  total: number;
  sent: number;
  failed: number;
}

export type TargetSegment = "all_customers" | "all_delivery_partners" | "all_admins" | "custom";

export interface IBulkNotificationJob extends Document {
  title: string;
  body: string;
  category: "order" | "delivery" | "payment" | "account" | "promo";
  deepLink?: string;
  targetSegment: TargetSegment;
  customFilter?: Record<string, any>;
  status: BulkJobStatus;
  progress: IBulkJobProgress;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

const BulkJobProgressSchema = new Schema<IBulkJobProgress>(
  {
    total: { type: Number, required: true, default: 0 },
    sent: { type: Number, required: true, default: 0 },
    failed: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const BulkNotificationJobSchema = new Schema<IBulkNotificationJob>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["order", "delivery", "payment", "account", "promo"],
    },
    deepLink: {
      type: String,
      trim: true,
    },
    targetSegment: {
      type: String,
      required: true,
      enum: ["all_customers", "all_delivery_partners", "all_admins", "custom"],
    },
    customFilter: {
      type: Schema.Types.Mixed,
    },
    status: {
      type: String,
      required: true,
      enum: ["pending", "processing", "completed", "cancelled"],
      default: "pending",
    },
    progress: {
      type: BulkJobProgressSchema,
      required: true,
      default: { total: 0, sent: 0, failed: 0 },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
BulkNotificationJobSchema.index({ status: 1 });
BulkNotificationJobSchema.index({ createdBy: 1, createdAt: -1 });

const BulkNotificationJob = mongoose.model<IBulkNotificationJob>(
  "BulkNotificationJob",
  BulkNotificationJobSchema
);

export default BulkNotificationJob;
