import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../src/models/User";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-here";

async function createTestDeliveryBoy() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store"
    );
    console.log("Connected to MongoDB");

    // Check if delivery boy already exists
    const existingUser = await User.findOne({ email: "delivery@test.com" });
    if (existingUser) {
      console.log("Delivery boy already exists, updating...");
      existingUser.role = "delivery";
      existingUser.name = "Test Delivery Boy";
      existingUser.phone = "9876543210";
      await existingUser.save();
      console.log("Delivery boy updated successfully");
    } else {
      // Create new delivery boy
      const hashedPassword = await bcrypt.hash("delivery123", 10);
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
      console.log("Delivery boy created successfully");
    }

    // Generate JWT token
    const user = await User.findOne({ email: "delivery@test.com" });
    if (user) {
      const token = jwt.sign(
        { userId: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      console.log("\n=== TEST DELIVERY BOY CREDENTIALS ===");
      console.log("Email: delivery@test.com");
      console.log("Password: delivery123");
      console.log("Role: delivery");
      console.log("Token:", token);
      console.log("=====================================\n");
    }
  } catch (error) {
    console.error("Error creating test delivery boy:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

createTestDeliveryBoy();
