import mongoose, { Document, Schema } from "mongoose";

import { LedgerEventType, LEDGER_EVENT_TYPES, PaymentGateway, PAYMENT_GATEWAYS } from "../types";

export interface ILedgerEntry extends Document {
  _id: mongoose.Types.ObjectId;
  paymentIntentId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  gateway: PaymentGateway;
  eventType: LedgerEventType;
  refundId?: string;
  amount: number;
  currency: string;
  gatewayEventId: string;
  dedupeKey: string;
  occurredAt?: Date;
  recordedAt: Date;
  raw?: any;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerEntrySchema = new Schema<ILedgerEntry>(
  {
    paymentIntentId: { type: Schema.Types.ObjectId, ref: "PaymentIntent", required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    gateway: { type: String, enum: [...PAYMENT_GATEWAYS], required: true },
    eventType: { type: String, enum: [...LEDGER_EVENT_TYPES], required: true },
    refundId: { type: String, trim: true },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: function (this: any, v: number) {
          const eventType = String(this?.eventType || "").toUpperCase();
          const n = Number(v);
          if (!Number.isFinite(n)) return false;
          if (eventType === "REFUND") return n < 0;
          return n >= 0;
        },
      },
    },
    currency: { type: String, required: true, default: "INR" },
    gatewayEventId: { type: String, required: true, trim: true },
    dedupeKey: { type: String, required: true, trim: true },
    occurredAt: { type: Date },
    recordedAt: { type: Date, required: true, default: Date.now },
    raw: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

LedgerEntrySchema.index({ dedupeKey: 1 }, { unique: true });
LedgerEntrySchema.index({ orderId: 1, recordedAt: -1 });
LedgerEntrySchema.index({ paymentIntentId: 1, recordedAt: -1 });

LedgerEntrySchema.index({ refundId: 1 }, { sparse: true });

export const LedgerEntry = mongoose.model<ILedgerEntry>("LedgerEntry", LedgerEntrySchema);
