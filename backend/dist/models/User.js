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
    label: { type: String, required: true },
    pincode: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    addressLine: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    isDefault: { type: Boolean, default: false },
});
const OAuthProviderSchema = new mongoose_1.Schema({
    provider: { type: String, enum: ["google"], required: true },
    providerId: { type: String, required: true },
});
const UserSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true,
        maxlength: [100, "Name cannot exceed 100 characters"],
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            "Please enter a valid email",
        ],
    },
    phone: {
        type: String,
        required: () => false,
        match: [
            /^[0-9]{10,15}$/,
            "Please enter a valid phone number (10-15 digits)",
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
}, {
    timestamps: true,
});
UserSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.passwordHash)
        return false;
    return bcrypt.compare(candidatePassword, this.passwordHash);
};
exports.User = mongoose_1.default.model("User", UserSchema);
//# sourceMappingURL=User.js.map