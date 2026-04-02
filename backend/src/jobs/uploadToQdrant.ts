/**
 * Upload Product Embeddings to Qdrant
 * 
 * Migrates embeddings from MongoDB to Qdrant vector database
 * Run once: npx ts-node src/jobs/uploadToQdrant.ts
 */

import mongoose from 'mongoose';
import { qdrant, COLLECTION_NAME } from '../services/qdrantClient';
import { Product } from '../models/Product';
import { logger } from '../utils/logger';

const BATCH_SIZE = 100; // Upload 100 products at a time

async function uploadToQdrant() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI!);
    logger.info('[Qdrant] Connected to MongoDB');

    // Get all products with embeddings
    const products = await Product.find({
      isActive: true,
      embedding: { $exists: true, $ne: null },
    })
      .select('+embedding _id name description category price images')
      .lean();

    if (!products || products.length === 0) {
      logger.warn('[Qdrant] No products with embeddings found');
      return;
    }

    logger.info('[Qdrant] Found products to upload:', products.length);

    let uploaded = 0;
    let failed = 0;

    // Upload in batches
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);

      try {
        const points = batch.map((p: any) => ({
          id: String(p._id),
          vector: p.embedding,
          payload: {
            name: p.name,
            description: p.description,
            category: p.category,
            price: p.price,
            images: p.images,
          },
        }));

        await qdrant.upsert(COLLECTION_NAME, {
          wait: true,
          points,
        });

        uploaded += batch.length;

        logger.info('[Qdrant] Progress:', {
          uploaded,
          total: products.length,
          percentage: Math.round((uploaded / products.length) * 100),
        });
      } catch (error: any) {
        logger.error('[Qdrant] Batch upload failed:', error);
        failed += batch.length;
      }
    }

    logger.info('[Qdrant] ✅ Upload complete:', {
      total: products.length,
      uploaded,
      failed,
    });

    // Verify upload
    const collectionInfo = await qdrant.getCollection(COLLECTION_NAME);
    logger.info('[Qdrant] Collection info:', {
      pointsCount: collectionInfo.points_count,
    });

  } catch (error: any) {
    logger.error('[Qdrant] ❌ Upload failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('[Qdrant] Disconnected from MongoDB');
  }
}

// CLI execution
if (require.main === module) {
  uploadToQdrant()
    .then(() => {
      logger.info('[Qdrant] Upload complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[Qdrant] Upload failed:', error);
      process.exit(1);
    });
}

export default uploadToQdrant;
