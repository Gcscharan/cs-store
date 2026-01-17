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
  amount: number;
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
  otpVerifiedAt?: Date;
  photoUrl?: string;
  signature?: string;
  geo?: {
    lat?: number;
    lng?: number;
  };
  deviceId?: string;
  deliveredBy?: mongoose.Types.ObjectId; // Who completed delivery
}

export interface IStatusHistory {
  from?: string;
  to?: string;
  actorRole?: "CUSTOMER" | "DELIVERY_PARTNER" | "ADMIN";
  actorId?: string;
  at?: Date;
  meta?: any;
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

export interface IEstimatedDeliveryWindow {
  start: Date;
  end: Date;
  confidence: "high" | "medium";
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  idempotencyKey?: string;
  items: IOrderItem[];
  itemsTotal?: number;
  deliveryFee?: number;
  distanceKm?: number; // Distance in kilometers (calculated at order time)
  coordsSource?: 'saved'; // Source of coordinates used for calculation
  discount?: number;
  grandTotal?: number;
  totalAmount: number;
  paymentMethod: "cod" | "upi";
  paymentStatus:
    | "PENDING"
    | "AWAITING_UPI_APPROVAL"
    | "PAID"
    | "FAILED"
    | "pending"
    | "paid"
    | "failed"
    | "refunded";
  paymentReceivedAt?: Date; // Timestamp when payment was confirmed by delivery boy
  orderStatus:
    | "PENDING_PAYMENT"
    | "CONFIRMED"
    | "PACKED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "FAILED"
    | "RETURNED"
    | "CANCELLED"
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
  deliveryPartnerId?: mongoose.Types.ObjectId;
  assignmentHistory: IAssignmentHistory[];
  address: IOrderAddress;
  upi?: IUpiDetails;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  deliveryProof?: IDeliveryProof;
  deliveryOtp?: string; // 4-digit OTP for verification
  deliveryOtpGeneratedAt?: Date;
  deliveryOtpExpiresAt?: Date;
  deliveryOtpIssuedTo?: mongoose.Types.ObjectId;
  failureReasonCode?: string;
  failureNotes?: string;
  returnReason?: string;
  confirmedAt?: Date; // When admin accepted
  packedAt?: Date;
  outForDeliveryAt?: Date;
  failedAt?: Date;
  returnedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: "admin" | "customer" | "system";
  cancelReason?: string;
  riderLocation?: IRiderLocation;
  earnings?: IEarnings;
  history: IStatusHistory[]; // Audit trail of all status changes
  pickedUpAt?: Date;
  inTransitAt?: Date;
  arrivedAt?: Date;
  deliveredAt?: Date;
  estimatedDeliveryWindow?: IEstimatedDeliveryWindow;
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
  amount: { type: Number, required: true, min: 0 },
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
  otpVerifiedAt: { type: Date },
  photoUrl: { type: String },
  signature: { type: String },
  geo: {
    lat: { type: Number },
    lng: { type: Number },
  },
  deviceId: { type: String },
  deliveredBy: { type: Schema.Types.ObjectId, ref: "DeliveryBoy" },
});

const StatusHistorySchema = new Schema<IStatusHistory>({
  from: { type: String },
  to: { type: String },
  actorRole: {
    type: String,
    enum: ["CUSTOMER", "DELIVERY_PARTNER", "ADMIN"],
  },
  actorId: { type: String },
  at: { type: Date, default: Date.now },
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

const EstimatedDeliveryWindowSchema = new Schema<IEstimatedDeliveryWindow>(
  {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    confidence: { type: String, enum: ["high", "medium"], required: true },
  },
  { _id: false }
);

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
    distanceKm: {
      type: Number,
      min: 0,
    },
    coordsSource: {
      type: String,
      enum: ['saved'],
      default: 'saved',
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
      enum: ["upi", "cod"],
    },
    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "AWAITING_UPI_APPROVAL",
        "PAID",
        "FAILED",
        "pending",
        "paid",
        "failed",
        "refunded",
      ],
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
        "PACKED",
        "ASSIGNED",
        "PICKED_UP",
        "IN_TRANSIT",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "FAILED",
        "RETURNED",
        "CANCELLED",
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
    deliveryPartnerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
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
    deliveryOtpGeneratedAt: { type: Date },
    deliveryOtpExpiresAt: {
      type: Date,
    },
    deliveryOtpIssuedTo: { type: Schema.Types.ObjectId, ref: "DeliveryBoy" },
    failureReasonCode: {
      type: String,
      trim: true,
    },
    failureNotes: {
      type: String,
      trim: true,
    },
    returnReason: {
      type: String,
      trim: true,
    },
    confirmedAt: {
      type: Date,
    },
    packedAt: { type: Date },
    outForDeliveryAt: { type: Date },
    failedAt: { type: Date },
    returnedAt: { type: Date },
    cancelledAt: { type: Date },
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
    estimatedDeliveryWindow: { type: EstimatedDeliveryWindowSchema, required: false },
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
