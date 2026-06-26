// Minimal local-test seeder — inserts a few valid products into the throwaway DB
// for UI render testing. NOT for production use.
import mongoose from "mongoose";
import { Product } from "../models/Product";

async function run() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/vyaparsetu_localtest";
  await mongoose.connect(uri);
  console.log("[seedLocalTest] connected:", new URL(uri).pathname);

  const img = {
    variants: {
      micro: "/placeholder-product.svg",
      thumb: "/placeholder-product.svg",
      small: "/placeholder-product.svg",
      medium: "/placeholder-product.svg",
      large: "/placeholder-product.svg",
      original: "/placeholder-product.svg",
    },
  };

  const products = [
    { name: "Dairy Milk Chocolate", description: "Classic milk chocolate bar.", category: "chocolates", price: 50, pricePerUnit: 50, mrp: 60, gstRate: 18, stock: 100, weight: 50, isActive: true, status: "published", images: [img], tags: ["chocolate", "sweet"] },
    { name: "Marie Biscuits", description: "Light tea-time biscuits.", category: "biscuits", price: 30, pricePerUnit: 30, mrp: 35, gstRate: 18, stock: 80, weight: 120, isActive: true, status: "published", images: [img], tags: ["biscuit", "snack"] },
    { name: "Fresh Paneer", description: "Soft cottage cheese, 200g.", category: "dairy", price: 90, pricePerUnit: 90, mrp: 100, gstRate: 5, stock: 40, weight: 200, isActive: true, status: "published", images: [img], tags: ["paneer", "dairy"] },
    { name: "Potato Chips", description: "Salted crispy chips.", category: "snacks", price: 20, pricePerUnit: 20, mrp: 25, gstRate: 12, stock: 150, weight: 60, isActive: true, status: "published", images: [img], tags: ["chips", "snack"] },
    { name: "Orange Juice", description: "100% orange juice, 1L.", category: "beverages", price: 120, pricePerUnit: 120, mrp: 130, gstRate: 12, stock: 60, weight: 1000, isActive: true, status: "published", images: [img], tags: ["juice", "drink"] },
    { name: "Besan Ladoo", description: "Traditional gram-flour sweet.", category: "ladoos", price: 200, pricePerUnit: 200, mrp: 220, gstRate: 5, stock: 30, weight: 250, isActive: true, status: "published", images: [img], tags: ["sweet", "ladoo"] },
  ];

  await Product.deleteMany({});
  const created = await Product.insertMany(products as any, { ordered: false });
  console.log(`[seedLocalTest] inserted ${created.length} products`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error("[seedLocalTest] error:", e);
  process.exit(1);
});
