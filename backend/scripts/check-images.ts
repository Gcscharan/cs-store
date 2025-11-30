import mongoose from "mongoose";
import dotenv from "dotenv";
import { Product } from "../src/models/Product";

dotenv.config();
async function check() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('🔗 Connected to MongoDB');
  
  const products = await Product.find({}).limit(50).lean();
  let ok = 0, total = products.length;
  let withVariants = 0;
  let withFormats = 0;
  let withPublicId = 0;
  
  products.forEach(p => { 
    if (p.images && p.images.length > 0) {
      const first: any = p.images[0];
      if (first && typeof first === 'object' && first.variants) {
        ok++;
        withVariants++;
      }
      if (first && typeof first === 'object' && first.formats) {
        withFormats++;
      }
      if (first && typeof first === 'object' && first.publicId) {
        withPublicId++;
      }
    }
  });
  
  console.log({
    total,
    hasImages: ok,
    withVariants,
    withFormats,
    withPublicId,
    percentage: total > 0 ? Math.round((ok / total) * 100) : 0
  });
  
  // Show sample structure
  if (ok > 0) {
    const sample = products.find((p: any) => p.images && p.images[0] && p.images[0].variants);
    console.log('\n📋 Sample structure:');
    console.log(JSON.stringify(sample.images[0], null, 2));
  }
  
  await mongoose.disconnect();
}
check();
