import mongoose, { Document, Schema } from "mongoose";

export type OutboxStatus = "PENDING" | "DISPATCHING" | "DISPATCHED" | "FAILED" | "DEAD_LETTER";

export interface IOutboxEvent extends Document {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  actor: any;
  source: string;
  data: any;
  status: OutboxStatus;
  attempts: number;
  deliveryAttempts: number;   // counts actual deliverToSubscribers() calls
  lastAttemptAt?: Date;       // when last delivery was attempted
  lockedAt?: Date;
  lockedBy?: string;
  nextAttemptAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OutboxEventSchema = new Schema<IOutboxEvent>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    version: { type: Number, required: true },
    occurredAt: { type: String, required: true },
    actor: { type: Schema.Types.Mixed, required: true },
    source: { type: String, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ["PENDING", "DISPATCHING", "DISPATCHED", "FAILED", "DEAD_LETTER"],
      default: "PENDING",
      index: true,
    },
    attempts: { type: Number, default: 0 },
    deliveryAttempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
    lockedAt: { type: Date },
    lockedBy: { type: String },
    nextAttemptAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true }
);

OutboxEventSchema.index({ status: 1, nextAttemptAt: 1, occurredAt: 1 });
OutboxEventSchema.index({ lockedAt: 1 });

export const OutboxEvent = mongoose.model<IOutboxEvent>("OutboxEvent", OutboxEventSchema);
