import mongoose, { Document, Schema } from "mongoose";

export interface IOrderEvent extends Document {
  orderId: mongoose.Types.ObjectId;
  type: string;
  payload: any;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderEventSchema = new Schema<IOrderEvent>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    type: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

OrderEventSchema.index({ publishedAt: 1, createdAt: 1 });
OrderEventSchema.index({ orderId: 1, createdAt: -1 });

export const OrderEvent = mongoose.model<IOrderEvent>("OrderEvent", OrderEventSchema);
