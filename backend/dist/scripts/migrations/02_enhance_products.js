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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * MIGRATION 02: Enhance Products Collection
 * Adds enterprise fields for inventory, ratings, and analytics
 */
const mongoose_1 = __importDefault(require("mongoose"));
const Product_1 = require("../../models/Product");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function enhanceProducts() {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI);
        console.log("✅ Connected to MongoDB\n");
        console.log("🔧 Enhancing Products Collection...");
        const result = await Product_1.Product.updateMany({}, {
            $set: {
                // Brand & SKU
                brand: "Unknown",
                manufacturer: "Unknown",
                barcode: null,
                // Ratings
                averageRating: 0,
                totalReviews: 0,
                ratingDistribution: {
                    five: 0,
                    four: 0,
                    three: 0,
                    two: 0,
                    one: 0
                },
                // Inventory
                lowStockThreshold: 10,
                reorderLevel: 20,
                lastRestockedAt: null,
                inventoryLogs: [],
                // Pricing
                costPrice: 0,
                profitMargin: 0,
                discountPercentage: 0,
                taxRate: 0,
                // Status
                isActive: true,
                isFeatured: false,
                isOnSale: false,
                isDeleted: false,
                deletedAt: null,
                // SEO
                slug: null,
                metaTitle: null,
                metaDescription: null,
                searchKeywords: [],
                // Analytics
                viewCount: 0,
                purchaseCount: 0,
                lastViewedAt: null,
                lastPurchasedAt: null
            }
        }, { strict: false });
        console.log(`✅ Updated ${result.modifiedCount} products`);
        // Create indexes
        console.log("\n🔧 Creating indexes...");
        await Product_1.Product.collection.createIndex({ brand: 1, isActive: 1, isDeleted: 1 });
        await Product_1.Product.collection.createIndex({ averageRating: -1 });
        await Product_1.Product.collection.createIndex({ viewCount: -1, purchaseCount: -1 });
        await Product_1.Product.collection.createIndex({ isActive: 1, isFeatured: 1 });
        console.log("✅ Indexes created");
    }
    catch (error) {
        console.error("❌ Error:", error);
    }
    finally {
        await mongoose_1.default.connection.close();
    }
}
enhanceProducts();
