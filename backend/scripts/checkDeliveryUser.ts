import mongoose from "mongoose";
import { User } from "../src/models/User";

async function checkDeliveryUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store"
    );
    console.log("Connected to MongoDB");

    // Find the delivery user
    const user = await User.findOne({ email: "delivery@test.com" });

    if (user) {
      console.log("✅ Delivery user found:");
      console.log("ID:", user._id);
      console.log("Name:", user.name);
      console.log("Email:", user.email);
      console.log("Phone:", user.phone);
      console.log("Role:", user.role);
      console.log("App Language:", user.appLanguage);
      console.log("Preferred Language:", user.preferredLanguage);
      console.log("Created At:", user.createdAt);
      console.log("Updated At:", user.updatedAt);
    } else {
      console.log("❌ Delivery user not found");
    }
  } catch (error) {
    console.error("Error checking delivery user:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

checkDeliveryUser();
