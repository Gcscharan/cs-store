import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-here";

async function testTokenRefresh() {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store"
    );
    console.log("Connected to MongoDB");

    // Test token generation
    const userId = "68e7d826c13f0d13f32648e2";
    const email = "deliveryboy@gmail.com";

    // Generate a fresh token
    const token = jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "24h" });

    console.log("\n=== TOKEN REFRESH TEST ===");
    console.log("User ID:", userId);
    console.log("Email:", email);
    console.log("Fresh Token:", token);
    console.log("===========================\n");

    // Test the token with the API
    const response = await fetch("http://localhost:5001/api/delivery/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ API test successful!");
      console.log("Profile data:", data);
    } else {
      console.log("❌ API test failed:", response.status, response.statusText);
    }
  } catch (error) {
    console.error("Error testing token refresh:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

testTokenRefresh();
