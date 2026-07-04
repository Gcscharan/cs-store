/**
 * Seeds login-ready QA accounts for automated crawling.
 * - Customer: phone 9000000007 (OTP login → dev echoes OTP)
 * - Delivery: email qa.delivery@example.com / password Qa@123456 (KYC VERIFIED)
 * Idempotent: upserts. Safe to re-run.
 *
 * Run:  cd backend && npx ts-node scripts/seed-qa-users.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import * as bcrypt from "bcryptjs";
import { User } from "../src/models/User";
import { DeliveryBoy } from "../src/models/DeliveryBoy";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing");
  await mongoose.connect(uri);
  console.log("connected");

  // ── Customer ──
  const custPhone = "9000000007";
  await User.updateOne(
    { phone: custPhone },
    {
      $set: {
        name: "QA Customer",
        phone: custPhone,
        role: "customer",
        status: "active",
        isProfileComplete: true,
        mobileVerified: true,
        referralCode: "QACUST0007",
      },
    },
    { upsert: true }
  );
  console.log("✅ customer upserted:", custPhone);

  // ── Delivery (User + DeliveryBoy, KYC verified) ──
  const delPhone = "9000000008";
  const delEmail = "qa.delivery@example.com";
  const passwordHash = await bcrypt.hash("Qa@123456", 10);
  await User.updateOne(
    { phone: delPhone },
    {
      $set: {
        name: "QA Delivery",
        phone: delPhone,
        email: delEmail,
        role: "delivery",
        status: "active",
        passwordHash,
        isProfileComplete: true,
        mobileVerified: true,
        referralCode: "QADEL0008",
        deliveryProfile: { phone: delPhone, vehicleType: "bike", assignedAreas: [], documents: [] },
      },
    },
    { upsert: true }
  );
  const delUser = await User.findOne({ phone: delPhone }).select("_id").lean();
  await DeliveryBoy.updateOne(
    { phone: delPhone },
    {
      $set: {
        name: "QA Delivery",
        phone: delPhone,
        email: delEmail,
        userId: delUser?._id,
        vehicleType: "bike",
        isActive: true,
        availability: "offline",
        currentLocation: { lat: 17.68, lng: 83.2, lastUpdatedAt: new Date() },
        kyc: { status: "VERIFIED", documents: [], submittedAt: new Date(), reviewedAt: new Date() },
      },
    },
    { upsert: true }
  );
  console.log("✅ delivery upserted:", delEmail, "/ Qa@123456");

  await mongoose.disconnect();
  console.log("done");
}
main().catch((e) => { console.error(e); process.exit(1); });
