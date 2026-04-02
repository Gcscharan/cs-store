/**
 * Session Service
 * 
 * Phase 5: Session Memory
 * Manages user session context for contextual queries
 * 
 * Use cases:
 * - "add one more" → knows what product to add
 * - "show similar" → knows what user is looking at
 * - "cheaper option" → knows current product context
 */

import UserSession from '../models/UserSession';
import { logger } from '../utils/logger';

/**
 * Update session with search context
 * 
 * @param userId - User ID
 * @param sessionId - Session ID
 * @param query - Search query
 * @param productIds - Product IDs from search results
 */
export async function updateSession(
  userId: string,
  sessionId: string,
  query: string,
  productIds: string[]
): Promise<void> {
  try {
    await UserSession.findOneAndUpdate(
      { userId, sessionId },
      {
        $set: {
          lastQuery: query,
          lastProducts: productIds,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    logger.debug('[SessionService] Session updated:', {
      userId,
      sessionId,
      query,
      productsCount: productIds.length,
    });
  } catch (error) {
    logger.error('[SessionService] Error updating session:', error);
    // Don't throw - session is not critical
  }
}

/**
 * Update session with clicked product
 * 
 * @param userId - User ID
 * @param sessionId - Session ID
 * @param productId - Clicked product ID
 */
export async function updateSessionClick(
  userId: string,
  sessionId: string,
  productId: string
): Promise<void> {
  try {
    await UserSession.findOneAndUpdate(
      { userId, sessionId },
      {
        $set: {
          lastClickedProduct: productId,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    logger.debug('[SessionService] Session click updated:', {
      userId,
      sessionId,
      productId,
    });
  } catch (error) {
    logger.error('[SessionService] Error updating session click:', error);
    // Don't throw - session is not critical
  }
}

/**
 * Get session context
 * 
 * @param userId - User ID
 * @param sessionId - Session ID
 * @returns Session context or null
 */
export async function getSessionContext(
  userId: string,
  sessionId: string
): Promise<{
  lastQuery: string;
  lastProducts: string[];
  lastClickedProduct?: string;
} | null> {
  try {
    const session = await UserSession.findOne({ userId, sessionId })
      .select('lastQuery lastProducts lastClickedProduct')
      .lean();

    if (!session) {
      return null;
    }

    return {
      lastQuery: session.lastQuery,
      lastProducts: session.lastProducts,
      lastClickedProduct: session.lastClickedProduct,
    };
  } catch (error) {
    logger.error('[SessionService] Error getting session context:', error);
    return null;
  }
}

/**
 * Detect contextual queries
 * 
 * Examples:
 * - "add one more"
 * - "show similar"
 * - "cheaper option"
 * - "different brand"
 */
export function isContextualQuery(query: string): boolean {
  const contextualPatterns = [
    /add (one )?more/i,
    /show similar/i,
    /cheaper (option|alternative)/i,
    /different brand/i,
    /same (but|as)/i,
    /another one/i,
  ];

  return contextualPatterns.some(pattern => pattern.test(query));
}

export default {
  updateSession,
  updateSessionClick,
  getSessionContext,
  isContextualQuery,
};
