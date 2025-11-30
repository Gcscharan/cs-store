import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../src/models/Product';

dotenv.config();

async function inspectImages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('🔗 Connected to MongoDB\n');

    // Get all products
    const products = await Product.find({}).lean();
    
    console.log(`📊 Found ${products.length} products\n`);
    console.log('='.repeat(80));
    
    products.forEach((product, index) => {
      console.log(`\n🔍 Product #${index + 1}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   ID: ${product._id}`);
      console.log(`   Images array length: ${product.images?.length || 0}`);
      
      if (product.images && product.images.length > 0) {
        console.log(`   First image object:`);
        console.log(`   Keys: ${Object.keys(product.images[0])}`);
        console.log(`   Content:`, JSON.stringify(product.images[0], null, 2));
      } else {
        console.log(`   Images: ${JSON.stringify(product.images)}`);
      }
      
      console.log('   ' + '-'.repeat(60));
    });

    // Summary statistics
    console.log('\n📈 SUMMARY STATISTICS');
    console.log('='.repeat(80));
    
    let totalProducts = products.length;
    let withImages = 0;
    let withValidStructure = 0;
    let withOnlyId = 0;
    let withEmptyArray = 0;
    let withUndefined = 0;
    
    products.forEach(product => {
      if (!product.images) {
        withUndefined++;
      } else if (product.images.length === 0) {
        withEmptyArray++;
      } else {
        withImages++;
        const firstImage = product.images[0];
        const keys = Object.keys(firstImage);
        
        if (keys.length === 1 && keys[0] === '_id') {
          withOnlyId++;
        } else if (firstImage.full || firstImage.thumb || (firstImage as any).variants) {
          withValidStructure++;
        }
      }
    });
    
    console.log(`Total products: ${totalProducts}`);
    console.log(`Products with images: ${withImages}`);
    console.log(`Products with valid structure: ${withValidStructure}`);
    console.log(`Products with only _id: ${withOnlyId}`);
    console.log(`Products with empty array: ${withEmptyArray}`);
    console.log(`Products with undefined images: ${withUndefined}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

inspectImages();
