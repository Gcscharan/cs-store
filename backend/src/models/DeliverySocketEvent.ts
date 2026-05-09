import mongoose, { Document, Schema } from "mongoose";

export interface IDeliverySocketEvent extends Document {
  orderId: mongoose.Types.ObjectId;   // indexed
  riderId: mongoose.Types.ObjectId;   // indexed
  eventName: string;
  payload: {                          // minimal payload only — not full order object
    orderId: string;
    orderStatus: string;
    deliveryStatus: string;
    allowedActions: string[];
    version: number;
    eventId: string;
    timestamp: string;
  };
  timestamp: Date;                    // indexed
  createdAt: Date;                    // TTL index: 24 hours
}

const DeliverySocketEventSchema = new Schema<IDeliverySocketEvent>(
  {
    orderId:   { type: Schema.Types.ObjectId, ref: "Order", required: true },
    riderId:   { type: Schema.Types.ObjectId, ref: "User", required: true },
    eventName: { type: String, required: true },
    payload:   { type: Schema.Types.Mixed, required: true },
    timestamp: { type: Date, required: true },
  },
  { timestamps: true }
);

// Compound indexes for sync_request queries
DeliverySocketEventSchema.index({ riderId: 1, timestamp: 1 });
DeliverySocketEventSchema.index({ orderId: 1, timestamp: 1 });

// TTL: auto-delete after 24 hours
DeliverySocketEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

export const DeliverySocketEvent = mongoose.model<IDeliverySocketEvent>(
  "DeliverySocketEvent",
  DeliverySocketEventSchema
);
