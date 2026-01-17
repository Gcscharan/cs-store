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
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcrypt = __importStar(require("bcryptjs"));
const AddressSchema = new mongoose_1.Schema({
    name: { type: String, required: false, default: "" },
    label: { type: String, required: true },
    pincode: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    postal_district: { type: String, required: true },
    admin_district: { type: String, required: true },
    addressLine: { type: String, required: true },
    phone: { type: String, required: false, default: "" },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    isDefault: { type: Boolean, default: false },
    isGeocoded: { type: Boolean, default: false },
    coordsSource: {
        type: String,
        enum: ['manual', 'saved', 'geocoded', 'pincode', 'unresolved'],
        default: 'unresolved'
    },
});
const OAuthProviderSchema = new mongoose_1.Schema({
    provider: { type: String, enum: ["google"], required: true },
    providerId: { type: String, required: true },
});
const DeliveryDocumentSchema = new mongoose_1.Schema({
    type: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
});
const DeliveryProfileSchema = new mongoose_1.Schema({
    phone: { type: String, required: true },
    vehicleType: {
        type: String,
        enum: ["bike", "car", "cycle", "scooter", "walking"],
        required: true,
    },
    assignedAreas: [{ type: String }],
    aadharOrId: { type: String },
    documents: [DeliveryDocumentSchema],
    approvedAt: { type: Date },
    approvedBy: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
});
const UserSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: false, // Make name optional for OAuth users
        default: "",
        trim: true,
        maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        // Updated regex to support:
        // - Plus signs in local part (user+tag@domain.com)
        // - Multiple dots in domain (sub.domain.co.in)
        // - TLDs of any length (.museum, .technology, etc.)
        // - Special characters in local part (user.name@domain.com)
        match: [
            /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i,
            "Please enter a valid email",
        ],
    },
    phone: {
        type: String,
        required: false, // Make phone optional by default
        default: "",
        match: [
            /^[6-9]\d{9}$/,
            "Please enter a valid Indian phone number (10 digits starting with 6-9)",
        ],
    },
    passwordHash: {
        type: String,
        minlength: [6, "Password must be at least 6 characters"],
    },
    oauthProviders: [OAuthProviderSchema],
    role: {
        type: String,
        enum: ["customer", "admin", "delivery"],
        default: "customer",
    },
    status: {
        type: String,
        enum: ["pending", "active", "suspended"],
        default: "active",
    },
    deliveryProfile: DeliveryProfileSchema,
    addresses: [AddressSchema],
    appLanguage: {
        type: String,
        default: "English",
        trim: true,
    },
    preferredLanguage: {
        type: String,
        default: "English",
        trim: true,
    },
    isProfileComplete: {
        type: Boolean,
        default: false,
    },
    mobileVerified: {
        type: Boolean,
        default: false,
    },
    notificationPreferences: {
        type: mongoose_1.Schema.Types.Mixed,
        default: {},
    },
    // Email change verification fields
    pendingEmail: {
        type: String,
        default: null,
    },
    pendingEmailToken: {
        type: String,
        default: null,
    },
    pendingEmailExpiresAt: {
        type: Date,
        default: null,
    },
    lastEmailChangeRequestAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});
UserSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.passwordHash)
        return false;
    return bcrypt.compare(candidatePassword, this.passwordHash);
};
exports.User = mongoose_1.default.model("User", UserSchema);
