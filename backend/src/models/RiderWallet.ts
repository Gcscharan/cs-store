import mongoose, { Document, Schema } from "mongoose";

export interface IRiderWallet extends Document {
  riderId: mongoose.Types.ObjectId;       // DeliveryBoy._id
  balance: number;                         // Settled, available balance
  pendingBalance: number;                  // Earned but not yet settled
  lastSettlementAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const RiderWalletSchema = new Schema<IRiderWallet>(
  {
    riderId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      required: true,
      unique: true,
      index: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, "Wallet balance cannot be negative"],
    },
    pendingBalance: {
      type: Number,
      default: 0,
      min: [0, "Pending balance cannot be negative"],
    },
    lastSettlementAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const RiderWallet = mongoose.model<IRiderWallet>("RiderWallet", RiderWalletSchema);
