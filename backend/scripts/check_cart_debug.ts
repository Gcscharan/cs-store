
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Cart } from '../src/models/Cart';

dotenv.config();

async function checkCart() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dream';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const userId = '69cb600be362aea587ec9eb3';
  const cart = await Cart.findOne({ userId });
  
  if (cart) {
    console.log('Cart found:', cart._id);
    console.log('Items:', cart.items.length);
    console.log('Items Detail:', JSON.stringify(cart.items, null, 2));
  } else {
    console.log('Cart not found for user:', userId);
  }

  await mongoose.disconnect();
}

checkCart().catch(console.error);
