import mongoose, { Document, Schema } from "mongoose";

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  price: number;
  qty: number;
  productName?: string;
  priceAtOrderTime?: number;
  quantity?: number;
  subtotal?: number;
}

export interface IOrderAddress {
  name?: string;          // Recipient name
  phone?: string;         // Recipient phone
  label: string;          // Address label (Home, Office, etc.)
  addressLine: string;    // Full street address
  landmark?: string;      // Optional landmark
  city: string;
  state: string;
  pincode: string;
  postal_district?: string;
  admin_district?: string;
  lat: number;
  lng: number;
}

export interface IUpiDetails {
  vpa: string;
  payeeName: string;
  amount: number;
  currency: "INR";
  transactionNote: string;
  uri: string;
}

export interface IAssignmentHistory {
  riderId: mongoose.Types.ObjectId;
  offeredAt: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  status: "offered" | "accepted" | "rejected";
}

export interface IDeliveryProof {
  type: "otp" | "photo" | "signature";
  value?: string; // OTP value
  url?: string; // Photo/signature URL
  verifiedAt?: Date;
  deliveredBy?: mongoose.Types.ObjectId; // Who completed delivery
}

export interface IStatusHistory {
  status: string;
  deliveryStatus?: string;
  updatedBy: mongoose.Types.ObjectId;
  updatedByRole: "admin" | "delivery" | "system" | "customer";
  timestamp: Date;
  meta?: any; // Additional metadata like reason, location, etc.
}

export interface IRiderLocation {
  lat: number;
  lng: number;
  updatedAt: Date;
}

export interface IEarnings {
  deliveryFee: number;
  tip: number;
  commission: number;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  idempotencyKey?: string;
  items: IOrderItem[];
  itemsTotal?: number;
  deliveryFee?: number;
  discount?: number;
  grandTotal?: number;
  totalAmount: number;
  paymentMethod?: "cod" | "upi" | "card" | "netbanking";
  paymentStatus: "PENDING" | "PAID" | "FAILED" | "pending" | "paid" | "failed" | "refunded";
  paymentReceivedAt?: Date; // Timestamp when payment was confirmed by delivery boy
  orderStatus:
    | "PENDING_PAYMENT"
    | "CONFIRMED"
    | "CREATED"
    | "pending"
    | "confirmed"
    | "created"
    | "assigned"
    | "picked_up"
    | "in_transit"
    | "arrived"
    | "delivered"
    | "cancelled";
  deliveryStatus?: "unassigned" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered" | "cancelled";
  deliveryBoyId?: mongoose.Types.ObjectId;
  assignmentHistory: IAssignmentHistory[];
  address: IOrderAddress;
  upi?: IUpiDetails;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  deliveryProof?: IDeliveryProof;
  deliveryOtp?: string; // 4-digit OTP for verification
  deliveryOtpExpiresAt?: Date;
  confirmedAt?: Date; // When admin accepted
  cancelledBy?: "admin" | "customer" | "system";
  cancelReason?: string;
  riderLocation?: IRiderLocation;
  earnings?: IEarnings;
  history: IStatusHistory[]; // Audit trail of all status changes
  pickedUpAt?: Date;
  inTransitAt?: Date;
  arrivedAt?: Date;
  deliveredAt?: Date;
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
  productName: {
    type: String,
  },
  priceAtOrderTime: {
    type: Number,
    min: 0,
  },
  quantity: {
    type: Number,
    min: 1,
  },
  subtotal: {
    type: Number,
    min: 0,
  },
});

const OrderAddressSchema = new Schema<IOrderAddress>({
  name: { type: String },          // Recipient name
  phone: { type: String },         // Recipient phone
  label: { type: String, required: true },
  addressLine: { type: String, required: true },
  landmark: { type: String },      // Optional landmark
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  postal_district: { type: String },
  admin_district: { type: String },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
});

const UpiDetailsSchema = new Schema<IUpiDetails>({
  vpa: { type: String, required: true },
  payeeName: { type: String, required: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, enum: ["INR"], default: "INR" },
  transactionNote: { type: String, required: true },
  uri: { type: String, required: true },
});

const AssignmentHistorySchema = new Schema<IAssignmentHistory>({
  riderId: { type: Schema.Types.ObjectId, ref: "DeliveryBoy", required: true },
  offeredAt: { type: Date, default: Date.now },
  acceptedAt: { type: Date },
  rejectedAt: { type: Date },
  status: {
    type: String,
    enum: ["offered", "accepted", "rejected"],
    required: true,
  },
});

const DeliveryProofSchema = new Schema<IDeliveryProof>({
  type: { type: String, enum: ["otp", "photo", "signature"], required: true },
  value: { type: String },
  url: { type: String },
  verifiedAt: { type: Date },
  deliveredBy: { type: Schema.Types.ObjectId, ref: "DeliveryBoy" },
});

const StatusHistorySchema = new Schema<IStatusHistory>({
  status: { type: String, required: true },
  deliveryStatus: { type: String },
  updatedBy: { type: Schema.Types.ObjectId, required: true },
  updatedByRole: { type: String, enum: ["admin", "delivery", "system", "customer"], required: true },
  timestamp: { type: Date, default: Date.now },
  meta: { type: Schema.Types.Mixed },
});

const RiderLocationSchema = new Schema<IRiderLocation>({
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

const EarningsSchema = new Schema<IEarnings>({
  deliveryFee: { type: Number, default: 0 },
  tip: { type: Number, default: 0 },
  commission: { type: Number, default: 0 },
});

const OrderSchema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
    },
    items: [OrderItemSchema],
    itemsTotal: {
      type: Number,
      min: 0,
    },
    deliveryFee: {
      type: Number,
      min: 0,
    },
    discount: {
      type: Number,
      min: 0,
    },
    grandTotal: {
      type: Number,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["upi", "cod", "card", "netbanking"],
    },
    paymentStatus: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED", "pending", "paid", "failed", "refunded"],
      default: "PENDING",
    },
    paymentReceivedAt: {
      type: Date,
    },
    orderStatus: {
      type: String,
      enum: [
        "PENDING_PAYMENT",
        "CONFIRMED",
        "CREATED",
        "pending",
        "confirmed",
        "created",
        "assigned",
        "picked_up",
        "in_transit",
        "arrived",
        "delivered",
        "cancelled",
      ],
      default: "CREATED",
    },
    deliveryStatus: {
      type: String,
      enum: ["unassigned", "assigned", "picked_up", "in_transit", "arrived", "delivered", "cancelled"],
      default: "unassigned",
    },
    deliveryBoyId: {
      type: Schema.Types.ObjectId,
      ref: "DeliveryBoy",
    },
    assignmentHistory: [AssignmentHistorySchema],
    address: {
      type: OrderAddressSchema,
      required: true,
    },
    upi: {
      type: UpiDetailsSchema,
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    deliveryProof: DeliveryProofSchema,
    deliveryOtp: {
      type: String,
      length: 4,
    },
    deliveryOtpExpiresAt: {
      type: Date,
    },
    confirmedAt: {
      type: Date,
    },
    cancelledBy: {
      type: String,
      enum: ["admin", "customer", "system"],
    },
    cancelReason: {
      type: String,
    },
    riderLocation: RiderLocationSchema,
    earnings: EarningsSchema,
    history: [StatusHistorySchema],
    pickedUpAt: { type: Date },
    inTransitAt: { type: Date },
    arrivedAt: { type: Date },
    deliveredAt: { type: Date },
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
OrderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

export const Order = mongoose.model<IOrder>("Order", OrderSchema);
