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
exports.Product = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ProductSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: [true, "Product name is required"],
        trim: true,
        maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    description: {
        type: String,
        required: [true, "Product description is required"],
        trim: true,
        maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    category: {
        type: String,
        required: [true, "Category is required"],
        enum: [
            "chocolates",
            "biscuits",
            "ladoos",
            "cakes",
            "hot_snacks",
            "groceries",
            "vegetables",
            "fruits",
            "dairy",
            "meat",
            "beverages",
            "snacks",
            "household",
            "personal_care",
            "medicines",
            "electronics",
            "clothing",
            "other",
        ],
    },
    price: {
        type: Number,
        required: [true, "Price is required"],
        min: [0, "Price cannot be negative"],
    },
    mrp: {
        type: Number,
        min: [0, "MRP cannot be negative"],
    },
    stock: {
        type: Number,
        required: [true, "Stock quantity is required"],
        min: [0, "Stock cannot be negative"],
        default: 0,
    },
    reservedStock: {
        type: Number,
        min: [0, "Reserved stock cannot be negative"],
        default: 0,
    },
    weight: {
        type: Number,
        required: [true, "Weight is required"],
        min: [0, "Weight cannot be negative"],
        default: 0,
    },
    images: [
        {
            publicId: { type: String },
            variants: {
                micro: { type: String },
                thumb: { type: String },
                small: { type: String },
                medium: { type: String },
                large: { type: String },
                original: { type: String }
            },
            formats: {
                avif: { type: String },
                webp: { type: String },
                jpg: { type: String }
            },
            metadata: {
                width: { type: Number },
                height: { type: Number },
                aspectRatio: { type: Number }
            }
        }
    ],
    sku: {
        type: String,
        unique: true,
        sparse: true,
    },
    tags: [
        {
            type: String,
            trim: true,
        },
    ],
}, {
    timestamps: true,
});
// Index for better search performance
ProductSchema.index({ name: "text", description: "text", tags: "text" });
ProductSchema.index({ category: 1 });
ProductSchema.index({ price: 1 });
exports.Product = mongoose_1.default.model("Product", ProductSchema);
