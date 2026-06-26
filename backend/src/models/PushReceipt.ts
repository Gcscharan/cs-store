import mongoose, { Document, Schema } from "mongoose";

/**
 * PushReceipt — tracks Expo push *receipt* confirmation.
 *
 * When Expo accepts a push it returns a "ticket" with an id. That only means
 * "accepted for delivery" — NOT delivered. Actual delivery (or failure, e.g.
 * a token that went invalid after acceptance) is reported asynchronously via
 * Expo's getReceipts endpoint, which must be polled 15min–several hours later.
 *
 * This model buffers ticket ids so a worker can fetch their receipts and
 * update the notification delivery lifecycle to `delivered` / `failed`.
 *
 * Lifecycle: pending → resolved (delivered/failed) → TTL-pruned.
 */

export interface IPushReceipt extends Document {
  ticketId: string;            // Expo ticket id (== receipt id)
  notificationId?: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  token?: string;              // device token this ticket targeted
  status: "pending" | "delivered" | "failed";
  checkAfter: Date;            // earliest time to poll the receipt
  attempts: number;
  errorCode?: string;          // e.g. DeviceNotRegistered, MessageRateExceeded
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PushReceiptSchema = new Schema<IPushReceipt>(
  {
    ticketId: { type: String, required: true, unique: true },
    notificationId: { type: Schema.Types.ObjectId, ref: "Notification" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    token: { type: String },
    status: {
      type: String,
      enum: ["pending", "delivered", "failed"],
      default: "pending",
      required: true,
    },
    checkAfter: { type: Date, required: true },
    attempts: { type: Number, default: 0, min: 0 },
    errorCode: { type: String },
    lastError: { type: String },
  },
  { timestamps: true, collection: "pushreceipts" }
);

// Polling query: pending receipts whose checkAfter is due.
PushReceiptSchema.index({ status: 1, checkAfter: 1 });

// TTL: prune receipts 3 days after last update (well past the resolution window).
PushReceiptSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });

const PushReceipt = mongoose.model<IPushReceipt>("PushReceipt", PushReceiptSchema);

export default PushReceipt;
