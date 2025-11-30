/**
 * MASTER SEED SCRIPT - Populates MongoDB Atlas with all necessary data
 * Run: npx ts-node scripts/SEED_ALL_DATA.ts
 */
import mongoose from "mongoose";
import { Product } from "../src/models/Product";
import { Pincode } from "../src/models/Pincode";
import { User } from "../src/models/User";
import * as dotenv from "dotenv";
import * as bcrypt from "bcryptjs";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";

// Generate Base64 placeholder images
const generateBase64Image = (text: string, size: number = 300): { full: string; thumb: string } => {
  const colors = ["FF6B6B", "4ECDC4", "45B7D1", "96CEB4", "FFEAA7", "DDA0DD", "98D8C8"];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  // Full size image (300x300)
  const fullSvg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#${color}"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="16" font-weight="bold" 
            text-anchor="middle" dominant-baseline="middle" fill="white">
        ${text}
      </text>
    </svg>
  `;
  
  // Thumbnail (220x220)
  const thumbSvg = `
    <svg width="220" height="220" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#${color}"/>
      <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="12" font-weight="bold" 
            text-anchor="middle" dominant-baseline="middle" fill="white">
        ${text}
      </text>
    </svg>
  `;
  
  return {
    full: `data:image/svg+xml;base64,${Buffer.from(fullSvg.trim()).toString('base64')}`,
    thumb: `data:image/svg+xml;base64,${Buffer.from(thumbSvg.trim()).toString('base64')}`
  };
};

// Sample Products Data
const products = [
  // Chocolates
  { name: "Dairy Milk", category: "chocolates", price: 40, mrp: 45, stock: 100, weight: 45, images: [generateBase64Image("Dairy Milk")], description: "Smooth milk chocolate", tags: ["chocolate", "dairy milk", "cadbury"], sku: "CHO001" },
  { name: "5 Star", category: "chocolates", price: 10, mrp: 12, stock: 200, weight: 25, images: [generateBase64Image("5 Star")], description: "Caramel chocolate bar", tags: ["chocolate", "5star", "cadbury"], sku: "CHO002" },
  { name: "KitKat", category: "chocolates", price: 20, mrp: 25, stock: 150, weight: 35, images: [generateBase64Image("KitKat")], description: "Crispy wafer chocolate", tags: ["chocolate", "kitkat", "nestle"], sku: "CHO003" },
  { name: "Perk", category: "chocolates", price: 10, mrp: 12, stock: 180, weight: 20, images: [generateBase64Image("Perk")], description: "Wafer chocolate bar", tags: ["chocolate", "perk", "cadbury"], sku: "CHO004" },
  { name: "Munch", category: "chocolates", price: 10, mrp: 12, stock: 160, weight: 20, images: [generateBase64Image("Munch")], description: "Crunchy chocolate bar", tags: ["chocolate", "munch", "nestle"], sku: "CHO005" },
  
  // Biscuits
  { name: "Parle-G", category: "biscuits", price: 5, mrp: 6, stock: 300, weight: 70, images: [generateBase64Image("Parle-G")], description: "Original glucose biscuit", tags: ["biscuit", "parle", "glucose"], sku: "BIS001" },
  { name: "Good Day", category: "biscuits", price: 12, mrp: 15, stock: 200, weight: 75, images: [generateBase64Image("Good Day")], description: "Butter cookies", tags: ["biscuit", "britannia", "cookies"], sku: "BIS002" },
  { name: "Monaco", category: "biscuits", price: 10, mrp: 12, stock: 180, weight: 70, images: [generateBase64Image("Monaco")], description: "Salted biscuit", tags: ["biscuit", "parle", "salted"], sku: "BIS003" },
  { name: "Marie Gold", category: "biscuits", price: 15, mrp: 18, stock: 150, weight: 100, images: [generateBase64Image("Marie")], description: "Tea time biscuit", tags: ["biscuit", "britannia", "marie"], sku: "BIS004" },
  { name: "Oreo", category: "biscuits", price: 20, mrp: 25, stock: 140, weight: 80, images: [generateBase64Image("Oreo")], description: "Chocolate sandwich cookies", tags: ["biscuit", "oreo", "cookies"], sku: "BIS005" },
  
  // Cakes
  { name: "Britannia Cake", category: "cakes", price: 20, mrp: 25, stock: 100, weight: 50, images: [generateBase64Image("Cake")], description: "Chocolate sponge cake", tags: ["cake", "britannia", "chocolate"], sku: "CAK001" },
  { name: "Monginis Pastry", category: "cakes", price: 40, mrp: 45, stock: 50, weight: 80, images: [generateBase64Image("Pastry")], description: "Fresh pastry", tags: ["cake", "monginis", "pastry"], sku: "CAK002" },
  
  // Ladoos
  { name: "Besan Ladoo", category: "ladoos", price: 50, mrp: 60, stock: 80, weight: 200, images: [generateBase64Image("Besan")], description: "Traditional gram flour ladoo", tags: ["ladoo", "besan", "sweet"], sku: "LAD001" },
  { name: "Boondi Ladoo", category: "ladoos", price: 45, mrp: 50, stock: 90, weight: 200, images: [generateBase64Image("Boondi")], description: "Sweet boondi balls", tags: ["ladoo", "boondi", "sweet"], sku: "LAD002" },
  { name: "Motichoor Ladoo", category: "ladoos", price: 60, mrp: 70, stock: 70, weight: 200, images: [generateBase64Image("Motichoor")], description: "Fine boondi ladoo", tags: ["ladoo", "motichoor", "sweet"], sku: "LAD003" },
  
  // Snacks
  { name: "Lays Classic", category: "snacks", price: 20, mrp: 25, stock: 200, weight: 50, images: [generateBase64Image("Lays")], description: "Salted potato chips", tags: ["snacks", "lays", "chips"], sku: "SNA001" },
  { name: "Kurkure", category: "snacks", price: 20, mrp: 25, stock: 180, weight: 60, images: [generateBase64Image("Kurkure")], description: "Crunchy corn snack", tags: ["snacks", "kurkure", "spicy"], sku: "SNA002" },
  { name: "Bingo", category: "snacks", price: 10, mrp: 12, stock: 150, weight: 40, images: [generateBase64Image("Bingo")], description: "Masala chips", tags: ["snacks", "bingo", "masala"], sku: "SNA003" },
  
  // Beverages
  { name: "Coca Cola", category: "beverages", price: 40, mrp: 45, stock: 100, weight: 500, images: [generateBase64Image("Coke")], description: "Soft drink", tags: ["beverage", "coke", "cola"], sku: "BEV001" },
  { name: "Pepsi", category: "beverages", price: 40, mrp: 45, stock: 100, weight: 500, images: [generateBase64Image("Pepsi")], description: "Soft drink", tags: ["beverage", "pepsi"], sku: "BEV002" },
  { name: "Sprite", category: "beverages", price: 40, mrp: 45, stock: 90, weight: 500, images: [generateBase64Image("Sprite")], description: "Lemon drink", tags: ["beverage", "sprite", "lemon"], sku: "BEV003" },
  
  // Groceries
  { name: "Tata Salt", category: "groceries", price: 20, mrp: 22, stock: 200, weight: 1000, images: [generateBase64Image("Salt")], description: "Iodized salt", tags: ["grocery", "salt", "tata"], sku: "GRO001" },
  { name: "Fortune Oil", category: "groceries", price: 180, mrp: 200, stock: 80, weight: 1000, images: [generateBase64Image("Oil")], description: "Sunflower oil", tags: ["grocery", "oil", "fortune"], sku: "GRO002" },
  { name: "India Gate Basmati", category: "groceries", price: 150, mrp: 170, stock: 100, weight: 1000, images: [generateBase64Image("Rice")], description: "Basmati rice", tags: ["grocery", "rice", "basmati"], sku: "GRO003" },
  
  // Dairy
  { name: "Amul Milk", category: "dairy", price: 60, mrp: 65, stock: 50, weight: 1000, images: [generateBase64Image("Milk")], description: "Full cream milk", tags: ["dairy", "milk", "amul"], sku: "DAI001" },
  { name: "Amul Butter", category: "dairy", price: 50, mrp: 55, stock: 80, weight: 100, images: [generateBase64Image("Butter")], description: "Salted butter", tags: ["dairy", "butter", "amul"], sku: "DAI002" },
  { name: "Amul Cheese", category: "dairy", price: 140, mrp: 150, stock: 60, weight: 200, images: [generateBase64Image("Cheese")], description: "Processed cheese", tags: ["dairy", "cheese", "amul"], sku: "DAI003" },
];

// Sample Pincodes (Hyderabad & nearby)
const pincodes = [
  { pincode: "500001", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" },
  { pincode: "500002", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" },
  { pincode: "500003", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" },
  { pincode: "500004", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" },
  { pincode: "500005", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" },
  { pincode: "500006", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" },
  { pincode: "500007", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" },
  { pincode: "500008", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" },
  { pincode: "500009", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" },
  { pincode: "500010", state: "Telangana", district: "Hyderabad", taluka: "Hyderabad" },
  { pincode: "500016", state: "Telangana", district: "Hyderabad", taluka: "Charminar" },
  { pincode: "500018", state: "Telangana", district: "Hyderabad", taluka: "Secunderabad" },
  { pincode: "500020", state: "Telangana", district: "Hyderabad", taluka: "Khairatabad" },
  { pincode: "500029", state: "Telangana", district: "Hyderabad", taluka: "Malakpet" },
  { pincode: "500034", state: "Telangana", district: "Hyderabad", taluka: "Malkajgiri" },
  { pincode: "500035", state: "Telangana", district: "Hyderabad", taluka: "Kukatpally" },
  { pincode: "500038", state: "Telangana", district: "Hyderabad", taluka: "Secunderabad" },
  { pincode: "500050", state: "Telangana", district: "Hyderabad", taluka: "Banjara Hills" },
  { pincode: "500081", state: "Telangana", district: "Hyderabad", taluka: "Gachibowli" },
  { pincode: "500082", state: "Telangana", district: "Hyderabad", taluka: "Madhapur" },
];

async function seedDatabase() {
  try {
    // Connect to MongoDB Atlas
    console.log("🔌 Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB Atlas\n");

    // 1. Seed Products
    console.log("📦 Seeding Products...");
    await Product.deleteMany({}); // Clear existing
    const createdProducts = await Product.insertMany(products);
    console.log(`✅ Inserted ${createdProducts.length} products\n`);

    // 2. Seed Pincodes
    console.log("📍 Seeding Pincodes...");
    await Pincode.deleteMany({}); // Clear existing
    const createdPincodes = await Pincode.insertMany(pincodes);
    console.log(`✅ Inserted ${createdPincodes.length} pincodes\n`);

    // 3. Create Test Customer
    console.log("👤 Creating Test Customer...");
    const existingCustomer = await User.findOne({ email: "customer@test.com" });
    if (!existingCustomer) {
      const customerPassword = await bcrypt.hash("customer123", 10);
      const customer = new User({
        name: "Test Customer",
        email: "customer@test.com",
        phone: "9876543211",
        passwordHash: customerPassword,
        role: "customer",
        status: "active",
        addresses: [
          {
            label: "Home",
            pincode: "500001",
            city: "Hyderabad",
            state: "Telangana",
            addressLine: "123 Test Street, Hyderabad",
            lat: 17.385044,
            lng: 78.486671,
            isDefault: true,
          },
        ],
      });
      await customer.save();
      console.log("✅ Test customer created: customer@test.com / customer123\n");
    } else {
      console.log("✅ Test customer already exists\n");
    }

    // Summary
    console.log("=" .repeat(60));
    console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(60));
    
    const productCount = await Product.countDocuments();
    const pincodeCount = await Pincode.countDocuments();
    const userCount = await User.countDocuments();

    console.log(`\n📊 DATABASE SUMMARY:`);
    console.log(`   Products: ${productCount}`);
    console.log(`   Pincodes: ${pincodeCount}`);
    console.log(`   Users: ${userCount}`);
    
    console.log(`\n🔐 TEST ACCOUNTS:`);
    console.log(`   Admin: gcs.charan@gmail.com / Gcs@2004`);
    console.log(`   Delivery: delivery@test.com / delivery123`);
    console.log(`   Customer: customer@test.com / customer123`);
    
    console.log("\n✅ Your MongoDB Atlas database is now ready to use!");

  } catch (error) {
    console.error("❌ Seeding error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n🔌 Disconnected from MongoDB");
  }
}

// Run the seed
seedDatabase();
