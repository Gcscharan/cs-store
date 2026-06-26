import mongoose, { Document, Schema } from "mongoose";

/**
 * PushRetry — Retry queue for failed push notifications.
 *
 * When the PushGateway fails to deliver a push notification (for non-token-invalid errors),
 * an entry is inserted into this collection. A polling worker picks up pending retries
 * and attempts re-delivery with exponential backoff.
 *
 * Retry schedule: 1 minute, 5 minutes, 15 minutes, 30 minutes, 1 hour (5 attempts total).
 * After 5 failed attempts, the status transitions to `dead_letter`.
 */

export interface IPushRetry extends Document {
  notificationId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  data: Record<string, any>;
  attempts: number;
  nextAttemptAt: Date;
  lastError?: string;
  status: "pending" | "succeeded" | "dead_letter";
  createdAt: Date;
  updatedAt: Date;
}

const PushRetrySchema = new Schema<IPushRetry>(
  {
    notificationId: {
      type: Schema.Types.ObjectId,
      ref: "Notification",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    nextAttemptAt: {
      type: Date,
      required: true,
    },
    lastError: {
      type: String,
    },
    status: {
      type: String,
      enum: ["pending", "succeeded", "dead_letter"],
      default: "pending",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient polling: find pending retries that are due
PushRetrySchema.index({ status: 1, nextAttemptAt: 1 });

// Index for querying by notification
PushRetrySchema.index({ notificationId: 1 });

// Index for querying by user
PushRetrySchema.index({ userId: 1 });

// TTL: auto-expire retry records 7 days after last update (keeps collection lean).
// Pending retries complete within ~2h; succeeded/dead_letter rows are cleaned up after a week.
PushRetrySchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// TTL: auto-expire retry records 7 days after last update.
// Keeps the collection lean once retries reach a terminal state (succeeded/dead_letter).
// 7 days comfortably exceeds the max retry window (~1h 51m) so in-flight retries are never reaped.
PushRetrySchema.index({ updatedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

const PushRetry = mongoose.model<IPushRetry>("PushRetry", PushRetrySchema);

export default PushRetry;
