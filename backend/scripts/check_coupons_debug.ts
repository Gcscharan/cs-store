
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Coupon } from '../src/models/Coupon';

dotenv.config();

async function checkCoupons() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dream';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const coupons = await Coupon.find({});
  console.log(`Total coupons in DB:`, coupons.length);
  console.log(`Active coupons:`, coupons.filter(c => c.isActive).length);

  await mongoose.disconnect();
}

checkCoupons().catch(console.error);
