import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Product } from '../src/models/Product';

dotenv.config();

// Safe fallback Cloudinary demo URLs
const FALLBACK_FULL = "https://res.cloudinary.com/demo/image/upload/sample.jpg";
const FALLBACK_THUMB = "https://res.cloudinary.com/demo/image/upload/c_fill,w_300,h_300/sample.jpg";

async function restoreImages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('🔗 Connected to MongoDB\n');

    // Get all products
    const products = await Product.find({});
    console.log(`📊 Found ${products.length} products\n`);

    let restoredCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      const productId = product._id.toString();
      
      // Check if images are corrupted
      const isCorrupted = !product.images || 
                         product.images.length === 0 ||
                         (product.images.length === 1 && 
                          (!product.images[0].full && !product.images[0].thumb && !(product.images[0] as any).variants));

      if (isCorrupted) {
        console.log(`🔧 Restoring images for: ${product.name} (${productId})`);
        
        // Restore with safe minimal structure
        product.images = [{
          full: FALLBACK_FULL,
          thumb: FALLBACK_THUMB
        }];
        
        await product.save();
        restoredCount++;
        console.log(`   ✅ Restored with fallback images`);
      } else {
        console.log(`⏭️  Skipping valid images for: ${product.name}`);
        skippedCount++;
      }
    }

    console.log('\n📈 RESTORATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total products: ${products.length}`);
    console.log(`Products restored: ${restoredCount}`);
    console.log(`Products skipped: ${skippedCount}`);

    // Verify restoration
    console.log('\n🔍 VERIFICATION - Checking first 3 restored products:');
    const verificationProducts = await Product.find({}).limit(3);
    
    verificationProducts.forEach((product, index) => {
      console.log(`\nProduct #${index + 1}: ${product.name}`);
      console.log(`   Images array length: ${product.images?.length || 0}`);
      if (product.images && product.images.length > 0) {
        console.log(`   First image keys: ${Object.keys(product.images[0])}`);
        console.log(`   Full URL: ${product.images[0].full}`);
        console.log(`   Thumb URL: ${product.images[0].thumb}`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

restoreImages();
