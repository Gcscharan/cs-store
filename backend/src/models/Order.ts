import { logger } from '../utils/logger';
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
  gstRate?: number; // GST rate for this item (percentage)
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

export interface IGstBreakdown {
  type: 'CGST_SGST' | 'IGST';
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalGst: number;
}

/**
 * Invoice-specific item details for GST compliance
 * Each line item in the invoice has these fields
 */
export interface IInvoiceItem {
  productId: mongoose.Types.ObjectId;
  productName: string;
  hsnCode: string; // Harmonized System of Nomenclature code
  quantity: number;
  unitPrice: number; // Price per unit before tax
  taxableValue: number; // quantity * unitPrice
  gstRate: number; // GST percentage (e.g., 18)
  cgstAmount: number; // CGST amount for this item
  sgstAmount: number; // SGST amount for this item
  igstAmount: number; // IGST amount for this item
  totalAmount: number; // taxableValue + total tax
}

/**
 * Seller details for invoice
 */
export interface ISellerDetails {
  legalName: string;
  tradeName?: string;
  gstin: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  stateCode: string; // Two-letter state code (e.g., 'MH', 'KA')
  pincode: string;
  phone?: string;
  email?: string;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  idempotencyKey?: string;
  items: IOrderItem[];
  itemsTotal?: number;
  subtotalBeforeTax?: number; // Amount before GST
  gstAmount?: number; // Total GST amount
  gstBreakdown?: IGstBreakdown; // CGST/SGST or IGST breakdown
  totalTax?: number; // Total tax (same as gstAmount for GST)
  deliveryFee?: number;
  distanceKm?: number; // Distance in kilometers (calculated at order time)
  coordsSource?: 'saved'; // Source of coordinates used for calculation
  discount?: number;
  grandTotal?: number;
  totalAmount: number;
  paymentMethod: "cod" | "upi" | "razorpay";
  // PAID is set ONLY by Razorpay payment.captured webhook.
  // Any other transition is a bug.
  paymentStatus:
    | "PENDING"
    | "PAID"
    | "FAILED";
  paymentReceivedAt?: Date; // Timestamp when payment was confirmed by delivery boy
  orderStatus:
    | "PENDING_PAYMENT"
    | "CONFIRMED"
    | "PACKED"
    | "ASSIGNED"
    | "PICKED_UP"
    | "IN_TRANSIT"
    | "OUT_FOR_DELIVERY"
    | "ARRIVED"
    | "DELIVERED"
    | "FAILED"
    | "RETURNED"
    | "CANCELLED"
    | "CREATED";
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
  
  // ============================================
  // INVOICE FIELDS (GST Compliance)
  // ============================================
  invoiceNumber?: string; // Format: INV-YYYY-000001
  invoiceGeneratedAt?: Date; // Timestamp when invoice was generated
  invoiceItems?: IInvoiceItem[]; // Detailed line items for invoice
  sellerDetails?: ISellerDetails; // Seller info at time of invoice
  
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
  gstRate: {
    type: Number,
    min: 0,
    max: 100,
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

const GstBreakdownSchema = new Schema<IGstBreakdown>(
  {
    type: { type: String, enum: ['CGST_SGST', 'IGST'], required: true },
    cgst: { type: Number, min: 0 },
    sgst: { type: Number, min: 0 },
    igst: { type: Number, min: 0 },
    totalGst: { type: Number, required: true, min: 0 },
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
    subtotalBeforeTax: {
      type: Number,
      min: 0,
    },
    gstAmount: {
      type: Number,
      min: 0,
    },
    gstBreakdown: {
      type: GstBreakdownSchema,
    },
    totalTax: {
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
      enum: ["upi", "cod", "razorpay"],
    },
    // PAID is set ONLY by Razorpay payment.captured webhook.
    // Any other transition is a bug.
    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PAID",
        "FAILED",
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
        "ARRIVED",
        "DELIVERED",
        "FAILED",
        "RETURNED",
        "CANCELLED",
        "CREATED",
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
    
    // ============================================
    // INVOICE FIELDS (GST Compliance)
    // ============================================
    invoiceNumber: {
      type: String,
      unique: true,
      sparse: true, // Only indexed if present
      trim: true,
    },
    invoiceGeneratedAt: {
      type: Date,
    },
    invoiceItems: [{
      productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
      productName: { type: String, required: true },
      hsnCode: { type: String, required: true },
      quantity: { type: Number, required: true, min: 1 },
      unitPrice: { type: Number, required: true, min: 0 },
      taxableValue: { type: Number, required: true, min: 0 },
      gstRate: { type: Number, required: true, min: 0 },
      cgstAmount: { type: Number, required: true, min: 0 },
      sgstAmount: { type: Number, required: true, min: 0 },
      igstAmount: { type: Number, required: true, min: 0 },
      totalAmount: { type: Number, required: true, min: 0 },
    }],
    sellerDetails: {
      legalName: { type: String, required: false },
      tradeName: { type: String },
      gstin: { type: String, required: false },
      addressLine1: { type: String, required: false },
      addressLine2: { type: String },
      city: { type: String, required: false },
      state: { type: String, required: false },
      stateCode: { type: String, required: false },
      pincode: { type: String, required: false },
      phone: { type: String },
      email: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

const ALLOWED_PAID_SOURCE = "WEBHOOK_PAYMENT_CAPTURED" as const;
const PAID_SOURCE_OPTION_KEY = "paymentStatusSource" as const;

// Migration-safe orderStatus mapping (lowercase -> uppercase)
const ORDER_STATUS_MIGRATION_MAP: Record<string, string> = {
  "pending": "PENDING_PAYMENT",
  "confirmed": "CONFIRMED",
  "created": "CREATED",
  "assigned": "ASSIGNED",
  "picked_up": "PICKED_UP",
  "in_transit": "IN_TRANSIT",
  "arrived": "ARRIVED",
  "delivered": "DELIVERED",
  "cancelled": "CANCELLED",
};

function normalizeOrderStatus(status: string): string {
  const upper = status.toUpperCase();
  // If already uppercase and valid, return as-is
  const validStatuses = [
    "PENDING_PAYMENT", "CONFIRMED", "PACKED", "ASSIGNED", "PICKED_UP",
    "IN_TRANSIT", "OUT_FOR_DELIVERY", "ARRIVED", "DELIVERED",
    "FAILED", "RETURNED", "CANCELLED", "CREATED"
  ];
  if (validStatuses.includes(upper)) {
    return upper;
  }
  // Try migration map for lowercase values
  return ORDER_STATUS_MIGRATION_MAP[status.toLowerCase()] || status;
}

function extractSetPaymentStatus(update: any): string {
  if (!update || typeof update !== "object") return "";
  const direct = (update as any).paymentStatus;
  if (typeof direct === "string") return direct;
  const set = (update as any).$set;
  const fromSet = set && typeof set === "object" ? (set as any).paymentStatus : undefined;
  return typeof fromSet === "string" ? fromSet : "";
}

function extractSetOrderStatus(update: any): string | null {
  if (!update || typeof update !== "object") return null;
  const direct = (update as any).orderStatus;
  if (typeof direct === "string") return direct;
  const set = (update as any).$set;
  const fromSet = set && typeof set === "object" ? (set as any).orderStatus : undefined;
  return typeof fromSet === "string" ? fromSet : null;
}

function extractPaidSourceFromOptions(opts: any): string {
  if (!opts || typeof opts !== "object") return "";
  const direct = (opts as any)[PAID_SOURCE_OPTION_KEY];
  if (typeof direct === "string") return direct;
  const ctx = (opts as any).context;
  const fromCtx = ctx && typeof ctx === "object" ? (ctx as any)[PAID_SOURCE_OPTION_KEY] : undefined;
  return typeof fromCtx === "string" ? fromCtx : "";
}

function throwIllegalPaidTransition(args: {
  method: string;
  source: string;
  orderId?: any;
}) {
  logger.error("[SECURITY][ILLEGAL_PAID_TRANSITION]", {
    model: "Order",
    method: args.method,
    orderId: args.orderId ? String(args.orderId) : undefined,
    source: args.source,
  });
  const err: any = new Error("Illegal PAID transition");
  err.code = "ILLEGAL_PAID_TRANSITION";
  throw err;
}

async function assertPaidTransitionAllowedOnQuery(this: any): Promise<void> {
  const update = this.getUpdate ? this.getUpdate() : undefined;
  const nextStatus = String(extractSetPaymentStatus(update) || "").toUpperCase();
  if (nextStatus !== "PAID") return;

  const opts = this.getOptions ? this.getOptions() : undefined;
  const source = String(extractPaidSourceFromOptions(opts) || "");
  if (source !== ALLOWED_PAID_SOURCE) {
    throwIllegalPaidTransition({
      method: String(this.op || "update"),
      source,
      orderId: (this.getQuery && (this.getQuery() as any)?._id) || undefined,
    });
  }
}

function normalizeOrderStatusInUpdate(this: any): void {
  const update = this.getUpdate ? this.getUpdate() : undefined;
  if (!update || typeof update !== "object") return;

  const rawStatus = extractSetOrderStatus(update);
  if (!rawStatus) return;

  const normalized = normalizeOrderStatus(rawStatus);
  if (rawStatus !== normalized) {
    logger.info(`[Order][Migration] Normalizing orderStatus in update: "${rawStatus}" -> "${normalized}"`);
    
    // Update in $set if present
    if ((update as any).$set && typeof (update as any).$set === "object") {
      (update as any).$set.orderStatus = normalized;
    } else if ((update as any).orderStatus) {
      // Direct update
      (update as any).orderStatus = normalized;
    }
  }
}

OrderSchema.pre("save", function (next) {
  try {
    // Allow initial orderStatus assignment for new orders (no previous status to transition from)
    if (this.isNew && (this as any).orderStatus) {
      const rawStatus = String((this as any).orderStatus);
      const normalized = normalizeOrderStatus(rawStatus);
      if (rawStatus !== normalized) {
        logger.info(`[Order][Migration] Normalized orderStatus on new order: "${rawStatus}" -> "${normalized}"`);
        (this as any).orderStatus = normalized;
      }
      // Initial status on new order is allowed - skip authorization check
      return next();
    }

    // Migration: Auto-convert lowercase orderStatus to uppercase
    if (this.isModified("orderStatus") && (this as any).orderStatus) {
      const rawStatus = String((this as any).orderStatus);
      const normalized = normalizeOrderStatus(rawStatus);
      
      // Check if this is just a normalization (same status, different case)
      // This is allowed without the authorized symbol
      const isJustNormalization = rawStatus !== normalized;
      
      if (isJustNormalization) {
        logger.info(`[Order][Migration] Normalized orderStatus: "${rawStatus}" -> "${normalized}" (orderId: ${this._id})`);
        (this as any).orderStatus = normalized;
      } else {
        // Not a normalization - check for authorized transition
        const AUTHORIZED_TRANSITION_SYMBOL = Symbol.for("orderStateService.authorizedTransition");
        const isAuthorized = (this as any)[AUTHORIZED_TRANSITION_SYMBOL] === true;
        
        if (!isAuthorized) {
          const err: any = new Error(
            `Order status must be changed via orderStateService.transition(). ` +
            `Direct modification of orderStatus is not allowed. ` +
            `(orderId: ${this._id}, attempted status: ${rawStatus})`
          );
          err.statusCode = 403;
          return next(err);
        }
        
        // Clear the authorization flag after use
        delete (this as any)[AUTHORIZED_TRANSITION_SYMBOL];
      }
    }

    // Payment status security check
    const nextStatus = String((this as any).paymentStatus || "").toUpperCase();
    if (!this.isModified("paymentStatus")) return next();
    if (nextStatus !== "PAID") return next();

    const source = String(((this as any).$locals || {})[PAID_SOURCE_OPTION_KEY] || "");
    if (source !== ALLOWED_PAID_SOURCE) {
      throwIllegalPaidTransition({ method: "save", source, orderId: (this as any)._id });
    }
    return next();
  } catch (e) {
    return next(e as any);
  }
});

OrderSchema.pre("updateOne", function (next) {
  normalizeOrderStatusInUpdate.call(this);
  
  // Block direct orderStatus modifications via updateOne
  // All status transitions must go through orderStateService.transition()
  const update = this.getUpdate ? this.getUpdate() : undefined;
  if (update && typeof update === "object") {
    const rawStatus = extractSetOrderStatus(update);
    if (rawStatus) {
      const normalized = normalizeOrderStatus(rawStatus);
      // Only allow if it's purely a normalization (lowercase -> uppercase of same status)
      // Any actual status change must go through orderStateService
      const err: any = new Error(
        `Order status must be changed via orderStateService.transition(). ` +
        `Direct update of orderStatus via updateOne() is not allowed. ` +
        `(attempted status: ${rawStatus})`
      );
      err.statusCode = 403;
      return next(err);
    }
  }
  
  assertPaidTransitionAllowedOnQuery.call(this)
    .then(() => next())
    .catch((e) => next(e));
});

OrderSchema.pre("updateMany", function (next) {
  normalizeOrderStatusInUpdate.call(this);
  
  // Block direct orderStatus modifications via updateMany
  const update = this.getUpdate ? this.getUpdate() : undefined;
  if (update && typeof update === "object") {
    const rawStatus = extractSetOrderStatus(update);
    if (rawStatus) {
      const err: any = new Error(
        `Order status must be changed via orderStateService.transition(). ` +
        `Direct update of orderStatus via updateMany() is not allowed. ` +
        `(attempted status: ${rawStatus})`
      );
      err.statusCode = 403;
      return next(err);
    }
  }
  
  assertPaidTransitionAllowedOnQuery.call(this)
    .then(() => next())
    .catch((e) => next(e));
});

OrderSchema.pre("findOneAndUpdate", function (next) {
  normalizeOrderStatusInUpdate.call(this);
  
  // Block direct orderStatus modifications via findOneAndUpdate
  const update = this.getUpdate ? this.getUpdate() : undefined;
  if (update && typeof update === "object") {
    const rawStatus = extractSetOrderStatus(update);
    if (rawStatus) {
      const err: any = new Error(
        `Order status must be changed via orderStateService.transition(). ` +
        `Direct update of orderStatus via findOneAndUpdate() is not allowed. ` +
        `(attempted status: ${rawStatus})`
      );
      err.statusCode = 403;
      return next(err);
    }
  }
  
  assertPaidTransitionAllowedOnQuery.call(this)
    .then(() => next())
    .catch((e) => next(e));
});

// Indexes
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ deliveryBoyId: 1, orderStatus: 1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ paymentStatus: 1 });
// Compound index for GST report aggregation (DELIVERED + PAID + date range)
OrderSchema.index({ orderStatus: 1, paymentStatus: 1, createdAt: -1 });
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
