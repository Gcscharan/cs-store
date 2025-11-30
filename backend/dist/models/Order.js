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
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
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
    deliveredBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "DeliveryBoy" },
});
const StatusHistorySchema = new mongoose_1.Schema({
    status: { type: String, required: true },
    deliveryStatus: { type: String },
    updatedBy: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    updatedByRole: { type: String, enum: ["admin", "delivery", "system", "customer"], required: true },
    timestamp: { type: Date, default: Date.now },
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
const OrderSchema = new mongoose_1.Schema({
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    items: [OrderItemSchema],
    totalAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    paymentMethod: {
        type: String,
        enum: ["card", "upi", "netbanking", "cod"],
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded"],
        default: "pending",
    },
    paymentReceivedAt: {
        type: Date,
    },
    orderStatus: {
        type: String,
        enum: [
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
        default: "pending",
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
    assignmentHistory: [AssignmentHistorySchema],
    address: OrderAddressSchema,
    razorpayOrderId: {
        type: String,
    },
    razorpayPaymentId: {
        type: String,
    },
    razorpaySignature: {
        type: String,
    },
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
}, {
    timestamps: true,
});
// Indexes
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ deliveryBoyId: 1, orderStatus: 1 });
OrderSchema.index({ orderStatus: 1 });
OrderSchema.index({ paymentStatus: 1 });
exports.Order = mongoose_1.default.model("Order", OrderSchema);
