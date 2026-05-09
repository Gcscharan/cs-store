
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Pincode } from '../src/models/Pincode';

dotenv.config();

async function checkPincode() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dream';
  console.log('Connecting to:', mongoUri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@"));
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const pincode = '521235';
  const data = await Pincode.findOne({ pincode });
  console.log(`Pincode ${pincode} in DB:`, data);

  await mongoose.disconnect();
}

checkPincode().catch(console.error);
