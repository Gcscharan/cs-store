import mongoose from "mongoose";
import { Product } from "../src/models/Product";

/**
 * Seed Products Script
 * Seeds 100 sample low-margin product items with categories: biscuit, ladoo, chocolate
 * Price range: ₹5-100
 */

interface ProductData {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  unit: string;
  margin: number;
  images: { full: string; thumb: string }[];
  tags: string[];
}

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/cps-store";
    await mongoose.connect(mongoURI);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

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

const generateProducts = (): ProductData[] => {
  const products: ProductData[] = [];

  // Biscuit products (40 items)
  const biscuitProducts = [
    { name: "Parle-G Original", basePrice: 5, unit: "packet" },
    { name: "Monaco Salted", basePrice: 8, unit: "packet" },
    { name: "Good Day Cashew", basePrice: 12, unit: "packet" },
    { name: "Marie Gold", basePrice: 6, unit: "packet" },
    { name: "Oreo Original", basePrice: 15, unit: "packet" },
    { name: "Bourbon Chocolate", basePrice: 10, unit: "packet" },
    { name: "Cream Biscuits", basePrice: 8, unit: "packet" },
    { name: "Digestive Biscuits", basePrice: 12, unit: "packet" },
    { name: "Coconut Biscuits", basePrice: 9, unit: "packet" },
    { name: "Butter Biscuits", basePrice: 7, unit: "packet" },
    { name: "Chocolate Biscuits", basePrice: 11, unit: "packet" },
    { name: "Sugar Free Biscuits", basePrice: 14, unit: "packet" },
    { name: "Glucose Biscuits", basePrice: 6, unit: "packet" },
    { name: "Crackers", basePrice: 8, unit: "packet" },
    { name: "Cookies Assorted", basePrice: 16, unit: "packet" },
    { name: "Shortbread Biscuits", basePrice: 13, unit: "packet" },
    { name: "Wafer Biscuits", basePrice: 9, unit: "packet" },
    { name: "Cream Sandwich", basePrice: 10, unit: "packet" },
    { name: "Chocolate Sandwich", basePrice: 12, unit: "packet" },
    { name: "Vanilla Biscuits", basePrice: 8, unit: "packet" },
    { name: "Strawberry Biscuits", basePrice: 9, unit: "packet" },
    { name: "Orange Biscuits", basePrice: 9, unit: "packet" },
    { name: "Lemon Biscuits", basePrice: 9, unit: "packet" },
    { name: "Almond Biscuits", basePrice: 15, unit: "packet" },
    { name: "Cashew Biscuits", basePrice: 14, unit: "packet" },
    { name: "Pista Biscuits", basePrice: 13, unit: "packet" },
    { name: "Kaju Biscuits", basePrice: 16, unit: "packet" },
    { name: "Dry Fruit Biscuits", basePrice: 18, unit: "packet" },
    { name: "Honey Biscuits", basePrice: 11, unit: "packet" },
    { name: "Ginger Biscuits", basePrice: 10, unit: "packet" },
    { name: "Cinnamon Biscuits", basePrice: 12, unit: "packet" },
    { name: "Cardamom Biscuits", basePrice: 13, unit: "packet" },
    { name: "Saffron Biscuits", basePrice: 20, unit: "packet" },
    { name: "Rose Biscuits", basePrice: 11, unit: "packet" },
    { name: "Kesar Biscuits", basePrice: 14, unit: "packet" },
    { name: "Elaichi Biscuits", basePrice: 12, unit: "packet" },
    { name: "Badam Biscuits", basePrice: 15, unit: "packet" },
    { name: "Mixed Nuts Biscuits", basePrice: 17, unit: "packet" },
    { name: "Fruit Biscuits", basePrice: 12, unit: "packet" },
    { name: "Choco Chip Biscuits", basePrice: 13, unit: "packet" },
  ];

  // Ladoo products (30 items)
  const ladooProducts = [
    { name: "Besan Ladoo", basePrice: 25, unit: "250g" },
    { name: "Rava Ladoo", basePrice: 20, unit: "250g" },
    { name: "Coconut Ladoo", basePrice: 22, unit: "250g" },
    { name: "Motichoor Ladoo", basePrice: 30, unit: "250g" },
    { name: "Kaju Ladoo", basePrice: 45, unit: "250g" },
    { name: "Badam Ladoo", basePrice: 40, unit: "250g" },
    { name: "Pista Ladoo", basePrice: 50, unit: "250g" },
    { name: "Dry Fruit Ladoo", basePrice: 60, unit: "250g" },
    { name: "Til Ladoo", basePrice: 18, unit: "250g" },
    { name: "Gur Ladoo", basePrice: 15, unit: "250g" },
    { name: "Churma Ladoo", basePrice: 28, unit: "250g" },
    { name: "Boondi Ladoo", basePrice: 25, unit: "250g" },
    { name: "Milk Ladoo", basePrice: 35, unit: "250g" },
    { name: "Kesari Ladoo", basePrice: 32, unit: "250g" },
    { name: "Rose Ladoo", basePrice: 28, unit: "250g" },
    { name: "Elaichi Ladoo", basePrice: 30, unit: "250g" },
    { name: "Saffron Ladoo", basePrice: 55, unit: "250g" },
    { name: "Kesar Ladoo", basePrice: 38, unit: "250g" },
    { name: "Mixed Ladoo", basePrice: 35, unit: "250g" },
    { name: "Chocolate Ladoo", basePrice: 42, unit: "250g" },
    { name: "Vanilla Ladoo", basePrice: 25, unit: "250g" },
    { name: "Strawberry Ladoo", basePrice: 28, unit: "250g" },
    { name: "Orange Ladoo", basePrice: 26, unit: "250g" },
    { name: "Lemon Ladoo", basePrice: 24, unit: "250g" },
    { name: "Mango Ladoo", basePrice: 30, unit: "250g" },
    { name: "Pineapple Ladoo", basePrice: 28, unit: "250g" },
    { name: "Grape Ladoo", basePrice: 26, unit: "250g" },
    { name: "Apple Ladoo", basePrice: 27, unit: "250g" },
    { name: "Banana Ladoo", basePrice: 22, unit: "250g" },
    { name: "Date Ladoo", basePrice: 35, unit: "250g" },
  ];

  // Chocolate products (30 items)
  const chocolateProducts = [
    { name: "Milk Chocolate Bar", basePrice: 15, unit: "50g" },
    { name: "Dark Chocolate Bar", basePrice: 18, unit: "50g" },
    { name: "White Chocolate Bar", basePrice: 16, unit: "50g" },
    { name: "Chocolate Truffles", basePrice: 25, unit: "100g" },
    { name: "Chocolate Coins", basePrice: 20, unit: "100g" },
    { name: "Chocolate Balls", basePrice: 22, unit: "100g" },
    { name: "Chocolate Cookies", basePrice: 12, unit: "packet" },
    { name: "Chocolate Biscuits", basePrice: 14, unit: "packet" },
    { name: "Chocolate Wafers", basePrice: 10, unit: "packet" },
    { name: "Chocolate Cream", basePrice: 18, unit: "100g" },
    { name: "Chocolate Spread", basePrice: 35, unit: "200g" },
    { name: "Chocolate Syrup", basePrice: 25, unit: "200ml" },
    { name: "Chocolate Powder", basePrice: 30, unit: "100g" },
    { name: "Chocolate Chips", basePrice: 20, unit: "100g" },
    { name: "Chocolate Drops", basePrice: 15, unit: "50g" },
    { name: "Chocolate Buttons", basePrice: 12, unit: "50g" },
    { name: "Chocolate Hearts", basePrice: 18, unit: "50g" },
    { name: "Chocolate Stars", basePrice: 16, unit: "50g" },
    { name: "Chocolate Squares", basePrice: 14, unit: "50g" },
    { name: "Chocolate Circles", basePrice: 13, unit: "50g" },
    { name: "Chocolate Triangles", basePrice: 15, unit: "50g" },
    { name: "Chocolate Diamonds", basePrice: 20, unit: "50g" },
    { name: "Chocolate Cubes", basePrice: 17, unit: "50g" },
    { name: "Chocolate Sticks", basePrice: 12, unit: "50g" },
    { name: "Chocolate Rings", basePrice: 14, unit: "50g" },
    { name: "Chocolate Bars Mini", basePrice: 8, unit: "25g" },
    { name: "Chocolate Bars Large", basePrice: 35, unit: "100g" },
    { name: "Chocolate Gift Box", basePrice: 50, unit: "200g" },
    { name: "Chocolate Assorted", basePrice: 45, unit: "150g" },
    { name: "Chocolate Premium", basePrice: 60, unit: "100g" },
  ];

  // Generate products with variations
  const allProducts = [
    ...biscuitProducts.map((p) => ({ ...p, category: "biscuit" })),
    ...ladooProducts.map((p) => ({ ...p, category: "ladoo" })),
    ...chocolateProducts.map((p) => ({ ...p, category: "chocolate" })),
  ];

  allProducts.forEach((product, index) => {
    // Add some price variations (±20%)
    const priceVariation = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
    const finalPrice = Math.round(product.basePrice * priceVariation);

    // Ensure price is within range (₹5-100)
    const price = Math.max(5, Math.min(100, finalPrice));

    // Calculate margin (10-25%)
    const margin = 10 + Math.random() * 15;

    products.push({
      name: product.name,
      description: `Delicious ${product.name.toLowerCase()} - perfect for snacking and gifting. Made with quality ingredients.`,
      price,
      category: product.category,
      stock: Math.floor(Math.random() * 50) + 10, // 10-60 stock
      weight: Math.floor(Math.random() * 100) + 50, // 50-150g weight
      margin,
      images: [generateBase64Image(product.name.substring(0, 10))], // Generate dual-resolution images
      tags: [product.category, "snacks", "sweets", "indian", "traditional"],
    });
  });

  return products;
};

const seedProducts = async () => {
  try {
    console.log("🚀 Starting product seeding...");

    // Clear existing products
    await Product.deleteMany({});
    console.log("🗑️  Cleared existing products");

    // Generate products
    const products = generateProducts();
    console.log(`📊 Generated ${products.length} products`);

    // Insert products
    await Product.insertMany(products);
    console.log(`✅ Successfully seeded ${products.length} products`);

    // Create indexes for better performance
    await Product.createIndexes();
    console.log("📈 Created database indexes");

    // Display summary
    const categoryCounts = products.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priceStats = {
      min: Math.min(...products.map((p) => p.price)),
      max: Math.max(...products.map((p) => p.price)),
      avg: Math.round(
        products.reduce((sum, p) => sum + p.price, 0) / products.length
      ),
    };

    console.log("\n📋 Seeding Summary:");
    Object.entries(categoryCounts).forEach(([category, count]) => {
      console.log(`  ${category}: ${count} products`);
    });

    console.log(`\n💰 Price Statistics:`);
    console.log(`  Min: ₹${priceStats.min}`);
    console.log(`  Max: ₹${priceStats.max}`);
    console.log(`  Avg: ₹${priceStats.avg}`);

    console.log("\n🎉 Product seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding products:", error);
    throw error;
  }
};

const main = async () => {
  try {
    await connectDB();
    await seedProducts();
  } catch (error) {
    console.error("❌ Script failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("👋 Disconnected from MongoDB");
    process.exit(0);
  }
};

// Run the script
if (require.main === module) {
  main();
}

export { seedProducts };
