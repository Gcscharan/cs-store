/**
 * Popularity Service
 * 
 * Provides real-time popularity scores based on user clicks
 * Critical for hybrid ranking to boost products users actually want
 */

import { logger } from '../utils/logger';
import ProductClick from '../models/ProductClick';

interface PopularityMap {
  [productId: string]: number;
}

class PopularityService {
  private popularityMap: PopularityMap = {};
  private lastUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get popularity map (cached)
   */
  async getPopularityMap(): Promise<PopularityMap> {
    // Return cached if fresh
    if (Date.now() - this.lastUpdate < this.CACHE_DURATION) {
      return this.popularityMap;
    }

    // Refresh from database
    await this.refresh();
    return this.popularityMap;
  }

  /**
   * Get popularity score for single product
   */
  async getPopularityScore(productId: string): Promise<number> {
    const map = await this.getPopularityMap();
    return map[productId] || 0;
  }

  /**
   * Refresh popularity map from database
   */
  async refresh(): Promise<void> {
    try {
      logger.info('[PopularityService] Refreshing popularity map...');

      // Aggregate click counts by product
      const clicks = await ProductClick.aggregate([
        {
          $group: {
            _id: '$productId',
            clickCount: { $sum: 1 },
            lastClickedAt: { $max: '$timestamp' },
          },
        },
      ]);

      if (!clicks || clicks.length === 0) {
        logger.warn('[PopularityService] No click data found');
        this.popularityMap = {};
        this.lastUpdate = Date.now();
        return;
      }

      // Find max clicks for normalization
      const maxClicks = Math.max(...clicks.map((c: any) => c.clickCount));

      // Build popularity map
      const map: PopularityMap = {};

      clicks.forEach((click: any) => {
        const productId = String(click._id);
        const clickCount = click.clickCount || 0;
        const lastClickedAt = click.lastClickedAt;

        // Base score: normalized click count (0-1)
        const baseScore = maxClicks > 0 ? clickCount / maxClicks : 0;

        // Recency bonus: clicks in last 7 days get 20% boost
        const daysSinceLastClick = lastClickedAt
          ? (Date.now() - new Date(lastClickedAt).getTime()) / (1000 * 60 * 60 * 24)
          : 999;

        const recencyBonus = daysSinceLastClick < 7 ? 0.2 : 0;

        // Final score (capped at 1.0)
        map[productId] = Math.min(baseScore + recencyBonus, 1.0);
      });

      this.popularityMap = map;
      this.lastUpdate = Date.now();

      logger.info('[PopularityService] ✅ Popularity map refreshed:', {
        productsWithClicks: Object.keys(map).length,
        maxClicks,
        avgScore: Object.values(map).reduce((a, b) => a + b, 0) / Object.keys(map).length,
      });
    } catch (error: any) {
      logger.error('[PopularityService] ❌ Failed to refresh popularity map:', error);
      // Don't throw - keep using stale data
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    productsWithClicks: number;
    lastUpdate: number;
    cacheAge: number;
  } {
    return {
      productsWithClicks: Object.keys(this.popularityMap).length,
      lastUpdate: this.lastUpdate,
      cacheAge: Date.now() - this.lastUpdate,
    };
  }

  /**
   * Clear cache (force refresh on next request)
   */
  clear(): void {
    this.popularityMap = {};
    this.lastUpdate = 0;
    logger.info('[PopularityService] Cache cleared');
  }
}

// Singleton instance
export const popularityService = new PopularityService();

export default {
  popularityService,
};
