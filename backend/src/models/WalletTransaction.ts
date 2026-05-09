import mongoose, { Document, Schema } from "mongoose";

export type WalletTransactionType =
  | "EARNING"          // Delivery fee credited after prepaid delivery
  | "COD_COLLECTED"    // COD amount credited after CodCollection confirmed
  | "SETTLEMENT"       // pendingBalance moved to 0 (payout)
  | "ADJUSTMENT";      // Manual admin correction (always requires reason)

export type WalletTransactionStatus = "PENDING" | "COMPLETED";

export interface IWalletTransaction extends Document {
  riderId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId | null;
  type: WalletTransactionType;
  amount: number;
  status: WalletTransactionStatus;
  note?: string | null;
  createdAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
  {
    riderId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      required: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ["EARNING", "COD_COLLECTED", "SETTLEMENT", "ADJUSTMENT"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Transaction amount cannot be negative"],
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED"],
      default: "PENDING",
    },
    note: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Prevent duplicate EARNING/COD_COLLECTED per order per rider
WalletTransactionSchema.index(
  { riderId: 1, orderId: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      orderId: { $ne: null },
      type: { $in: ["EARNING", "COD_COLLECTED"] },
    },
  }
);

// Immutable — no updates allowed
WalletTransactionSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
  throw new Error("WalletTransaction is immutable");
});

export const WalletTransaction = mongoose.model<IWalletTransaction>(
  "WalletTransaction",
  WalletTransactionSchema
);
