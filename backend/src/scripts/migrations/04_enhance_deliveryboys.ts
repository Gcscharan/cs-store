/**
 * MIGRATION 04: Enhance DeliveryBoys Collection
 * Adds shift management, earnings logs, and capacity tracking
 */
import mongoose from "mongoose";
import { DeliveryBoy } from "../../models/DeliveryBoy";
import * as dotenv from "dotenv";

dotenv.config();

async function enhanceDeliveryBoys() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log("✅ Connected to MongoDB\n");

    console.log("🔧 Enhancing DeliveryBoys Collection...");
    
    const result = await DeliveryBoy.updateMany(
      {},
      {
        $set: {
          // Shift Management
          shiftStartTime: null,
          shiftEndTime: null,
          onDuty: false,
          shiftDuration: 0,
          
          // Earnings Tracking
          dailyEarnings: 0,
          weeklyEarnings: 0,
          monthlyEarnings: 0,
          earningsLogs: [],
          
          // Capacity
          activeOrdersCount: 0,
          maxOrdersCapacity: 5,
          
          // Performance
          averageDeliveryTime: 0,
          successRate: 100,
          customerRating: 0,
          totalRatings: 0,
          
          // Location Tracking
          lastLocationUpdate: null,
          batteryLevel: 100,
          isOnline: false
        }
      },
      { strict: false }
    );

    console.log(`✅ Updated ${result.modifiedCount} delivery boys`);
    
    // Create geospatial index
    console.log("\n🔧 Creating geospatial index...");
    await DeliveryBoy.collection.createIndex({ 
      "currentLocation.lat": 1, 
      "currentLocation.lng": 1 
    });
    console.log("✅ Indexes created");

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await mongoose.connection.close();
  }
}

enhanceDeliveryBoys();
