import mongoose, { Document, Schema } from "mongoose";

import type { PaymentIntentStatus } from "../types";

export type PaymentRecoveryAction =
  | "MARK_VERIFYING"
  | "MARK_RECOVERABLE"
  | "LOCK_PERMANENTLY";

export interface IPaymentRecoveryAudit extends Document {
  _id: mongoose.Types.ObjectId;
  paymentIntentId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  previousStatus: PaymentIntentStatus;
  newStatus: PaymentIntentStatus;
  action: PaymentRecoveryAction;
  reason: string;
  adminUserId: mongoose.Types.ObjectId;
  adminEmail: string;
  createdAt: Date;
}

const PaymentRecoveryAuditSchema = new Schema<IPaymentRecoveryAudit>(
  {
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    action: { type: String, required: true },
    reason: { type: String, required: true },
    adminUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    adminEmail: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

PaymentRecoveryAuditSchema.index({ paymentIntentId: 1, createdAt: -1 });

export const PaymentRecoveryAudit = mongoose.model<IPaymentRecoveryAudit>(
  "PaymentRecoveryAudit",
  PaymentRecoveryAuditSchema
);
