import mongoose from "mongoose";
import { User } from "../../src/models/User";
import { Product } from "../../src/models/Product";
import { Order } from "../../src/models/Order";
import { Otp } from "../../src/models/Otp";
import { Pincode } from "../../src/models/Pincode";
import { Cart } from "../../src/models/Cart";

async function resetDatabase() {
  console.log("🗑️  Resetting test database...");

  try {
    // Clear all collections
    await User.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await Otp.deleteMany({});
    await Pincode.deleteMany({});
    await Cart.deleteMany({});

    console.log("✅ Database reset successfully!");
  } catch (error) {
    console.error("❌ Error resetting database:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/test")
    .then(() => resetDatabase())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Reset failed:", error);
      process.exit(1);
    });
}

export default resetDatabase;
