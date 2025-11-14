#!/usr/bin/env node

/**
 * Test Script: Verify Profile Update API
 * 
 * This script tests that profile updates (name, email, phone) 
 * actually persist to MongoDB and can be retrieved after refresh.
 * 
 * Usage:
 *   1. Start backend server: npm run dev
 *   2. Login to get a valid JWT token
 *   3. Set TOKEN environment variable
 *   4. Run: node test-profile-update.js
 */

const TOKEN = process.env.TOKEN || "YOUR_JWT_TOKEN_HERE";
const API_BASE = "http://localhost:5001/api";

async function testProfileUpdate() {
  console.log("\n🧪 Testing Profile Update & Persistence\n");
  console.log("=" .repeat(60));

  try {
    // Step 1: Get current profile
    console.log("\n📥 Step 1: Fetching current profile...");
    const getResponse = await fetch(`${API_BASE}/user/profile`, {
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    if (!getResponse.ok) {
      throw new Error(`GET /profile failed: ${getResponse.status} ${await getResponse.text()}`);
    }

    const currentProfile = await getResponse.json();
    console.log("✅ Current profile:", {
      name: currentProfile.name,
      email: currentProfile.email,
      phone: currentProfile.phone
    });

    // Step 2: Update profile with new data
    const timestamp = Date.now();
    const newPhoneNumber = `9876${timestamp.toString().slice(-6)}`;
    
    console.log(`\n📤 Step 2: Updating profile with new phone: ${newPhoneNumber}...`);
    const updateResponse = await fetch(`${API_BASE}/user/profile`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: currentProfile.name || "Test User",
        email: currentProfile.email,
        phone: newPhoneNumber
      })
    });

    if (!updateResponse.ok) {
      throw new Error(`PUT /profile failed: ${updateResponse.status} ${await updateResponse.text()}`);
    }

    const updateResult = await updateResponse.json();
    console.log("✅ Update response:", updateResult);

    // Step 3: Re-fetch profile to verify persistence
    console.log("\n📥 Step 3: Re-fetching profile to verify MongoDB persistence...");
    const verifyResponse = await fetch(`${API_BASE}/user/profile`, {
      headers: {
        "Authorization": `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    if (!verifyResponse.ok) {
      throw new Error(`GET /profile (verify) failed: ${verifyResponse.status}`);
    }

    const verifiedProfile = await verifyResponse.json();
    console.log("✅ Verified profile:", {
      name: verifiedProfile.name,
      email: verifiedProfile.email,
      phone: verifiedProfile.phone
    });

    // Step 4: Check if update persisted
    console.log("\n🔍 Step 4: Checking persistence...");
    if (verifiedProfile.phone === newPhoneNumber) {
      console.log("✅ SUCCESS: Phone number persisted correctly in MongoDB!");
      console.log(`   Expected: ${newPhoneNumber}`);
      console.log(`   Got:      ${verifiedProfile.phone}`);
    } else {
      console.log("❌ FAILURE: Phone number did NOT persist!");
      console.log(`   Expected: ${newPhoneNumber}`);
      console.log(`   Got:      ${verifiedProfile.phone}`);
      process.exit(1);
    }

    console.log("\n" + "=".repeat(60));
    console.log("🎉 All tests passed! Profile updates persist to MongoDB.\n");

  } catch (error) {
    console.error("\n❌ Test failed:", error.message);
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Make sure backend server is running (npm run dev)");
    console.error("   2. Set TOKEN environment variable with valid JWT");
    console.error("   3. Check MongoDB connection in backend logs");
    process.exit(1);
  }
}

// Check if TOKEN is set
if (TOKEN === "YOUR_JWT_TOKEN_HERE") {
  console.error("❌ Please set TOKEN environment variable:");
  console.error("   export TOKEN=your_jwt_token_here");
  console.error("   node test-profile-update.js");
  process.exit(1);
}

testProfileUpdate();
