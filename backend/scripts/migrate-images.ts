import mongoose from "mongoose";
import dotenv from "dotenv";
import { Product } from "../src/models/Product";
import { normalizeProductImages } from "../src/domains/catalog/controllers/productController";

dotenv.config();
const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI missing');

async function migrate() {
  await mongoose.connect(uri, { /* options */ });
  console.log('🔗 Connected to MongoDB');
  
  const cursor = Product.find({}).cursor();
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  
  for await (const p of cursor) {
    try {
      const orig = p.toObject();
      const normalized = await normalizeProductImages(orig);
      
      // Only update if changed
      const origStr = JSON.stringify(orig.images);
      const newStr = JSON.stringify(normalized.images);
      
      if (origStr !== newStr) {
        console.log(`\n🔄 Updating ${p._id} - ${p.name}`);
        console.log(`   Before: ${origStr.substring(0, 100)}...`);
        console.log(`   After:  ${newStr.substring(0, 100)}...`);
        
        const result = await Product.updateOne(
          { _id: p._id }, 
          { $set: { images: normalized.images } }
        );
        
        if (result.modifiedCount > 0) {
          updated++;
          console.log(`   ✅ Successfully updated`);
        } else {
          console.log(`   ⚠️ Update failed - no changes made`);
        }
      } else {
        skipped++;
      }
    } catch (err) {
      errors++;
      console.error(`❌ Error processing ${p._id}:`, err);
    }
  }
  
  console.log(`\n🎉 Migration complete — updated ${updated} products, skipped ${skipped}, errors ${errors}`);
  await mongoose.disconnect();
}

migrate().catch(err => { console.error(err); process.exit(1); });
