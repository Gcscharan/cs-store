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
  },
  {
    timestamps: true,
  }
);

PaymentIntentSchema.index({ idempotencyKey: 1 }, { unique: true });
PaymentIntentSchema.index({ orderId: 1, attemptNo: 1 }, { unique: true });
PaymentIntentSchema.index({ orderId: 1, createdAt: -1 });
PaymentIntentSchema.index({ gateway: 1, status: 1, isLocked: 1, updatedAt: 1 });

export const PaymentIntent = mongoose.model<IPaymentIntent>(
  "PaymentIntent",
  PaymentIntentSchema
);
