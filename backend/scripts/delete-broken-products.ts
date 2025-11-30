import mongoose from "mongoose";
import { Product } from "../src/models/Product";
require("dotenv").config({ path: ".env" });

(async () => {
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri);

  // Delete the specific broken product
  const result = await Product.deleteOne({ 
    _id: "692b1a18e9c871a5282db4fa" 
  });

  console.log("❌ Deleted broken product:", result.deletedCount);

  await mongoose.disconnect();
})();
