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
// Connect to MongoDB
const connectDB = async () => {
    try {
        await mongoose_1.default.connect(MONGODB_URI);
        console.log("✅ Connected to MongoDB");
    }
    catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1);
    }
};
// Products for each category with relevant images
const categoryProducts = {
    chocolates: [
        {
            name: "Premium Dark Chocolate",
            description: "Rich and smooth dark chocolate with 70% cocoa content",
            price: 199,
            mrp: 249,
            stock: 50,
            weight: 100,
            sku: "CHOC-DARK-001",
            tags: ["dark", "premium", "cocoa"],
            images: [
                "https://images.unsplash.com/photo-1511381939415-e44015466834?w=800&h=600&fit=crop",
                "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800&h=600&fit=crop",
            ],
        },
        {
            name: "Milk Chocolate Bar",
            description: "Creamy milk chocolate perfect for snacking",
            price: 89,
            mrp: 120,
            stock: 75,
            weight: 80,
            sku: "CHOC-MILK-001",
            tags: ["milk", "creamy", "snack"],
            images: [
                "https://images.unsplash.com/photo-1558618047-3c8c76ca7d13?w=800&h=600&fit=crop",
            ],
        },
    ],
    biscuits: [
        {
            name: "Butter Cookies",
            description: "Crispy and buttery cookies perfect with tea",
            price: 65,
            mrp: 85,
            stock: 100,
            weight: 200,
            sku: "BISC-BUTTER-001",
            tags: ["butter", "crispy", "tea"],
            images: [
                "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop",
                "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop",
            ],
        },
        {
            name: "Digestive Biscuits",
            description: "Healthy whole wheat digestive biscuits",
            price: 45,
            mrp: 60,
            stock: 80,
            weight: 150,
            sku: "BISC-DIGEST-001",
            tags: ["healthy", "whole wheat", "digestive"],
            images: [
                "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=800&h=600&fit=crop",
            ],
        },
    ],
    ladoos: [
        {
            name: "Besan Ladoo",
            description: "Traditional sweet made with gram flour and ghee",
            price: 120,
            mrp: 150,
            stock: 40,
            weight: 250,
            sku: "LADOO-BESAN-001",
            tags: ["traditional", "sweet", "gram flour"],
            images: [
                "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=600&fit=crop",
                "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop",
            ],
        },
        {
            name: "Coconut Ladoo",
            description: "Soft and delicious coconut ladoos",
            price: 95,
            mrp: 120,
            stock: 35,
            weight: 200,
            sku: "LADOO-COCONUT-001",
            tags: ["coconut", "soft", "sweet"],
            images: [
                "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=600&fit=crop",
            ],
        },
    ],
    cakes: [
        {
            name: "Chocolate Cake",
            description: "Rich chocolate cake with cream frosting",
            price: 450,
            mrp: 550,
            stock: 15,
            weight: 1000,
            sku: "CAKE-CHOC-001",
            tags: ["chocolate", "cream", "frosting"],
            images: [
                "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&h=600&fit=crop",
                "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&h=600&fit=crop",
            ],
        },
        {
            name: "Vanilla Sponge Cake",
            description: "Light and fluffy vanilla sponge cake",
            price: 380,
            mrp: 450,
            stock: 20,
            weight: 800,
            sku: "CAKE-VANILLA-001",
            tags: ["vanilla", "sponge", "light"],
            images: [
                "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&h=600&fit=crop",
            ],
        },
    ],
    hot_snacks: [
        {
            name: "Samosa",
            description: "Crispy fried samosas with potato filling",
            price: 25,
            mrp: 35,
            stock: 60,
            weight: 50,
            sku: "SNACK-SAMOSA-001",
            tags: ["crispy", "fried", "potato"],
            images: [
                "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&h=600&fit=crop",
                "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=800&h=600&fit=crop",
            ],
        },
        {
            name: "Pakora Mix",
            description: "Assorted vegetable pakoras",
            price: 45,
            mrp: 60,
            stock: 40,
            weight: 100,
            sku: "SNACK-PAKORA-001",
            tags: ["vegetable", "fried", "assorted"],
            images: [
                "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&h=600&fit=crop",
            ],
        },
    ],
    groceries: [
        {
            name: "Basmati Rice",
            description: "Premium quality basmati rice",
            price: 180,
            mrp: 220,
            stock: 30,
            weight: 1000,
            sku: "GROC-RICE-001",
            tags: ["rice", "basmati", "premium"],
            images: [
                "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&h=600&fit=crop",
            ],
        },
        {
            name: "Whole Wheat Flour",
            description: "Fresh whole wheat flour for baking",
            price: 45,
            mrp: 55,
            stock: 50,
            weight: 500,
            sku: "GROC-FLOUR-001",
            tags: ["wheat", "flour", "baking"],
            images: [
                "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800&h=600&fit=crop",
            ],
        },
    ],
    vegetables: [
        {
            name: "Fresh Tomatoes",
            description: "Farm fresh red tomatoes",
            price: 40,
            mrp: 50,
            stock: 25,
            weight: 500,
            sku: "VEG-TOMATO-001",
            tags: ["fresh", "red", "farm"],
            images: [
                "https://images.unsplash.com/photo-1546470427-5a1a3b5b5b5b?w=800&h=600&fit=crop",
            ],
        },
        {
            name: "Green Bell Peppers",
            description: "Fresh green bell peppers",
            price: 60,
            mrp: 75,
            stock: 20,
            weight: 300,
            sku: "VEG-PEPPER-001",
            tags: ["green", "bell pepper", "fresh"],
            images: [
                "https://images.unsplash.com/photo-1546470427-5a1a3b5b5b5b?w=800&h=600&fit=crop",
            ],
        },
    ],
    fruits: [
        {
            name: "Fresh Apples",
            description: "Crisp and juicy red apples",
            price: 80,
            mrp: 100,
            stock: 35,
            weight: 1000,
            sku: "FRUIT-APPLE-001",
            tags: ["apple", "fresh", "juicy"],
            images: [
                "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&h=600&fit=crop",
            ],
        },
        {
            name: "Bananas",
            description: "Sweet and ripe bananas",
            price: 30,
            mrp: 40,
            stock: 50,
            weight: 500,
            sku: "FRUIT-BANANA-001",
            tags: ["banana", "sweet", "ripe"],
            images: [
                "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&h=600&fit=crop",
            ],
        },
    ],
    dairy: [
        {
            name: "Fresh Milk",
            description: "Pure and fresh cow milk",
            price: 25,
            mrp: 30,
            stock: 40,
            weight: 500,
            sku: "DAIRY-MILK-001",
            tags: ["milk", "fresh", "pure"],
            images: [
                "https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800&h=600&fit=crop",
            ],
        },
        {
            name: "Paneer",
            description: "Fresh homemade paneer",
            price: 120,
            mrp: 150,
            stock: 15,
            weight: 250,
            sku: "DAIRY-PANEER-001",
            tags: ["paneer", "fresh", "homemade"],
            images: [
                "https://images.unsplash.com/photo-1550583724-b2692b85b85b?w=800&h=600&fit=crop",
            ],
        },
    ],
    beverages: [
        {
            name: "Green Tea",
            description: "Premium green tea leaves",
            price: 150,
            mrp: 180,
            stock: 25,
            weight: 100,
            sku: "BEV-TEA-001",
            tags: ["tea", "green", "premium"],
            images: [
                "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&h=600&fit=crop",
            ],
        },
        {
            name: "Fresh Orange Juice",
            description: "100% fresh orange juice",
            price: 60,
            mrp: 80,
            stock: 20,
            weight: 250,
            sku: "BEV-JUICE-001",
            tags: ["juice", "orange", "fresh"],
            images: [
                "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800&h=600&fit=crop",
            ],
        },
    ],
};
const addProductsForAllCategories = async () => {
    try {
        console.log("🚀 Adding products for all categories...");
        let totalAdded = 0;
        for (const [category, products] of Object.entries(categoryProducts)) {
            console.log(`\n📦 Adding products for ${category} category:`);
            for (const productData of products) {
                const product = new Product_1.Product({
                    ...productData,
                    category: category,
                });
                await product.save();
                console.log(`  ✅ Added: ${productData.name}`);
                totalAdded++;
            }
        }
        console.log(`\n🎉 Successfully added ${totalAdded} products across all categories!`);
    }
    catch (error) {
        console.error("❌ Error adding products:", error);
    }
};
const main = async () => {
    await connectDB();
    await addProductsForAllCategories();
    await mongoose_1.default.disconnect();
    console.log("👋 Disconnected from MongoDB");
};
main().catch(console.error);
