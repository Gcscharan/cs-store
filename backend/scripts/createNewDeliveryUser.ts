import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";

async function createNewDeliveryUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store"
    );
    console.log("Connected to MongoDB");

    // Delete existing delivery user
    await User.deleteOne({ email: "delivery@test.com" });
    console.log("Deleted existing delivery user");

    // Create new delivery boy with a simple password
    const password = "123456";
    const hashedPassword = await bcrypt.hash(password, 10);

    const deliveryBoy = new User({
      name: "Test Delivery Boy",
      email: "delivery@test.com",
      phone: "9876543210",
      passwordHash: hashedPassword,
      role: "delivery",
      appLanguage: "English",
      preferredLanguage: "English",
    });

    await deliveryBoy.save();
    console.log("✅ New delivery boy created successfully");
    console.log("Email: delivery@test.com");
    console.log("Password: 123456");
    console.log("Role: delivery");
  } catch (error) {
    console.error("Error creating delivery user:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

createNewDeliveryUser();
