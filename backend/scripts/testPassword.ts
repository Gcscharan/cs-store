import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models/User";

async function testPassword() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store"
    );
    console.log("Connected to MongoDB");

    // Find the delivery user
    const user = await User.findOne({ email: "delivery@test.com" });

    if (user) {
      console.log("User found, testing password...");

      // Test the password
      const isValid = await bcrypt.compare(
        "delivery123",
        user.passwordHash || ""
      );
      console.log("Password 'delivery123' is valid:", isValid);

      // Test with different passwords
      const testPasswords = ["delivery123", "delivery", "123", "test"];
      for (const password of testPasswords) {
        const valid = await bcrypt.compare(password, user.passwordHash || "");
        console.log(`Password '${password}' is valid:`, valid);
      }
    } else {
      console.log("❌ Delivery user not found");
    }
  } catch (error) {
    console.error("Error testing password:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

testPassword();
