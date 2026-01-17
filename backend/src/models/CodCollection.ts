import mongoose, { Document, Schema } from "mongoose";

export type CodCollectionMode = "CASH" | "UPI";

export interface ICodCollection extends Document {
  orderId: mongoose.Types.ObjectId;
  mode: CodCollectionMode;
  amount: number;
  currency: "INR";
  collectedByActorId: mongoose.Types.ObjectId;
  collectedAt: Date;
  idempotencyKey: string;
  upiRef?: string | null;
  notes?: string | null;
  deviceContext?: {
    deviceId?: string | null;
    appVersion?: string | null;
    platform?: string | null;
  } | null;
  createdAt: Date;
}

const CodCollectionSchema = new Schema<ICodCollection>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ["CASH", "UPI"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["INR"],
      required: true,
      default: "INR",
    },
    collectedByActorId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      required: true,
      index: true,
    },
    collectedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
    },
    upiRef: {
      type: String,
      default: null,
      trim: true,
    },
    notes: {
      type: String,
      default: null,
      trim: true,
    },
    deviceContext: {
      deviceId: { type: String, default: null },
      appVersion: { type: String, default: null },
      platform: { type: String, default: null },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CodCollectionSchema.index({ orderId: 1 }, { unique: true });

CodCollectionSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
  throw new Error("CodCollection is immutable");
});

export const CodCollection = mongoose.model<ICodCollection>(
  "CodCollection",
  CodCollectionSchema
);
