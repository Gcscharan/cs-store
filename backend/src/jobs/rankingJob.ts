/**
 * Background Ranking Job
 * 
 * 🚨 CRITICAL: Precomputes product rankings for fast queries
 * Runs every 10 minutes
 */

import ProductClick from '../models/ProductClick';
import mongoose from 'mongoose';

// Product Ranking Model
interface IProductRanking extends mongoose.Document {
  productId: string;
  score: number;
  clickCount: number;
  voiceClickCount: number;
  lastClicked: Date;
  lastUpdated: Date;
}

const ProductRankingSchema = new mongoose.Schema<IProductRanking>({
  productId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  score: {
    type: Number,
    required: true,
    default: 0,
    index: true,
  },
  clickCount: {
    type: Number,
    required: true,
    default: 0,
  },
  voiceClickCount: {
    type: Number,
    required: true,
    default: 0,
  },
  lastClicked: {
    type: Date,
    required: true,
  },
  lastUpdated: {
    type: Date,
    required: true,
    default: Date.now,
  },
});

const ProductRanking = mongoose.model<IProductRanking>('ProductRanking', ProductRankingSchema);

/**
 * Calculate ranking score
 */
function calculateScore(clickCount: number, voiceClickCount: number, lastClicked: Date): number {
  // Log scale for click count (prevents outliers)
  const clickScore = Math.log(clickCount + 1);
  
  // Voice clicks are 2x more valuable
  const voiceBonus = voiceClickCount * 0.2;
  
  // Recency factor (30-day half-life)
  const daysSinceClick = (Date.now() - lastClicked.getTime()) / (1000 * 60 * 60 * 24);
  const recencyFactor = Math.exp(-daysSinceClick / 30);
  
  // Cold start boost for new products (last 7 days)
  const coldStartBoost = daysSinceClick < 7 ? 0.2 : 0;
  
  return (clickScore + voiceBonus) * recencyFactor + coldStartBoost;
}

/**
 * Update product rankings
 */
async function updateRankings(): Promise<void> {
  try {
    console.log('[RankingJob] Starting ranking update...');
    
    const startTime = Date.now();
    
    // Aggregate clicks by product (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    
    const aggregation = await ProductClick.aggregate([
      {
        $match: {
          timestamp: { $gte: ninetyDaysAgo },
        },
      },
      {
        $group: {
          _id: '$productId',
          clickCount: { $sum: 1 },
          voiceClickCount: {
            $sum: { $cond: ['$isVoice', 1, 0] },
          },
          lastClicked: { $max: '$timestamp' },
        },
      },
    ]);
    
    if (aggregation.length === 0) {
      console.log('[RankingJob] No clicks to process');
      return;
    }
    
    // Calculate scores and bulk update
    const bulkOps = aggregation.map(item => {
      const score = calculateScore(
        item.clickCount,
        item.voiceClickCount,
        item.lastClicked
      );
      
      return {
        updateOne: {
          filter: { productId: item._id },
          update: {
            $set: {
              productId: item._id,
              score,
              clickCount: item.clickCount,
              voiceClickCount: item.voiceClickCount,
              lastClicked: item.lastClicked,
              lastUpdated: new Date(),
            },
          },
          upsert: true,
        },
      };
    });
    
    await ProductRanking.bulkWrite(bulkOps);
    
    const duration = Date.now() - startTime;
    
    console.log('[RankingJob] ✅ Ranking updated:', {
      products: aggregation.length,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error('[RankingJob] ❌ Update failed:', error);
  }
}

let rankingInterval: NodeJS.Timeout | null = null;

/**
 * Start ranking job
 * Runs every 10 minutes using setInterval
 */
export function startRankingJob(): void {
  // Run immediately on start
  updateRankings();
  
  // Schedule to run every 10 minutes (600,000 ms)
  const INTERVAL_MS = 10 * 60 * 1000;
  
  rankingInterval = setInterval(() => {
    updateRankings();
  }, INTERVAL_MS);
  
  console.log('[RankingJob] ✅ Scheduled (every 10 minutes)');
}

/**
 * Stop ranking job (for graceful shutdown)
 */
export function stopRankingJob(): void {
  if (rankingInterval) {
    clearInterval(rankingInterval);
    rankingInterval = null;
    console.log('[RankingJob] ✅ Stopped');
  }
}

/**
 * Get product ranking
 */
export async function getProductRanking(productId: string): Promise<number> {
  try {
    const ranking = await ProductRanking.findOne({ productId });
    return ranking?.score || 0;
  } catch (error) {
    console.error('[RankingJob] Failed to get ranking:', error);
    return 0;
  }
}

/**
 * Get top ranked products
 */
export async function getTopRankedProducts(limit: number = 10): Promise<IProductRanking[]> {
  try {
    return await ProductRanking.find()
      .sort({ score: -1 })
      .limit(limit);
  } catch (error) {
    console.error('[RankingJob] Failed to get top products:', error);
    return [];
  }
}

export { ProductRanking };
export type { IProductRanking };
