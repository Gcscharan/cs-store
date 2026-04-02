import mongoose from 'mongoose';
import { Pincode } from '../src/models/Pincode';
import * as fs from 'fs';
import * as path from 'path';

const seedFullPincodes = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dream';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    const jsonPath = path.resolve(__dirname, '../data/pincodes_india.json');
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    console.log(`📦 Found ${jsonData.length} pincodes in JSON`);

    await Pincode.deleteMany({});
    console.log('🗑️  Cleared existing pincodes');

    const pincodes = jsonData.map((item: any) => ({
      pincode: item.pincode,
      state: item.state,
      district: item.postal_district,
      taluka: item.cities && item.cities.length > 0 ? item.cities[0] : undefined,
    }));

    await Pincode.insertMany(pincodes, { ordered: false });
    console.log(`✅ Inserted ${pincodes.length} pincodes into MongoDB`);

    await Pincode.collection.createIndex({ pincode: 1 }, { unique: true });
    console.log('✅ Created unique index on pincode field');

    const test521237 = await Pincode.findOne({ pincode: '521237' });
    const test500001 = await Pincode.findOne({ pincode: '500001' });
    const test999999 = await Pincode.findOne({ pincode: '999999' });

    console.log('\n🔍 Verification:');
    console.log('521237:', test521237 ? `✅ ${test521237.state} - ${test521237.district}` : '❌ NOT FOUND');
    console.log('500001:', test500001 ? `✅ ${test500001.state} - ${test500001.district}` : '❌ NOT FOUND');
    console.log('999999:', test999999 ? `✅ ${test999999.state}` : '✅ NOT FOUND (expected)');

    const totalCount = await Pincode.countDocuments();
    console.log(`\n📊 Total pincodes in DB: ${totalCount}`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error seeding pincodes:', error);
    process.exit(1);
  }
};

seedFullPincodes();
