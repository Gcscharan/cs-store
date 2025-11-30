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
exports.DeliveryBoy = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CurrentLocationSchema = new mongoose_1.Schema({
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    lastUpdatedAt: { type: Date, default: Date.now },
});
const ActiveRouteSchema = new mongoose_1.Schema({
    polyline: { type: String, required: true },
    destination: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
    },
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: "Order" },
    startedAt: { type: Date, default: Date.now },
    estimatedArrival: { type: Date },
});
const DeliveryBoySchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
        maxlength: [100, "Name cannot exceed 100 characters"],
    },
    phone: {
        type: String,
        required: [true, "Phone number is required"],
        unique: true,
        match: [/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number"],
    },
    vehicleType: {
        type: String,
        required: [true, "Vehicle type is required"],
        enum: ["bike", "scooter", "cycle", "car", "walking"],
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    availability: {
        type: String,
        enum: ["available", "busy", "offline"],
        default: "offline",
    },
    currentLocation: CurrentLocationSchema,
    activeRoute: ActiveRouteSchema,
    earnings: {
        type: Number,
        default: 0,
        min: 0,
    },
    completedOrdersCount: {
        type: Number,
        default: 0,
        min: 0,
    },
    assignedOrders: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: "Order",
        },
    ],
    currentLoad: {
        type: Number,
        default: 0,
        min: 0,
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "User",
    },
    selfieUrl: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});
// Indexes
DeliveryBoySchema.index({ availability: 1, isActive: 1 });
DeliveryBoySchema.index({ "currentLocation.lat": 1, "currentLocation.lng": 1 });
exports.DeliveryBoy = mongoose_1.default.model("DeliveryBoy", DeliveryBoySchema);
