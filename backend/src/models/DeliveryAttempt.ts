import mongoose, { Document, Schema } from "mongoose";

export type DeliveryAttemptStatus = "SUCCESS" | "FAILED";

export type DeliveryAttemptFailureReason =
  | "CUSTOMER_NOT_AVAILABLE"
  | "CUSTOMER_REJECTED"
  | "ADDRESS_ISSUE";

export interface IDeliveryAttempt extends Document {
  orderId: mongoose.Types.ObjectId;
  routeId: mongoose.Types.ObjectId;
  deliveryBoyId: mongoose.Types.ObjectId;
  status: DeliveryAttemptStatus;
  failureReason?: DeliveryAttemptFailureReason | null;
  failureNotes?: string | null;
  attemptedAt: Date;
  location?: {
    lat: number;
    lng: number;
  };
  createdAt: Date;
}

const DeliveryAttemptSchema = new Schema<IDeliveryAttempt>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },
    routeId: {
      type: Schema.Types.ObjectId,
      ref: "Route",
      required: true,
    },
    deliveryBoyId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryBoy",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED"],
      required: true,
    },
    failureReason: {
      type: String,
      enum: [
        "CUSTOMER_NOT_AVAILABLE",
        "CUSTOMER_REJECTED",
        "ADDRESS_ISSUE",
      ],
      default: null,
    },
    failureNotes: {
      type: String,
      default: null,
      trim: true,
    },
    attemptedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

DeliveryAttemptSchema.index({ orderId: 1 }, { unique: true });

DeliveryAttemptSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function () {
  throw new Error("DeliveryAttempt is immutable");
});

export const DeliveryAttempt = mongoose.model<IDeliveryAttempt>(
  "DeliveryAttempt",
  DeliveryAttemptSchema
);
