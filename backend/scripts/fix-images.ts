import mongoose from "mongoose";
import dotenv from "dotenv";
import { Product } from "../src/models/Product";
import { normalizeProductImages } from "../src/domains/catalog/controllers/productController";

dotenv.config();
const uri = process.env.MONGODB_URI!;
if (!uri) throw new Error('MONGODB_URI missing');

async function fixImages() {
  await mongoose.connect(uri);
  console.log('🔗 Connected to MongoDB');
  
  const cursor = Product.find({}).cursor();
  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  
  for await (const p of cursor) {
    try {
      const product = p.toObject();
      
      console.log(`\n🔧 Processing ${p._id} - ${p.name}`);
      console.log(`   Current images:`, JSON.stringify(product.images, null, 2));
      
      // Use normalizeProductImages to get the correct structure
      const normalizedProduct = await normalizeProductImages(product);
      
      // Ensure we have the correct image structure
      if (normalizedProduct.images && normalizedProduct.images.length > 0) {
        const firstImage = normalizedProduct.images[0];
        
        // Verify the structure is correct
        if (firstImage.variants && firstImage.formats && firstImage.metadata) {
          console.log(`   ✅ Correct structure detected`);
          console.log(`   Variants:`, Object.keys(firstImage.variants || {}));
          console.log(`   Formats:`, Object.keys(firstImage.formats || {}));
          console.log(`   Metadata:`, Object.keys(firstImage.metadata || {}));
          
          // Update the product with the corrected images
          const result = await Product.updateOne(
            { _id: p._id }, 
            { $set: { images: normalizedProduct.images } }
          );
          
          if (result.modifiedCount > 0) {
            fixed++;
            console.log(`   ✅ Successfully fixed images`);
          } else {
            console.log(`   ℹ️ No changes needed`);
            skipped++;
          }
        } else {
          console.log(`   ❌ Invalid structure after normalization`);
          console.log(`   Has variants:`, !!firstImage.variants);
          console.log(`   Has formats:`, !!firstImage.formats);
          console.log(`   Has metadata:`, !!firstImage.metadata);
          errors++;
        }
      } else {
        console.log(`   ❌ No images found after normalization`);
        errors++;
      }
    } catch (err) {
      errors++;
      console.error(`❌ Error processing ${p._id}:`, err);
    }
  }
  
  console.log(`\n🎉 Image fix complete — fixed ${fixed} products, skipped ${skipped}, errors ${errors}`);
  await mongoose.disconnect();
}

fixImages().catch(err => { console.error(err); process.exit(1); });
