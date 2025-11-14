"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Product_1 = require("../models/Product");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store");
        console.log("✅ Connected to MongoDB");
    }
    catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1);
    }
};
const sampleProducts = [
    {
        name: "Premium Chocolate Box",
        description: "Delicious assortment of premium chocolates",
        category: "chocolates",
        price: 299,
        mrp: 399,
        stock: 50,
        weight: 500,
        sku: "CHOC-001",
        tags: ["premium", "gift", "chocolate"],
        images: [
            "https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&h=600&fit=crop",
        ],
    },
    {
        name: "Fresh Strawberry Cake",
        description: "Moist strawberry cake with fresh cream",
        category: "cakes",
        price: 450,
        mrp: 550,
        stock: 20,
        weight: 1000,
        sku: "CAKE-001",
        tags: ["fresh", "strawberry", "cream"],
        images: [
            "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&h=600&fit=crop",
            "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop",
        ],
    },
    {
        name: "Crispy Biscuits Pack",
        description: "Crunchy and delicious biscuits",
        category: "biscuits",
        price: 89,
        mrp: 120,
        stock: 100,
        weight: 200,
        sku: "BISC-001",
        tags: ["crispy", "crunchy", "snack"],
        images: [
            "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop",
        ],
    },
];
const addProductsWithExternalImages = async () => {
    try {
        console.log("🚀 Adding products with external images...");
        for (const productData of sampleProducts) {
            const product = new Product_1.Product(productData);
            await product.save();
            console.log(`✅ Added: ${productData.name}`);
        }
        console.log("🎉 All products added successfully!");
    }
    catch (error) {
        console.error("❌ Error adding products:", error);
    }
};
const main = async () => {
    await connectDB();
    await addProductsWithExternalImages();
    await mongoose_1.default.disconnect();
    console.log("👋 Disconnected from MongoDB");
};
main().catch(console.error);
//# sourceMappingURL=addProductWithExternalImages.js.map