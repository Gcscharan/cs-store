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
}, {
    timestamps: true,
});
// Indexes
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ deliveryBoyId: 1, orderStatus: 1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ paymentStatus: 1 });
OrderSchema.index({ userId: 1, idempotencyKey: 1 }, {
    unique: true,
    partialFilterExpression: {
        idempotencyKey: { $type: "string" },
    },
});
exports.Order = mongoose_1.default.model("Order", OrderSchema);
