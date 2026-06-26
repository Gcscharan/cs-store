import mongoose, { Schema, Document } from "mongoose";

export interface IDeliveryEarning extends Document {
  deliveryBoyId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  amount: number;
  type: "DELIVERY_COMMISSION" | "TIP" | "BONUS";
  status: "credited" | "pending" | "reversed";
  creditedAt: Date;
  meta?: Record<string, any>;
}

const DeliveryEarningSchema = new Schema<IDeliveryEarning>(
  {
    deliveryBoyId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: ["DELIVERY_COMMISSION", "TIP", "BONUS"],
      default: "DELIVERY_COMMISSION",
    },
    status: {
      type: String,
      enum: ["credited", "pending", "reversed"],
      default: "credited",
    },
    creditedAt: {
      type: Date,
      default: Date.now,
    },
    meta: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

// CRITICAL: Idempotency — one earning per order per delivery boy
DeliveryEarningSchema.index(
  { orderId: 1, deliveryBoyId: 1 },
  { unique: true }
);

// Query by delivery boy + date range (earnings screen)
DeliveryEarningSchema.index({ deliveryBoyId: 1, creditedAt: -1 });

export const DeliveryEarning = mongoose.model<IDeliveryEarning>(
  "DeliveryEarning",
  DeliveryEarningSchema
);
