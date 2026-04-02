/**
 * Create Qdrant Collection
 * 
 * Sets up vector database collection for product embeddings
 * Run once: npx ts-node src/jobs/createQdrantCollection.ts
 */

import { qdrant, COLLECTION_NAME, collectionExists } from '../services/qdrantClient';
import { logger } from '../utils/logger';

const VECTOR_SIZE = 384; // all-MiniLM-L6-v2 dimension
const DISTANCE_METRIC = 'Cosine'; // Cosine similarity

async function createCollection() {
  try {
    logger.info('[Qdrant] Creating collection...');

    // Check if collection already exists
    const exists = await collectionExists();
    
    if (exists) {
      logger.info('[Qdrant] Collection already exists:', COLLECTION_NAME);
      
      // Get collection info
      const info = await qdrant.getCollection(COLLECTION_NAME);
      logger.info('[Qdrant] Collection info:', {
        name: COLLECTION_NAME,
        status: info.status,
        pointsCount: info.points_count,
      });
      
      return;
    }

    // Create collection
    await qdrant.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: DISTANCE_METRIC,
      },
    });

    logger.info('[Qdrant] ✅ Collection created successfully:', {
      name: COLLECTION_NAME,
      vectorSize: VECTOR_SIZE,
      distance: DISTANCE_METRIC,
    });

    // Create payload index for filtering
    await qdrant.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'category',
      field_schema: 'keyword',
    });

    logger.info('[Qdrant] ✅ Payload index created for category');

  } catch (error: any) {
    logger.error('[Qdrant] ❌ Failed to create collection:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  createCollection()
    .then(() => {
      logger.info('[Qdrant] Setup complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('[Qdrant] Setup failed:', error);
      process.exit(1);
    });
}

export default createCollection;
