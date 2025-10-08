import mongoose, { Document, Schema } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  price: number;
  qty: number;
}

export interface IOrderAddress {
  label: string;
  pincode: string;
  city: string;
  state: string;
  addressLine: string;
  lat: number;
  lng: number;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  orderStatus:
    | "created"
    | "assigned"
    | "picked_up"
    | "in_transit"
    | "delivered"
    | "cancelled";
  deliveryBoyId?: mongoose.Types.ObjectId;
  address: IOrderAddress;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  qty: {
    type: Number,
    required: true,
    min: 1,
  },
});

const OrderAddressSchema = new Schema<IOrderAddress>({
  label: { type: String, required: true },
  pincode: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  addressLine: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
});

const OrderSchema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    items: [OrderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    orderStatus: {
      type: String,
      enum: [
        "created",
        "assigned",
        "picked_up",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      default: "created",
    },
    deliveryBoyId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryBoy",
    },
    address: OrderAddressSchema,
    razorpayOrderId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ deliveryBoyId: 1, orderStatus: 1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ paymentStatus: 1 });

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
