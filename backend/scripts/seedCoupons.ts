import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { Coupon } from "../src/models/Coupon";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function seedCoupons() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error("MONGODB_URI is not defined");

    await mongoose.connect(mongoUri);
    console.log("✅ Connected to MongoDB");

    const coupons = [
      {
        code: "WELCOME10",
        description: "Get 10% off on your first order",
        discountType: "percentage",
        discountValue: 10,
        minCartValue: 100,
        expiryDate: new Date("2026-12-31"),
        isActive: true,
      },
      {
        code: "SAVE50",
        description: "Flat ₹50 off on orders above ₹500",
        discountType: "fixed",
        discountValue: 50,
        minCartValue: 500,
        expiryDate: new Date("2026-12-31"),
        isActive: true,
      },
      {
        code: "SUPER20",
        description: "20% off on orders above ₹1000",
        discountType: "percentage",
        discountValue: 20,
        minCartValue: 1000,
        expiryDate: new Date("2026-12-31"),
        isActive: true,
      },
    ];

    for (const coupon of coupons) {
      await Coupon.findOneAndUpdate(
        { code: coupon.code },
        coupon,
        { upsert: true, new: true }
      );
      console.log(`✅ Seeded coupon: ${coupon.code}`);
    }

    console.log("✨ Coupon seeding completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedCoupons();
