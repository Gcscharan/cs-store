import mongoose from 'mongoose';
import { Pincode } from '../models/Pincode';
import * as fs from 'fs';
import * as path from 'path';

const seedPincodesFromJSON = async () => {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dream';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Read JSON file
    const jsonPath = path.resolve(__dirname, '../../data/pincodes_ap_ts.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`📦 Found ${jsonData.length} pincodes in JSON`);

    // Clear existing pincodes
    await Pincode.deleteMany({});
    console.log('🗑️  Cleared existing pincodes');

    // Insert pincodes
    const pincodes = jsonData.map((item: any) => ({
      pincode: item.pincode,
      state: item.state,
      district: item.district,
      taluka: item.taluka,
    }));

    await Pincode.insertMany(pincodes);
    console.log(`✅ Inserted ${pincodes.length} pincodes into MongoDB`);

    // Verify 521237 exists
    const testPincode = await Pincode.findOne({ pincode: '521237' });
    if (testPincode) {
      console.log('✅ Verified: 521237 exists in MongoDB');
      console.log('   State:', testPincode.state);
      console.log('   District:', testPincode.district);
      console.log('   Taluka:', testPincode.taluka);
    } else {
      console.log('❌ Warning: 521237 not found in MongoDB');
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error seeding pincodes:', error);
    process.exit(1);
  }
};

seedPincodesFromJSON();
