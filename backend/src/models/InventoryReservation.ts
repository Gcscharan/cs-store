import mongoose, { Document, Schema } from "mongoose";

export type InventoryReservationStatus =
  | "ACTIVE"
  | "COMMITTED"
  | "RELEASED"
  | "EXPIRED";

export interface IInventoryReservation extends Document {
  orderId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  qty: number;
  status: InventoryReservationStatus;
  expiresAt: Date;
  committedAt?: Date;
  releasedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryReservationSchema = new Schema<IInventoryReservation>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    qty: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      enum: ["ACTIVE", "COMMITTED", "RELEASED", "EXPIRED"],
      default: "ACTIVE",
      index: true,
    },
    expiresAt: { type: Date, required: true, index: true },
    committedAt: { type: Date },
    releasedAt: { type: Date },
  },
  { timestamps: true }
);

InventoryReservationSchema.index(
  { orderId: 1, productId: 1 },
  { unique: true }
);

InventoryReservationSchema.index({ status: 1, expiresAt: 1 });

export const InventoryReservation = mongoose.model<IInventoryReservation>(
  "InventoryReservation",
  InventoryReservationSchema
);
