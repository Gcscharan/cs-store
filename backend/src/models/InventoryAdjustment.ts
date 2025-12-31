import mongoose, { Document, Schema } from "mongoose";

export type InventoryAdjustmentReason = "CANCELLED" | "RETURNED";
export type InventoryAdjustmentType = "RESTORE";

export interface IInventoryAdjustmentItem {
  productId: mongoose.Types.ObjectId;
  qty: number;
}

export interface IInventoryAdjustment extends Document {
  orderId: mongoose.Types.ObjectId;
  reason: InventoryAdjustmentReason;
  type: InventoryAdjustmentType;
  uniqueKey: string;
  items: IInventoryAdjustmentItem[];
  createdAt: Date;
  updatedAt: Date;
}

const InventoryAdjustmentItemSchema = new Schema<IInventoryAdjustmentItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const InventoryAdjustmentSchema = new Schema<IInventoryAdjustment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    reason: { type: String, enum: ["CANCELLED", "RETURNED"], required: true },
    type: { type: String, enum: ["RESTORE"], required: true },
    uniqueKey: { type: String, required: true },
    items: { type: [InventoryAdjustmentItemSchema], default: [] },
  },
  { timestamps: true }
);

InventoryAdjustmentSchema.index({ uniqueKey: 1 }, { unique: true });
InventoryAdjustmentSchema.index({ orderId: 1, createdAt: -1 });

export const InventoryAdjustment = mongoose.model<IInventoryAdjustment>(
  "InventoryAdjustment",
  InventoryAdjustmentSchema
);
