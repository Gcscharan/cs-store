import mongoose from "mongoose";
import { Pincode } from "../src/models/Pincode";
import pincodeData from "../data/pincodes_ap_ts.json";

const seedPincodes = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(
      process.env.MONGODB_URI || "mongodb://localhost:27017/cs-store"
    );
    console.log("Connected to MongoDB");

    // Clear existing pincode data
    await Pincode.deleteMany({});
    console.log("Cleared existing pincode data");

    // Insert pincode data
    const pincodes = pincodeData.map((item) => ({
      pincode: item.pincode,
      state: item.state,
      district: item.district,
      taluka: item.taluka,
    }));

    await Pincode.insertMany(pincodes);
    console.log(`Successfully seeded ${pincodes.length} pincodes`);

    // Verify the data
    const count = await Pincode.countDocuments();
    console.log(`Total pincodes in database: ${count}`);

    // Show some sample data
    const samplePincodes = await Pincode.find().limit(5);
    console.log("Sample pincodes:", samplePincodes);

    console.log("Pincode seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding pincodes:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

// Run the seed function
seedPincodes();
