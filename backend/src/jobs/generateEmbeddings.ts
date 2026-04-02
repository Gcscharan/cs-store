/**
 * Generate Embeddings Job
 * 
 * Generates semantic embeddings for all products
 * Run once to populate, then integrate into queue for real-time updates
 */

import { logger } from '../utils/logger';
import { Product } from '../models/Product';
import { getBatchEmbeddings, checkEmbeddingServiceHealth } from '../services/embeddingService';

const BATCH_SIZE = 50; // Process 50 products at a time

/**
 * Generate embeddings for all products
 */
export async function generateAllEmbeddings(): Promise<void> {
  try {
    logger.info('[GenerateEmbeddings] Starting embedding generation...');

    // Check if embedding service is healthy
    const isHealthy = await checkEmbeddingServiceHealth();
    if (!isHealthy) {
      logger.error('[GenerateEmbeddings] ❌ Embedding service is not healthy - aborting');
      return;
    }

    // Get all products without embeddings
    const products = await Product.find({
      isActive: true,
      $or: [
        { embedding: { $exists: false } },
        { embedding: null },
        { embedding: [] },
      ],
    })
      .select('_id name description category')
      .lean();

    if (!products || products.length === 0) {
      logger.info('[GenerateEmbeddings] No products need embeddings');
      return;
    }

    logger.info('[GenerateEmbeddings] Found products needing embeddings:', products.length);

    let processed = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      
      try {
        // Create text representations for embedding
        const texts = batch.map((p: any) => {
          // Combine name, description, and category for richer semantic understanding
          const parts = [
            p.name,
            p.description,
            p.category,
          ].filter(Boolean);
          
          return parts.join(' ');
        });

        // Get embeddings from Python service
        const embeddings = await getBatchEmbeddings(texts);

        if (!embeddings || embeddings.length !== batch.length) {
          logger.error('[GenerateEmbeddings] Batch embedding failed:', {
            batchSize: batch.length,
            embeddingsReceived: embeddings?.length || 0,
          });
          failed += batch.length;
          continue;
        }

        // Update products with embeddings
        const updates = batch.map((product: any, idx: number) => ({
          updateOne: {
            filter: { _id: product._id },
            update: { $set: { embedding: embeddings[idx] } },
          },
        }));

        await Product.bulkWrite(updates);

        processed += batch.length;
        logger.info('[GenerateEmbeddings] Progress:', {
          processed,
          total: products.length,
          percentage: Math.round((processed / products.length) * 100),
        });
      } catch (error: any) {
        logger.error('[GenerateEmbeddings] Batch processing failed:', error);
        failed += batch.length;
      }
    }

    logger.info('[GenerateEmbeddings] ✅ Embedding generation complete:', {
      total: products.length,
      processed,
      failed,
    });
  } catch (error: any) {
    logger.error('[GenerateEmbeddings] ❌ Fatal error:', error);
  }
}

/**
 * Generate embedding for single product
 * Used for real-time updates when products are created/updated
 */
export async function generateProductEmbedding(productId: string): Promise<boolean> {
  try {
    const product = await Product.findById(productId)
      .select('name description category')
      .lean();

    if (!product) {
      logger.warn('[GenerateEmbeddings] Product not found:', productId);
      return false;
    }

    // Check if embedding service is healthy
    const isHealthy = await checkEmbeddingServiceHealth();
    if (!isHealthy) {
      logger.error('[GenerateEmbeddings] Embedding service not healthy');
      return false;
    }

    // Create text representation
    const text = [product.name, product.description, product.category]
      .filter(Boolean)
      .join(' ');

    // Get embedding
    const { getEmbedding } = await import('../services/embeddingService');
    const embedding = await getEmbedding(text);

    if (!embedding) {
      logger.error('[GenerateEmbeddings] Failed to generate embedding for product:', productId);
      return false;
    }

    // Update product
    await Product.findByIdAndUpdate(productId, {
      $set: { embedding },
    });

    logger.info('[GenerateEmbeddings] ✅ Generated embedding for product:', productId);
    return true;
  } catch (error: any) {
    logger.error('[GenerateEmbeddings] Error generating product embedding:', error);
    return false;
  }
}

// CLI execution
if (require.main === module) {
  (async () => {
    // Connect to MongoDB
    const mongoose = await import('mongoose');
    await mongoose.default.connect(process.env.MONGODB_URI!);
    
    logger.info('Connected to MongoDB');
    
    // Run generation
    await generateAllEmbeddings();
    
    // Disconnect
    await mongoose.default.disconnect();
    logger.info('Disconnected from MongoDB');
    
    process.exit(0);
  })();
}

export default {
  generateAllEmbeddings,
  generateProductEmbedding,
};
