import mongoose, { Document, Schema } from "mongoose";

export const REFUND_REQUEST_STATUSES = [
  "REQUESTED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
] as const;

export type RefundRequestStatus = (typeof REFUND_REQUEST_STATUSES)[number];

export interface IRefundRequest extends Document {
  _id: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  paymentIntentId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  status: RefundRequestStatus;
  reason?: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const RefundRequestSchema = new Schema<IRefundRequest>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "INR" },
    status: { type: String, enum: [...REFUND_REQUEST_STATUSES], required: true },
    reason: { type: String },
    idempotencyKey: { type: String, required: true, trim: true },
  },
  {
    timestamps: true,
  }
);

RefundRequestSchema.index({ idempotencyKey: 1 }, { unique: true });
RefundRequestSchema.index({ orderId: 1, createdAt: -1 });

export const RefundRequest = mongoose.model<IRefundRequest>("RefundRequest", RefundRequestSchema);
