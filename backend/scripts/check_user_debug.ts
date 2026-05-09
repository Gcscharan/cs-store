
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User';

dotenv.config();

async function checkUser() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dream';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const addressId = '69cb71973c2e501b5dc298b1';
  const user = await User.findOne({ 'addresses._id': addressId });
  
  if (user) {
    console.log('User found:', user._id);
    const addr = user.addresses.find(a => a._id.toString() === addressId);
    console.log('Address found:', addr);
    console.log('Is Default:', addr?.isDefault);
  } else {
    console.log('User not found with address ID:', addressId);
  }

  await mongoose.disconnect();
}

checkUser().catch(console.error);
