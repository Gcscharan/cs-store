/**
 * Voice Correction Service
 * 
 * Manages product dictionary building and refresh for backend-controlled correction
 */

import { logger } from '../utils/logger';
import { correctionEngine } from '../utils/voiceCorrectionBackend';
import { Product } from '../models/Product';

/**
 * Build product dictionary from database
 * Called on server startup and periodically refreshed
 */
export async function buildProductDictionary(): Promise<void> {
  try {
    logger.info('[VoiceCorrectionService] Building product dictionary...');
    
    // Fetch all active products
    const products = await Product.find({ isActive: true })
      .select('_id name category')
      .lean();
    
    if (!products || products.length === 0) {
      logger.warn('[VoiceCorrectionService] No products found - dictionary will be empty');
      return;
    }
    
    // Build dictionary
    correctionEngine.buildDictionary(products);
    
    logger.info('[VoiceCorrectionService] ✅ Product dictionary built successfully', {
      productCount: products.length,
      dictionarySize: correctionEngine.getDictionary().length,
    });
  } catch (error: any) {
    logger.error('[VoiceCorrectionService] ❌ Failed to build product dictionary:', error);
    // Don't throw - allow server to start even if dictionary build fails
    // The correction API will just return no matches until dictionary is built
  }
}

/**
 * Start periodic dictionary refresh
 * Refreshes every 5 minutes to stay in sync with product catalog
 */
export function startDictionaryRefresh(): NodeJS.Timeout {
  const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  logger.info('[VoiceCorrectionService] Starting periodic dictionary refresh (every 5 minutes)');
  
  const intervalId = setInterval(async () => {
    try {
      await buildProductDictionary();
    } catch (error) {
      logger.error('[VoiceCorrectionService] Dictionary refresh failed:', error);
    }
  }, REFRESH_INTERVAL);
  
  return intervalId;
}

/**
 * Stop periodic dictionary refresh
 */
export function stopDictionaryRefresh(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  logger.info('[VoiceCorrectionService] Stopped dictionary refresh');
}
