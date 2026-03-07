"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const OrderItemSchema = new mongoose_1.Schema({
    productId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
const OrderAddressSchema = new mongoose_1.Schema({
    name: { type: String }, // Recipient name
    phone: { type: String }, // Recipient phone
    label: { type: String, required: true },
    addressLine: { type: String, required: true },
    landmark: { type: String }, // Optional landmark
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    postal_district: { type: String },
    admin_district: { type: String },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
});
const UpiDetailsSchema = new mongoose_1.Schema({
    vpa: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
});
const AssignmentHistorySchema = new mongoose_1.Schema({
    riderId: { type: mongoose_1.Schema.Types.ObjectId, ref: "DeliveryBoy", required: true },
    offeredAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date },
    rejectedAt: { type: Date },
    status: {
        type: String,
        enum: ["offered", "accepted", "rejected"],
        required: true,
    },
});
const DeliveryProofSchema = new mongoose_1.Schema({
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
    deliveredBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "DeliveryBoy" },
});
const StatusHistorySchema = new mongoose_1.Schema({
    from: { type: String },
    to: { type: String },
    actorRole: {
        type: String,
        enum: ["CUSTOMER", "DELIVERY_PARTNER", "ADMIN"],
    },
    actorId: { type: String },
    at: { type: Date, default: Date.now },
    meta: { type: mongoose_1.Schema.Types.Mixed },
});
const RiderLocationSchema = new mongoose_1.Schema({
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now },
});
const EarningsSchema = new mongoose_1.Schema({
    deliveryFee: { type: Number, default: 0 },
    tip: { type: Number, default: 0 },
    commission: { type: Number, default: 0 },
});
const EstimatedDeliveryWindowSchema = new mongoose_1.Schema({
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    confidence: { type: String, enum: ["high", "medium"], required: true },
}, { _id: false });
const GstBreakdownSchema = new mongoose_1.Schema({
    type: { type: String, enum: ['CGST_SGST', 'IGST'], required: true },
    cgst: { type: Number, min: 0 },
    sgst: { type: Number, min: 0 },
    igst: { type: Number, min: 0 },
    totalGst: { type: Number, required: true, min: 0 },
}, { _id: false });
const OrderSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "DeliveryBoy",
    },
    deliveryPartnerId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
    deliveryOtpIssuedTo: { type: mongoose_1.Schema.Types.ObjectId, ref: "DeliveryBoy" },
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
            productId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Product", required: true },
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
}, {
    timestamps: true,
});
const ALLOWED_PAID_SOURCE = "WEBHOOK_PAYMENT_CAPTURED";
const PAID_SOURCE_OPTION_KEY = "paymentStatusSource";
// Migration-safe orderStatus mapping (lowercase -> uppercase)
const ORDER_STATUS_MIGRATION_MAP = {
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
function normalizeOrderStatus(status) {
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
function extractSetPaymentStatus(update) {
    if (!update || typeof update !== "object")
        return "";
    const direct = update.paymentStatus;
    if (typeof direct === "string")
        return direct;
    const set = update.$set;
    const fromSet = set && typeof set === "object" ? set.paymentStatus : undefined;
    return typeof fromSet === "string" ? fromSet : "";
}
function extractSetOrderStatus(update) {
    if (!update || typeof update !== "object")
        return null;
    const direct = update.orderStatus;
    if (typeof direct === "string")
        return direct;
    const set = update.$set;
    const fromSet = set && typeof set === "object" ? set.orderStatus : undefined;
    return typeof fromSet === "string" ? fromSet : null;
}
function extractPaidSourceFromOptions(opts) {
    if (!opts || typeof opts !== "object")
        return "";
    const direct = opts[PAID_SOURCE_OPTION_KEY];
    if (typeof direct === "string")
        return direct;
    const ctx = opts.context;
    const fromCtx = ctx && typeof ctx === "object" ? ctx[PAID_SOURCE_OPTION_KEY] : undefined;
    return typeof fromCtx === "string" ? fromCtx : "";
}
function throwIllegalPaidTransition(args) {
    console.error("[SECURITY][ILLEGAL_PAID_TRANSITION]", {
        model: "Order",
        method: args.method,
        orderId: args.orderId ? String(args.orderId) : undefined,
        source: args.source,
    });
    const err = new Error("Illegal PAID transition");
    err.code = "ILLEGAL_PAID_TRANSITION";
    throw err;
}
async function assertPaidTransitionAllowedOnQuery() {
    const update = this.getUpdate ? this.getUpdate() : undefined;
    const nextStatus = String(extractSetPaymentStatus(update) || "").toUpperCase();
    if (nextStatus !== "PAID")
        return;
    const opts = this.getOptions ? this.getOptions() : undefined;
    const source = String(extractPaidSourceFromOptions(opts) || "");
    if (source !== ALLOWED_PAID_SOURCE) {
        throwIllegalPaidTransition({
            method: String(this.op || "update"),
            source,
            orderId: (this.getQuery && this.getQuery()?._id) || undefined,
        });
    }
}
function normalizeOrderStatusInUpdate() {
    const update = this.getUpdate ? this.getUpdate() : undefined;
    if (!update || typeof update !== "object")
        return;
    const rawStatus = extractSetOrderStatus(update);
    if (!rawStatus)
        return;
    const normalized = normalizeOrderStatus(rawStatus);
    if (rawStatus !== normalized) {
        console.log(`[Order][Migration] Normalizing orderStatus in update: "${rawStatus}" -> "${normalized}"`);
        // Update in $set if present
        if (update.$set && typeof update.$set === "object") {
            update.$set.orderStatus = normalized;
        }
        else if (update.orderStatus) {
            // Direct update
            update.orderStatus = normalized;
        }
    }
}
OrderSchema.pre("save", function (next) {
    try {
        // Allow initial orderStatus assignment for new orders (no previous status to transition from)
        if (this.isNew && this.orderStatus) {
            const rawStatus = String(this.orderStatus);
            const normalized = normalizeOrderStatus(rawStatus);
            if (rawStatus !== normalized) {
                console.log(`[Order][Migration] Normalized orderStatus on new order: "${rawStatus}" -> "${normalized}"`);
                this.orderStatus = normalized;
            }
            // Initial status on new order is allowed - skip authorization check
            return next();
        }
        // Migration: Auto-convert lowercase orderStatus to uppercase
        if (this.isModified("orderStatus") && this.orderStatus) {
            const rawStatus = String(this.orderStatus);
            const normalized = normalizeOrderStatus(rawStatus);
            // Check if this is just a normalization (same status, different case)
            // This is allowed without the authorized symbol
            const isJustNormalization = rawStatus !== normalized;
            if (isJustNormalization) {
                console.log(`[Order][Migration] Normalized orderStatus: "${rawStatus}" -> "${normalized}" (orderId: ${this._id})`);
                this.orderStatus = normalized;
            }
            else {
                // Not a normalization - check for authorized transition
                const AUTHORIZED_TRANSITION_SYMBOL = Symbol.for("orderStateService.authorizedTransition");
                const isAuthorized = this[AUTHORIZED_TRANSITION_SYMBOL] === true;
                if (!isAuthorized) {
                    const err = new Error(`Order status must be changed via orderStateService.transition(). ` +
                        `Direct modification of orderStatus is not allowed. ` +
                        `(orderId: ${this._id}, attempted status: ${rawStatus})`);
                    err.statusCode = 403;
                    return next(err);
                }
                // Clear the authorization flag after use
                delete this[AUTHORIZED_TRANSITION_SYMBOL];
            }
        }
        // Payment status security check
        const nextStatus = String(this.paymentStatus || "").toUpperCase();
        if (!this.isModified("paymentStatus"))
            return next();
        if (nextStatus !== "PAID")
            return next();
        const source = String((this.$locals || {})[PAID_SOURCE_OPTION_KEY] || "");
        if (source !== ALLOWED_PAID_SOURCE) {
            throwIllegalPaidTransition({ method: "save", source, orderId: this._id });
        }
        return next();
    }
    catch (e) {
        return next(e);
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
            const err = new Error(`Order status must be changed via orderStateService.transition(). ` +
                `Direct update of orderStatus via updateOne() is not allowed. ` +
                `(attempted status: ${rawStatus})`);
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
            const err = new Error(`Order status must be changed via orderStateService.transition(). ` +
                `Direct update of orderStatus via updateMany() is not allowed. ` +
                `(attempted status: ${rawStatus})`);
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
            const err = new Error(`Order status must be changed via orderStateService.transition(). ` +
                `Direct update of orderStatus via findOneAndUpdate() is not allowed. ` +
                `(attempted status: ${rawStatus})`);
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
OrderSchema.index({ userId: 1, idempotencyKey: 1 }, {
    unique: true,
    partialFilterExpression: {
        idempotencyKey: { $type: "string" },
    },
});
exports.Order = mongoose_1.default.model("Order", OrderSchema);
