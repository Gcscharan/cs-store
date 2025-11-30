"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const Product_1 = require("../models/Product");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// CRITICAL: Only use MONGODB_URI from environment - no fallbacks
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
    console.error("❌ Please set MONGODB_URI in your .env file and restart.");
    process.exit(1);
}
const addMrpToProducts = async () => {
    try {
        // Connect to MongoDB Atlas
        await mongoose_1.default.connect(MONGODB_URI);
        console.log("✅ Connected to MongoDB Atlas");
        // Get all products
        const products = await Product_1.Product.find({});
        console.log(`📦 Found ${products.length} products`);
        let updatedCount = 0;
        // Update each product with MRP (15-30% higher than current price)
        for (const product of products) {
            if (!product.mrp || product.mrp === 0) {
                // Calculate MRP as 20-25% higher than selling price
                const percentageIncrease = Math.random() * (0.25 - 0.15) + 0.15; // Random between 15% to 25%
                const mrp = Math.round(product.price * (1 + percentageIncrease));
                product.mrp = mrp;
                await product.save();
                console.log(`✅ Updated ${product.name}: Price ₹${product.price} → MRP ₹${mrp}`);
                updatedCount++;
            }
            else {
                console.log(`⏭️  Skipped ${product.name}: Already has MRP ₹${product.mrp}`);
            }
        }
        console.log(`\n🎉 Successfully updated ${updatedCount} products with MRP values`);
        // Close connection
        await mongoose_1.default.disconnect();
        console.log("✅ Disconnected from MongoDB");
        process.exit(0);
    }
    catch (error) {
        console.error("❌ Error updating products:", error);
        process.exit(1);
    }
};
// Run the script
addMrpToProducts();
