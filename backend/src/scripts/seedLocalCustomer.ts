// Creates a test customer in the local test DB so authenticated customer-page
// crawling works (OTP login requires an existing user with name + valid phone).
import mongoose from "mongoose";
import { User } from "../models/User";

async function run() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27018/vyaparsetu_localtest?replicaSet=rs0";
  await mongoose.connect(uri);
  const phone = "9000000000";
  const validAddress = {
    name: "Test User",
    label: "Home",
    pincode: "521235",
    city: "Tiruvuru",
    state: "Andhra Pradesh",
    postal_district: "Krishna",
    admin_district: "NTR",
    addressLine: "12 Test Street, Tiruvuru",
    phone: "9000000000",
    lat: 17.0956,
    lng: 80.6089,
    isDefault: true,
    coordsSource: "manual",
  };
  const existing = await User.findOne({ phone });
  if (existing) {
    if (!existing.addresses || existing.addresses.length === 0) {
      (existing as any).addresses = [validAddress];
      await existing.save();
      console.log("[seedLocalCustomer] added address to existing:", existing._id.toString());
    } else {
      console.log("[seedLocalCustomer] already exists with address:", existing._id.toString());
    }
  } else {
    const u = new User({
      name: "Test User",
      email: "test.user@example.com",
      phone,
      role: "customer",
      status: "active",
      mobileVerified: true,
      referralCode: "TESTUSER01",
      addresses: [validAddress],
    });
    await u.save();
    console.log("[seedLocalCustomer] created with address:", u._id.toString());
  }
  await mongoose.disconnect();
  process.exit(0);
}
run().catch((e) => { console.error("[seedLocalCustomer] error:", e); process.exit(1); });
