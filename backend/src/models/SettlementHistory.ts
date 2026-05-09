import mongoose, { Document, Schema } from "mongoose";

export interface ISettlementHistory extends Document {
  riderId: mongoose.Types.ObjectId;
  amount: number;
  settledAt: Date;
  transactionIds: mongoose.Types.ObjectId[];
  note?: string | null;
  createdAt: Date;
}

const SettlementHistorySchema = new Schema<ISettlementHistory>(
  {
    riderId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      required: true,
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    settledAt: { type: Date, required: true, default: Date.now },
    transactionIds: [{ type: Schema.Types.ObjectId, ref: "WalletTransaction" }],
    note: { type: String, default: null, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Immutable
SettlementHistorySchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
  throw new Error("SettlementHistory is immutable");
});

export const SettlementHistory = mongoose.model<ISettlementHistory>(
  "SettlementHistory",
  SettlementHistorySchema
);
