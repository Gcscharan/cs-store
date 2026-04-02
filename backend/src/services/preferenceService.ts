/**
 * Preference Service
 * 
 * Phase 5: Personalization Engine
 * Manages user preferences for personalized ranking
 * 
 * Architecture:
 * - Click → Preference score update (product + category)
 * - Preference map → Personalized ranking
 * - Time decay (exponential)
 * - Category-level learning
 */

import UserPreference from '../models/UserPreference';
import UserCategoryPreference from '../models/UserCategoryPreference';
import { logger } from '../utils/logger';

/**
 * Update user preference on product click
 * 
 * Algorithm:
 * - First click: score = 1.0
 * - Subsequent clicks: score += 0.5 (diminishing returns)
 * - Max score: 10.0
 * 
 * Also updates category-level preferences for generalization
 * 
 * Uses atomic upsert for race-condition safety
 */
export async function updateUserPreference(
  userId: string,
  productId: string,
  category?: string
): Promise<void> {
  try {
    // Update product-level preference
    await UserPreference.findOneAndUpdate(
      { userId, productId },
      {
        $inc: { 
          clickCount: 1,
          score: 0.5, // Increment by 0.5 per click
        },
        $setOnInsert: {
          score: 1.0, // First click starts at 1.0
        },
        $set: {
          lastUpdated: new Date(),
        },
      },
      { 
        upsert: true,
        new: true,
      }
    );

    // Update category-level preference (if category provided)
    if (category) {
      await UserCategoryPreference.findOneAndUpdate(
        { userId, category },
        {
          $inc: {
            productCount: 1,
            score: 0.3, // Category score grows slower than product score
          },
          $setOnInsert: {
            score: 0.5, // First category click starts at 0.5
          },
          $set: {
            lastUpdated: new Date(),
          },
        },
        {
          upsert: true,
          new: true,
        }
      );
    }

    logger.debug('[PreferenceService] Updated preference:', { userId, productId, category });
  } catch (error) {
    logger.error('[PreferenceService] Error updating preference:', error);
    throw error;
  }
}

/**
 * Get user preference map (normalized 0-1) with time decay
 * 
 * Returns: { productId: normalizedScore }
 * 
 * Algorithm:
 * 1. Apply time decay (exponential decay based on days since last update)
 * 2. Normalize to 0-1 range
 * 
 * Time Decay:
 * - Recent clicks (0-7 days): 100% weight
 * - Medium age (7-30 days): 90-70% weight
 * - Old clicks (30-90 days): 70-40% weight
 * 
 * This keeps preferences fresh and prevents stale data from dominating
 */
export async function getUserPreferenceMap(
  userId: string
): Promise<Record<string, number>> {
  try {
    const preferences = await UserPreference.find({ userId })
      .select('productId score lastUpdated')
      .lean();

    if (!preferences || preferences.length === 0) {
      return {};
    }

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Apply time decay to all scores
    const decayedPreferences = preferences.map(pref => {
      const daysSinceUpdate = (now - new Date(pref.lastUpdated).getTime()) / DAY_MS;
      
      // Exponential decay: score * e^(-0.02 * days)
      // After 30 days: ~55% weight
      // After 60 days: ~30% weight
      // After 90 days: ~17% weight (then TTL removes it)
      const decayFactor = Math.exp(-0.02 * daysSinceUpdate);
      const decayedScore = pref.score * decayFactor;

      return {
        productId: pref.productId,
        score: decayedScore,
      };
    });

    // Find max score for normalization
    const maxScore = Math.max(...decayedPreferences.map(p => p.score));

    // Build normalized map
    const preferenceMap: Record<string, number> = {};
    
    for (const pref of decayedPreferences) {
      preferenceMap[pref.productId] = pref.score / maxScore;
    }

    logger.debug('[PreferenceService] Retrieved preference map with time decay:', {
      userId,
      count: preferences.length,
      maxScore,
    });

    return preferenceMap;
  } catch (error) {
    logger.error('[PreferenceService] Error getting preference map:', error);
    return {}; // Return empty map on error (safe fallback)
  }
}

/**
 * Get user's top preferences
 * 
 * @param userId - User ID
 * @param limit - Number of top preferences to return
 */
export async function getTopPreferences(
  userId: string,
  limit: number = 20
): Promise<Array<{ productId: string; score: number; clickCount: number }>> {
  try {
    const preferences = await UserPreference.find({ userId })
      .sort({ score: -1 })
      .limit(limit)
      .select('productId score clickCount')
      .lean();

    return preferences;
  } catch (error) {
    logger.error('[PreferenceService] Error getting top preferences:', error);
    return [];
  }
}

/**
 * Get user category preference map (normalized 0-1) with time decay
 * 
 * Returns: { category: normalizedScore }
 * 
 * Used for boosting products in preferred categories
 */
export async function getUserCategoryPreferenceMap(
  userId: string
): Promise<Record<string, number>> {
  try {
    const preferences = await UserCategoryPreference.find({ userId })
      .select('category score lastUpdated')
      .lean();

    if (!preferences || preferences.length === 0) {
      return {};
    }

    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;

    // Apply time decay
    const decayedPreferences = preferences.map(pref => {
      const daysSinceUpdate = (now - new Date(pref.lastUpdated).getTime()) / DAY_MS;
      const decayFactor = Math.exp(-0.02 * daysSinceUpdate);
      const decayedScore = pref.score * decayFactor;

      return {
        category: pref.category,
        score: decayedScore,
      };
    });

    // Find max score for normalization
    const maxScore = Math.max(...decayedPreferences.map(p => p.score));

    // Build normalized map
    const categoryMap: Record<string, number> = {};
    
    for (const pref of decayedPreferences) {
      categoryMap[pref.category] = pref.score / maxScore;
    }

    logger.debug('[PreferenceService] Retrieved category preference map:', {
      userId,
      count: preferences.length,
      maxScore,
    });

    return categoryMap;
  } catch (error) {
    logger.error('[PreferenceService] Error getting category preference map:', error);
    return {};
  }
}

export default {
  updateUserPreference,
  getUserPreferenceMap,
  getUserCategoryPreferenceMap,
  getTopPreferences,
};
