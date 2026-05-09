
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../src/models/Product';

dotenv.config();

async function checkProduct() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/dream';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const productId = '69d4b1a2018c5fb9838176ba';
  const product = await Product.findById(productId);
  
  if (product) {
    console.log('Product found:', product._id);
    console.log('isSellable:', product.isSellable);
    console.log('price:', product.price);
    console.log('stock:', product.stock);
    console.log('reservedStock:', (product as any).reservedStock);
    console.log('deletedAt:', product.deletedAt);
  } else {
    console.log('Product not found:', productId);
  }

  await mongoose.disconnect();
}

checkProduct().catch(console.error);
