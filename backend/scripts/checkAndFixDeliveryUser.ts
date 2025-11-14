import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../src/models/User";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-here";

async function checkAndFixDeliveryUser() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store"
    );
    console.log("Connected to MongoDB");

    // Check if the user exists
    const user = await User.findOne({ email: "deliveryboy@gmail.com" });

    if (user) {
      console.log("✅ User found:");
      console.log("ID:", user._id);
      console.log("Name:", user.name);
      console.log("Email:", user.email);
      console.log("Phone:", user.phone);
      console.log("Role:", user.role);

      // Update the user to ensure they have the correct role and password
      user.role = "delivery";
      user.appLanguage = "English";
      user.preferredLanguage = "English";

      // Set a simple password
      const password = "123456";
      user.passwordHash = await bcrypt.hash(password, 10);

      await user.save();
      console.log("✅ User updated successfully");

      // Generate a fresh JWT token
      const token = jwt.sign(
        { userId: user._id, email: user.email },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      console.log("\n=== FRESH DELIVERY BOY CREDENTIALS ===");
      console.log("Email: deliveryboy@gmail.com");
      console.log("Password: 123456");
      console.log("Role: delivery");
      console.log("Token:", token);
      console.log("=====================================\n");
    } else {
      console.log("❌ User not found, creating new one...");

      // Create new user
      const password = "123456";
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({
        name: "Delivery Boy",
        email: "deliveryboy@gmail.com",
        phone: "9876543210",
        passwordHash: hashedPassword,
        role: "delivery",
        appLanguage: "English",
        preferredLanguage: "English",
      });

      await newUser.save();
      console.log("✅ New user created successfully");

      // Generate JWT token
      const token = jwt.sign(
        { userId: newUser._id, email: newUser.email },
        JWT_SECRET,
        { expiresIn: "24h" }
      );

      console.log("\n=== NEW DELIVERY BOY CREDENTIALS ===");
      console.log("Email: deliveryboy@gmail.com");
      console.log("Password: 123456");
      console.log("Role: delivery");
      console.log("Token:", token);
      console.log("=====================================\n");
    }
  } catch (error) {
    console.error("Error checking/fixing delivery user:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

checkAndFixDeliveryUser();
