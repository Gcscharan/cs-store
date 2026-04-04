import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { Product } from '../models/Product';
import { MediaGenerator } from './mediaGenerator';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  logger.error('❌ CRITICAL: MONGODB_URI environment variable is not set!');
  process.exit(1);
}

const CATEGORIES = [
  'chocolates',
  'biscuits',
  'ladoos',
  'cakes',
  'hot_snacks',
  'groceries',
  'vegetables',
  'fruits',
  'dairy',
  'meat',
  'beverages',
  'snacks',
];

// Product name templates for variety
const NAME_TEMPLATES: Record<string, string[]> = {
  chocolates: ['Dark', 'Milk', 'White', 'Premium', 'Artisan', 'Organic'],
  biscuits: ['Butter', 'Cream', 'Digestive', 'Marie', 'Coconut', 'Chocolate'],
  ladoos: ['Besan', 'Rava', 'Coconut', 'Motichoor', 'Boondi', 'Til'],
  cakes: ['Chocolate', 'Vanilla', 'Strawberry', 'Black Forest', 'Red Velvet', 'Fruit'],
  hot_snacks: ['Samosa', 'Pakora', 'Vada', 'Cutlet', 'Roll', 'Puff'],
  groceries: ['Rice', 'Wheat', 'Dal', 'Oil', 'Sugar', 'Salt'],
  vegetables: ['Tomato', 'Potato', 'Onion', 'Carrot', 'Cabbage', 'Spinach'],
  fruits: ['Apple', 'Banana', 'Orange', 'Mango', 'Grapes', 'Watermelon'],
  dairy: ['Milk', 'Curd', 'Butter', 'Cheese', 'Paneer', 'Ghee'],
  meat: ['Chicken', 'Mutton', 'Fish', 'Prawns', 'Eggs', 'Sausage'],
  beverages: ['Tea', 'Coffee', 'Juice', 'Soda', 'Water', 'Energy Drink'],
  snacks: ['Chips', 'Namkeen', 'Popcorn', 'Nuts', 'Crackers', 'Wafers'],
};

interface SeedStats {
  total: number;
  success: number;
  failed: number;
  fallbackUsed: number;
  videosAdded: number;
  startTime: Date;
  endTime?: Date;
}

async function seedProducts() {
  const stats: SeedStats = {
    total: 0,
    success: 0,
    failed: 0,
    fallbackUsed: 0,
    videosAdded: 0,
    startTime: new Date(),
  };

  try {
    await mongoose.connect(MONGODB_URI!);
    logger.info('📡 Connected to MongoDB for seeding...');

    // Clear existing seeded products
    const deleteResult = await Product.deleteMany({ sku: { $regex: /^SKU-/ } });
    logger.info(`🗑️  Cleared ${deleteResult.deletedCount} previous seeded products`);

    const productsToCreate = 500;
    const productsWithVideo = 300; // First 300 products get videos
    const batchSize = 50;
    const mediaGenerator = new MediaGenerator();

    stats.total = productsToCreate;

    for (let i = 0; i < productsToCreate; i += batchSize) {
      const batch = [];
      const currentBatchSize = Math.min(batchSize, productsToCreate - i);

      logger.info(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(productsToCreate / batchSize)}...`);

      for (let j = 0; j < currentBatchSize; j++) {
        const index = i + j;
        const category = CATEGORIES[index % CATEGORIES.length];
        const templates = NAME_TEMPLATES[category] || ['Premium'];
        const template = templates[index % templates.length];
        
        // Generate unique product name
        const name = `${template} ${category.charAt(0).toUpperCase() + category.slice(1)} ${index + 1}`;
        
        const price = Math.floor(Math.random() * 500) + 10;
        const pricePerUnit = Math.max(1, Math.floor(Math.random() * (price / 2)) + 1);
        const productId = `${category}-${index}`;

        try {
          // Generate and validate media
          const media = await mediaGenerator.generateProductMedia({
            productId,
            category,
            index,
            includeVideo: index < productsWithVideo,
          });

          // Check if fallback was used
          if (media.images.includes('https://picsum.photos/400')) {
            stats.fallbackUsed++;
          }

          if (media.video) {
            stats.videosAdded++;
          }

          // Build product data with validated media
          const productData: any = {
            name,
            description: `High quality ${name} from our curated ${category} collection. Fresh, organic, and locally sourced. Perfect for daily use.`,
            category,
            price,
            pricePerUnit,
            mrp: price + Math.floor(Math.random() * 50),
            stock: Math.floor(Math.random() * 200) + 20,
            weight: Math.floor(Math.random() * 1000) + 100,
            images: media.images.map((url, idx) => ({
              publicId: `seed-${category}-${index}-${idx}`,
              variants: {
                original: url,
                medium: url,
                small: url,
                thumb: url,
                micro: url,
              },
            })),
            tags: [category, 'premium', 'fresh', template.toLowerCase()],
            sku: `SKU-${category.toUpperCase()}-${String(index).padStart(4, '0')}`,
            videos: [], // Explicitly empty array (not null, not undefined)
          };

          // DB protection: Ensure at least 1 image exists
          if (!productData.images || productData.images.length === 0) {
            throw new Error(`Invalid product ${index}: no images`);
          }

          // Add video if available (optional)
          if (media.video) {
            productData.videos = [
              {
                url: media.video,
                format: 'mp4',
                duration: 15,
              },
            ];
            stats.videosAdded++;
          }

          batch.push(productData);
          stats.success++;
        } catch (error: any) {
          logger.error(`❌ Failed to generate media for product ${index}:`, error.message);
          stats.failed++;
          
          // Create product with fallback image (DB protection)
          const productData: any = {
            name,
            description: `High quality ${name} from our curated ${category} collection.`,
            category,
            price,
            pricePerUnit,
            mrp: price + Math.floor(Math.random() * 50),
            stock: Math.floor(Math.random() * 200) + 20,
            weight: Math.floor(Math.random() * 1000) + 100,
            images: [
              {
                publicId: `seed-${category}-${index}-fallback`,
                variants: {
                  original: 'https://picsum.photos/400',
                  medium: 'https://picsum.photos/400',
                  small: 'https://picsum.photos/400',
                  thumb: 'https://picsum.photos/400',
                  micro: 'https://picsum.photos/400',
                },
              },
            ],
            tags: [category, 'premium'],
            sku: `SKU-${category.toUpperCase()}-${String(index).padStart(4, '0')}`,
            videos: [], // Explicitly empty array
          };

          // Final safeguard: Ensure images exist
          if (!productData.images || productData.images.length === 0) {
            logger.error(`❌ CRITICAL: Product ${index} has no images after fallback`);
            continue; // Skip this product entirely
          }

          batch.push(productData);
          stats.fallbackUsed++;
        }
      }

      // Insert batch with validation
      if (batch.length > 0) {
        await Product.insertMany(batch);
        logger.info(`✅ Seeded batch ${Math.floor(i / batchSize) + 1} (${i + batch.length}/${productsToCreate})`);
      }
        } catch (error: any) {
          logger.error(`❌ Failed to generate media for product ${index}:`, error.message);
          stats.failed++;
          
          // Create product with fallback image
          const productData: any = {
            name,
            description: `High quality ${name} from our curated ${category} collection.`,
            category,
            price,
            pricePerUnit,
            mrp: price + Math.floor(Math.random() * 50),
            stock: Math.floor(Math.random() * 200) + 20,
            weight: Math.floor(Math.random() * 1000) + 100,
            images: [
              {
                publicId: `seed-${category}-${index}-fallback`,
                variants: {
                  original: 'https://picsum.photos/400',
                  medium: 'https://picsum.photos/400',
                  small: 'https://picsum.photos/400',
                  thumb: 'https://picsum.photos/400',
                  micro: 'https://picsum.photos/400',
                },
              },
            ],
            tags: [category, 'premium'],
            sku: `SKU-${category.toUpperCase()}-${String(index).padStart(4, '0')}`,
          };

          batch.push(productData);
          stats.fallbackUsed++;
        }
      }

      // Insert batch
      if (batch.length > 0) {
        await Product.insertMany(batch);
        logger.info(`✅ Seeded batch ${Math.floor(i / batchSize) + 1} (${i + batch.length}/${productsToCreate})`);
      }

      // Small delay between batches to avoid overwhelming network
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    stats.endTime = new Date();
    const durationSeconds = ((stats.endTime.getTime() - stats.startTime.getTime()) / 1000).toFixed(1);

    // Final summary
    logger.info('🎯 Seeding completed successfully!');
    logger.info('📊 Final Statistics:', {
      total: stats.total,
      success: stats.success,
      failed: stats.failed,
      fallbackUsed: stats.fallbackUsed,
      videosAdded: stats.videosAdded,
      successRate: `${((stats.success / stats.total) * 100).toFixed(1)}%`,
      duration: `${durationSeconds}s`,
      productsPerSecond: (stats.total / parseFloat(durationSeconds)).toFixed(1),
    });

    // Verify database state
    const productCount = await Product.countDocuments({ sku: { $regex: /^SKU-/ } });
    logger.info(`✅ Verified: ${productCount} products in database`);

    if (stats.fallbackUsed > 0) {
      logger.warn(`⚠️  Warning: ${stats.fallbackUsed} products used fallback images`);
    }

    if (stats.failed > 0) {
      logger.warn(`⚠️  Warning: ${stats.failed} products had media generation errors (recovered with fallback)`);
    }

    process.exit(0);
  } catch (error) {
    logger.error('❌ Seeding failed:', error);
    stats.endTime = new Date();
    logger.error('📊 Stats at failure:', stats);
    process.exit(1);
  }
}

seedProducts();
