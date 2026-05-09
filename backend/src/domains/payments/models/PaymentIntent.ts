import mongoose, { Document, Schema } from "mongoose";

import {
  PaymentGateway,
  PaymentState,
  PaymentIntentStatus,
  PAYMENT_GATEWAYS,
  PAYMENT_STATES,
  PAYMENT_INTENT_STATUSES,
} from "../types";

export interface IPaymentIntent extends Document {
  _id: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  attemptNo: number;
  idempotencyKey: string;
  gateway: PaymentGateway;
  paymentState: PaymentState;
  amount: number;
  currency: string;
  status: PaymentIntentStatus;
  expiresAt: Date;
  gatewayOrderId?: string;
  checkoutPayload?: Record<string, any>;
  isLocked?: boolean;
  lockReason?: string;
  lastScannedAt?: Date;
  gatewayCreateAttemptedAt?: Date; // set before Razorpay API call — prevents duplicate gateway orders on crash-retry
  zombieRecoveryAttempts: number; // incremented atomically before each Razorpay query; capped at 3
  reconciliationErrorCount: number; // incremented on each scan error for this entity (dead-letter threshold: 5)
  version: number; // optimistic lock — incremented on every status transition
  createdAt: Date;
  updatedAt: Date;
}

const PaymentIntentSchema = new Schema<IPaymentIntent>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    attemptNo: { type: Number, required: true, min: 1, max: 3 },
    idempotencyKey: { type: String, required: true, trim: true },
    gateway: { type: String, enum: [...PAYMENT_GATEWAYS], required: true, immutable: true },
    // Canonical payment state machine (required for production-grade idempotency auditing).
    paymentState: { type: String, enum: [...PAYMENT_STATES], required: true, default: "CREATED" },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "INR" },
    status: { type: String, enum: [...PAYMENT_INTENT_STATUSES], required: true, default: "CREATED" },
    expiresAt: { type: Date, required: true, index: true },
    gatewayOrderId: { type: String },
    checkoutPayload: { type: Schema.Types.Mixed },
    isLocked: { type: Boolean, default: false },
    lockReason: { type: String },
    lastScannedAt: { type: Date },
    gatewayCreateAttemptedAt: { type: Date }, // set before Razorpay API call — prevents duplicate gateway orders
    zombieRecoveryAttempts: { type: Number, required: true, default: 0 }, // incremented atomically before each Razorpay query
    reconciliationErrorCount: { type: Number, required: true, default: 0 }, // dead-letter threshold: 5
    version: { type: Number, required: true, default: 0 }, // incremented on every status transition
  },
  {
    timestamps: true,
  }
);

PaymentIntentSchema.index({ idempotencyKey: 1 }, { unique: true });
PaymentIntentSchema.index({ orderId: 1, attemptNo: 1 }, { unique: true });
PaymentIntentSchema.index({ orderId: 1, createdAt: -1 });
PaymentIntentSchema.index({ gateway: 1, status: 1, isLocked: 1, updatedAt: 1 });
// Partial index for scanner — only indexes non-terminal intents, keeps index small
PaymentIntentSchema.index(
  { status: 1, lastScannedAt: 1 },
  {
    partialFilterExpression: {
      status: { $in: ["CREATED", "GATEWAY_ORDER_CREATED", "PAYMENT_PROCESSING", "PAYMENT_RECOVERABLE"] },
    },
  }
);
// Partial index for zombie recovery scanner — only indexes intents missing a gatewayOrderId
PaymentIntentSchema.index(
  { zombieRecoveryAttempts: 1 },
  {
    partialFilterExpression: {
      gatewayOrderId: { $exists: false },
    },
  }
);

export const PaymentIntent = mongoose.model<IPaymentIntent>(
  "PaymentIntent",
  PaymentIntentSchema
);
