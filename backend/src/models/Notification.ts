import mongoose, { Document, Schema } from "mongoose";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  message: string;
  body?: string;
  eventType?: string;
  meta?: Record<string, any>;
  type?: "info" | "delivery_otp" | "order_update" | "general";
  category?: "order" | "delivery" | "payment" | "account" | "promo";
  priority?: "high" | "normal" | "low";
  isRead: boolean;
  orderId?: mongoose.Types.ObjectId;
  deepLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    body: {
      type: String,
    },
    eventType: {
      type: String,
      trim: true,
    },
    meta: {
      type: Schema.Types.Mixed,
    },
    type: {
      type: String,
      enum: ["info", "delivery_otp", "order_update", "general"],
      default: "general",
    },
    category: {
      type: String,
      enum: ["order", "delivery", "payment", "account", "promo"],
    },
    priority: {
      type: String,
      enum: ["high", "normal", "low"],
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    deepLink: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

const Notification = mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;
