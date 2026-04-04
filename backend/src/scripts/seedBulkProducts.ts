import { logger } from '../utils/logger';
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import { Product } from "../models/Product";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  logger.error("❌ CRITICAL: MONGODB_URI environment variable is not set!");
  process.exit(1);
}

const CATEGORIES = [
  "chocolates",
  "biscuits",
  "ladoos",
  "cakes",
  "hot_snacks",
  "groceries",
  "vegetables",
  "fruits",
  "dairy",
  "meat",
  "beverages",
  "snacks",
];

const IMAGE_POOLS: Record<string, string[]> = {
  chocolates: [
    "https://images.unsplash.com/photo-1549007994-cb92cafabf10?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1548907040-4baa42d100c9?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1614088685112-0a760b71a3c8?auto=format&fit=crop&q=80&w=800",
  ],
  biscuits: [
    "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=800",
  ],
  ladoos: [
    "https://images.unsplash.com/photo-1605192554106-d549b1b975cd?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1589113182023-708e43d72740?auto=format&fit=crop&q=80&w=800",
  ],
  cakes: [
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1535141192574-5d48bb7af09b?auto=format&fit=crop&q=80&w=800",
  ],
  vegetables: [
    "https://images.unsplash.com/photo-1566385101042-1a000c1267c4?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1597362868123-a509f8176b6c?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1518843875459-f738682238a6?auto=format&fit=crop&q=80&w=800",
  ],
  fruits: [
    "https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1519996529931-28324d5a630e?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1490818387583-1b05e6382b4f?auto=format&fit=crop&q=80&w=800",
  ],
  dairy: [
    "https://images.unsplash.com/photo-1550583724-125581cc254b?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1528750955925-53f5a3eaee1f?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1563636619-e910ef49e9d3?auto=format&fit=crop&q=80&w=800",
  ],
  beverages: [
    "https://images.unsplash.com/photo-1544145945-f904253d0c7b?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1581009146145-b5ef03a7403f?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=800",
  ],
  default: [
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=800",
    "https://images.unsplash.com/photo-1506617424156-76a1f992e230?auto=format&fit=crop&q=80&w=800",
  ]
};

const VIDEO_POOL = [
  "https://assets.mixkit.co/videos/preview/mixkit-pouring-milk-into-a-glass-34433-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-hands-cutting-fresh-vegetables-on-a-wooden-board-40456-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-close-up-of-fresh-fruits-in-a-basket-40451-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-serving-hot-coffee-in-a-white-cup-34435-large.mp4",
  "https://assets.mixkit.co/videos/preview/mixkit-person-taking-a-slice-of-pizza-34431-large.mp4",
];

async function seedProducts() {
  try {
    await mongoose.connect(MONGODB_URI!);
    logger.info("📡 Connected to MongoDB for seeding...");

    // Optional: Clear existing products if needed
    await Product.deleteMany({ sku: { $regex: /^SKU-/ } });
    logger.info("🗑️ Cleared previous seeded products");

    const productsToCreate = 500;
    const productsWithVideo = 300;
    const batchSize = 50;

    for (let i = 0; i < productsToCreate; i += batchSize) {
      const batch = [];
      const currentBatchSize = Math.min(batchSize, productsToCreate - i);

      for (let j = 0; j < currentBatchSize; j++) {
        const index = i + j;
        const category = CATEGORIES[index % CATEGORIES.length];
        const name = `${category.charAt(0).toUpperCase() + category.slice(1)} Premium ${index + 1}`;
        const price = Math.floor(Math.random() * 500) + 10;
        const pricePerUnit = Math.floor(Math.random() * (price / 2)) + 1;
        
        const images = IMAGE_POOLS[category] || IMAGE_POOLS.default;
        const imageUrl = images[index % images.length];

        const productData: any = {
          name,
          description: `High quality ${name} from our curated ${category} collection. Fresh, organic, and locally sourced.`,
          category,
          price,
          pricePerUnit,
          mrp: price + Math.floor(Math.random() * 50),
          stock: Math.floor(Math.random() * 200) + 20,
          weight: Math.floor(Math.random() * 1000) + 100,
          images: [{
            publicId: `seed-${category}-${index}`,
            variants: {
              original: imageUrl,
              medium: imageUrl,
              small: imageUrl,
              thumb: imageUrl
            }
          }],
          tags: [category, "premium", "fresh"],
          sku: `SKU-${category.toUpperCase()}-${index}`,
        };

        if (index < productsWithVideo) {
          const videoUrl = VIDEO_POOL[index % VIDEO_POOL.length];
          productData.videos = [{
            url: videoUrl,
            format: "mp4",
            duration: 15
          }];
        }

        batch.push(productData);
      }

      await Product.insertMany(batch);
      logger.info(`✅ Seeded batch ${i / batchSize + 1} (${i + batch.length}/${productsToCreate})`);
    }

    logger.info("🎯 Seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    logger.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedProducts();
