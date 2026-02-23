import mongoose, { Document, Schema } from "mongoose";

import type { PaymentIntentStatus } from "../types";
import type { RecoveryExecuteAction } from "../recoveryExecution/types";

export interface IPaymentRecoveryExecutionAudit extends Document {
  _id: mongoose.Types.ObjectId;
  paymentIntentId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  action: RecoveryExecuteAction;
  previousStatus: PaymentIntentStatus;
  newStatus: PaymentIntentStatus;
  adminUserId: mongoose.Types.ObjectId;
  adminEmail: string;
  reason: string;
  executedAt: Date;
  featureFlagVersion: string;
}

const PaymentRecoveryExecutionAuditSchema = new Schema<IPaymentRecoveryExecutionAudit>(
  {
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    action: { type: String, required: true },
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    adminUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    adminEmail: { type: String, required: true },
    reason: { type: String, required: true },
    executedAt: { type: Date, required: true },
    featureFlagVersion: { type: String, required: true },
  },
  {
    timestamps: false,
  }
);

PaymentRecoveryExecutionAuditSchema.index({ paymentIntentId: 1, executedAt: -1 });

export const PaymentRecoveryExecutionAudit = mongoose.model<IPaymentRecoveryExecutionAudit>(
  "PaymentRecoveryExecutionAudit",
  PaymentRecoveryExecutionAuditSchema
);
