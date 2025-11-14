import mongoose from "mongoose";
import { User } from "../models/User";
import { DeliveryBoy } from "../models/DeliveryBoy";
import * as dotenv from "dotenv";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";

async function checkDeliveryAccounts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB Atlas\n");

    // Check Users with delivery role
    const deliveryUsers = await User.find({ role: "delivery" });
    console.log("👥 Users with role='delivery':");
    console.log("=".repeat(60));
    if (deliveryUsers.length === 0) {
      console.log("❌ No delivery users found");
    } else {
      deliveryUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Phone: ${user.phone}`);
        console.log(`   Status: ${user.status}`);
        console.log(`   Has Password: ${user.passwordHash ? "Yes" : "No"}`);
        console.log(`   Has Delivery Profile: ${user.deliveryProfile ? "Yes" : "No"}`);
        console.log("");
      });
    }

    // Check DeliveryBoy collection
    const deliveryBoys = await DeliveryBoy.find({});
    console.log("\n🚴 DeliveryBoy documents:");
    console.log("=".repeat(60));
    if (deliveryBoys.length === 0) {
      console.log("❌ No delivery boy documents found");
    } else {
      deliveryBoys.forEach((db, index) => {
        console.log(`${index + 1}. ${db.name}`);
        console.log(`   Phone: ${db.phone}`);
        console.log(`   Email: ${db.email || "N/A"}`);
        console.log(`   Vehicle: ${db.vehicleType}`);
        console.log(`   Active: ${db.isActive}`);
        console.log(`   Availability: ${db.availability}`);
        console.log(`   Linked to User: ${db.userId ? "Yes (" + db.userId + ")" : "No"}`);
        console.log("");
      });
    }

    // Check all users (any role)
    const allUsers = await User.find({}).select("name email phone role status");
    console.log("\n👤 All Users in database:");
    console.log("=".repeat(60));
    if (allUsers.length === 0) {
      console.log("❌ No users found at all!");
    } else {
      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} - ${user.email} (${user.role}) [${user.status}]`);
      });
    }

    console.log("\n" + "=".repeat(60));
    console.log("📊 SUMMARY:");
    console.log("=".repeat(60));
    console.log(`Total Users: ${allUsers.length}`);
    console.log(`Delivery Users: ${deliveryUsers.length}`);
    console.log(`DeliveryBoy Documents: ${deliveryBoys.length}`);

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

checkDeliveryAccounts();
