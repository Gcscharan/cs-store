/**
 * Voice Learning Engine
 * 
 * 🚀 LEVEL 2: SELF-LEARNING AI SYSTEM
 * 
 * This is what separates demo systems from Google-level production:
 * - Learns from user behavior
 * - Improves over time
 * - Personalized corrections
 * - Click tracking
 * - Ranking based on real data
 */

import { storage } from './storage';
import type { Product } from '../types';

// ─── Types ───────────────────────────────────────────────────────

interface LearnedCorrection {
  wrong: string;           // User's input
  correct: string;         // What they actually clicked
  productId: string;       // Product they selected
  count: number;           // How many times this happened
  confidence: number;      // Learned confidence (0-1)
  lastUsed: number;        // Timestamp
  source: 'user' | 'global'; // User-specific or global learning
  validationScore: number; // Data quality score (0-1)
}

interface ProductClick {
  productId: string;
  productName: string;
  searchQuery: string;     // What user searched
  timestamp: number;
  wasVoiceSearch: boolean;
}

interface ProductRanking {
  productId: string;
  clickCount: number;       // Total clicks
  voiceClickCount: number;  // Voice search clicks
  lastClicked: number;      // Last click timestamp
  popularity: number;       // Calculated score (0-1)
}

// ─── Storage Keys ────────────────────────────────────────────────

const LEARNED_CORRECTIONS_KEY = 'voice_learned_corrections';
const PRODUCT_CLICKS_KEY = 'voice_product_clicks';
const PRODUCT_RANKINGS_KEY = 'voice_product_rankings';

// ─── Learning Engine Class ───────────────────────────────────────

class VoiceLearningEngine {
  private learnedCorrections: Map<string, LearnedCorrection> = new Map();
  private productRankings: Map<string, ProductRanking> = new Map();
  private clickHistory: ProductClick[] = [];
  private lastContext: Array<{ name: string; quantity: number }> = [];
  
  // 🚨 NEW: Data validation tracking
  private pendingCorrections: Map<string, { correct: string; productId: string; count: number }> = new Map();
  private rejectedCorrections: Set<string> = new Set();
  
  // 🚨 NEW: Global vs User split
  private globalCorrections: Map<string, LearnedCorrection> = new Map();
  private userCorrections: Map<string, LearnedCorrection> = new Map();
  
  /**
   * Initialize engine - load from storage AND backend
   */
  async initialize(userId?: string): Promise<void> {
    try {
      // Load user corrections from local storage
      const correctionsData = await storage.getItem(LEARNED_CORRECTIONS_KEY);
      if (correctionsData) {
        const corrections: LearnedCorrection[] = JSON.parse(correctionsData);
        corrections.forEach(c => {
          if (c.source === 'user') {
            this.userCorrections.set(c.wrong.toLowerCase(), c);
          } else {
            this.globalCorrections.set(c.wrong.toLowerCase(), c);
          }
        });
        console.log('[Learning] Loaded from storage:', {
          user: this.userCorrections.size,
          global: this.globalCorrections.size,
        });
      }
      
      // Load product rankings
      const rankingsData = await storage.getItem(PRODUCT_RANKINGS_KEY);
      if (rankingsData) {
        const rankings: ProductRanking[] = JSON.parse(rankingsData);
        rankings.forEach(r => {
          this.productRankings.set(r.productId, r);
        });
        console.log('[Learning] Loaded', rankings.length, 'product rankings');
      }
      
      // Load click history (last 1000)
      const clicksData = await storage.getItem(PRODUCT_CLICKS_KEY);
      if (clicksData) {
        this.clickHistory = JSON.parse(clicksData).slice(-1000);
        console.log('[Learning] Loaded', this.clickHistory.length, 'click history');
      }
      
      // 🚨 NEW: Sync with backend if userId provided
      if (userId) {
        await this.syncWithBackend(userId);
      }
    } catch (error) {
      console.error('[Learning] Failed to initialize:', error);
    }
  }
  
  /**
   * 🚨 NEW: Sync with backend
   */
  private async syncWithBackend(userId: string): Promise<void> {
    try {
      console.log('[Learning] Syncing with backend for user:', userId);
      
      // Get API base URL from environment
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';
      
      // Prepare user corrections for sync
      const userCorrections = Array.from(this.userCorrections.values());
      const rankings = Array.from(this.productRankings.values());
      
      const response = await fetch(`${apiUrl}/voice/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          corrections: userCorrections,
          rankings,
          timestamp: Date.now(),
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Load global corrections from backend
        if (data.globalCorrections && Array.isArray(data.globalCorrections)) {
          await this.loadGlobalCorrections(data.globalCorrections);
        }
        
        console.log('[Learning] ✅ Synced with backend');
      } else {
        console.warn('[Learning] Backend sync returned non-OK status:', response.status);
      }
    } catch (error) {
      console.error('[Learning] ❌ Sync failed:', error);
      // Don't throw - sync is optional
    }
  }
  
  /**
   * 🚨 NEW: Sync single correction to backend (fire and forget)
   */
  private async syncCorrectionToBackend(
    wrong: string,
    correct: string,
    productId: string,
    confidence: number,
    userId?: string
  ): Promise<void> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';
      
      const response = await fetch(`${apiUrl}/voice/correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wrong,
          correct,
          productId,
          userId,
          confidence,
        }),
      });
      
      if (response.ok) {
        console.log('[Learning] ✅ Correction synced to backend');
      } else {
        const errorText = await response.text();
        console.warn('[Learning] Backend correction sync failed:', response.status, errorText);
      }
    } catch (error) {
      console.warn('[Learning] Backend correction sync error:', error);
      // Don't throw - this is fire and forget
    }
  }
  
  /**
   * 🚨 NEW: Sync click to backend (fire and forget)
   */
  private async syncClickToBackend(
    productId: string,
    productName: string,
    query: string,
    isVoice: boolean,
    userId: string,
    sessionId?: string
  ): Promise<void> {
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';
      
      const response = await fetch(`${apiUrl}/voice/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          productName,
          userId,
          query,
          isVoice,
          sessionId,
        }),
      });
      
      if (response.ok) {
        console.log('[Learning] ✅ Click synced to backend');
      } else {
        console.warn('[Learning] Backend click sync failed:', response.status);
      }
    } catch (error) {
      console.warn('[Learning] Backend click sync error:', error);
      // Don't throw - this is fire and forget
    }
  }
  
  /**
   * 🧠 FEATURE 1: LEARNED CORRECTIONS (PRODUCTION-HARDENED)
   * 
   * ✅ Data validation (no garbage learning)
   * ✅ Confidence gating (ignore weak signals)
   * ✅ Repetition requirement (must see 2+ times)
   * ✅ Noise filtering (reject useless data)
   * ✅ Backend sync (persist to MongoDB)
   * 
   * When user searches "greenlense" and clicks "Green Lays",
   * remember this mapping ONLY if it's high quality data.
   */
  async saveCorrection(
    wrong: string,
    correct: string,
    productId: string,
    confidence: number = 0.7,
    userId?: string
  ): Promise<boolean> {
    const key = wrong.toLowerCase();
    const correctNorm = correct.toLowerCase();
    
    // 🚨 VALIDATION 1: Confidence gating
    if (confidence < 0.7) {
      console.log('[Learning] ❌ Rejected: Low confidence', { wrong, confidence });
      return false;
    }
    
    // 🚨 VALIDATION 2: Ignore useless data
    if (key === correctNorm) {
      console.log('[Learning] ❌ Rejected: Same input/output', { wrong });
      return false;
    }
    
    // 🚨 VALIDATION 3: Ignore too short queries
    if (key.length < 3) {
      console.log('[Learning] ❌ Rejected: Too short', { wrong });
      return false;
    }
    
    // 🚨 VALIDATION 4: Check if previously rejected
    if (this.rejectedCorrections.has(key)) {
      console.log('[Learning] ❌ Rejected: Previously marked bad', { wrong });
      return false;
    }
    
    // 🚨 VALIDATION 5: Repetition requirement (must see 2+ times)
    const pending = this.pendingCorrections.get(key);
    
    if (!pending) {
      // First time seeing this - add to pending
      this.pendingCorrections.set(key, {
        correct: correctNorm,
        productId,
        count: 1,
      });
      console.log('[Learning] ⏳ Pending (1/2):', { wrong, correct });
      return false;
    }
    
    // Check if same correction
    if (pending.correct !== correctNorm) {
      // User clicked different product - conflicting data
      console.log('[Learning] ⚠️ Conflict detected:', {
        wrong,
        previous: pending.correct,
        new: correctNorm,
      });
      
      // Reset pending
      this.pendingCorrections.delete(key);
      return false;
    }
    
    // Same correction seen again - promote to learned
    pending.count++;
    
    if (pending.count >= 2) {
      // 🚨 VALIDATION PASSED - Store as learned correction
      const existing = this.userCorrections.get(key);
      
      if (existing) {
        // Increment count and update confidence
        existing.count++;
        existing.confidence = Math.min(0.98, existing.confidence + 0.05);
        existing.lastUsed = Date.now();
        existing.validationScore = this.calculateValidationScore(existing);
      } else {
        // New learned correction
        this.userCorrections.set(key, {
          wrong: key,
          correct: correctNorm,
          productId,
          count: pending.count,
          confidence: 0.75, // Start with good confidence
          lastUsed: Date.now(),
          source: 'user',
          validationScore: 0.8,
        });
      }
      
      // Remove from pending
      this.pendingCorrections.delete(key);
      
      await this.persist();
      
      // 🚨 NEW: Sync to backend (fire and forget - don't block)
      this.syncCorrectionToBackend(key, correctNorm, productId, confidence, userId).catch(err => {
        console.warn('[Learning] Backend sync failed (non-blocking):', err);
      });
      
      console.log('[Learning] ✅ Saved correction:', {
        wrong,
        correct: correctNorm,
        count: this.userCorrections.get(key)?.count,
        confidence: this.userCorrections.get(key)?.confidence,
      });
      
      return true;
    }
    
    console.log('[Learning] ⏳ Pending (2/2):', { wrong, correct });
    return false;
  }
  
  /**
   * Calculate data quality score
   */
  private calculateValidationScore(correction: LearnedCorrection): number {
    let score = 0.5; // Base score
    
    // More usage = higher quality
    score += Math.min(0.3, correction.count * 0.05);
    
    // Recent usage = higher quality
    const daysSinceUse = (Date.now() - correction.lastUsed) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 0.2 - daysSinceUse * 0.01);
    
    return Math.min(1, score);
  }

  /**
   * Get learned correction if exists
   * 
   * 🚨 PRODUCTION-HARDENED:
   * Priority: User corrections > Global corrections > None
   * Fallback: Return null if confidence too low
   */
  getLearnedCorrection(input: string): LearnedCorrection | null {
    const key = input.toLowerCase();
    
    // 🚨 PRIORITY 1: User-specific corrections
    const userLearned = this.userCorrections.get(key);
    if (userLearned && userLearned.confidence >= 0.7) {
      userLearned.lastUsed = Date.now();
      console.log('[Learning] ✅ Using USER correction:', {
        input,
        correction: userLearned.correct,
        confidence: userLearned.confidence,
        usedCount: userLearned.count,
      });
      return userLearned;
    }
    
    // 🚨 PRIORITY 2: Global corrections
    const globalLearned = this.globalCorrections.get(key);
    if (globalLearned && globalLearned.confidence >= 0.8) {
      console.log('[Learning] ✅ Using GLOBAL correction:', {
        input,
        correction: globalLearned.correct,
        confidence: globalLearned.confidence,
      });
      return globalLearned;
    }
    
    // 🚨 FALLBACK: No high-confidence correction found
    return null;
  }
  
  /**
   * Load global corrections from backend
   */
  async loadGlobalCorrections(corrections: LearnedCorrection[]): Promise<void> {
    corrections.forEach(c => {
      if (c.confidence >= 0.8 && c.validationScore >= 0.7) {
        this.globalCorrections.set(c.wrong.toLowerCase(), {
          ...c,
          source: 'global',
        });
      }
    });
    
    console.log('[Learning] Loaded', this.globalCorrections.size, 'global corrections');
  }
  
  /**
   * 🧠 FEATURE 2: PRODUCT CLICK TRACKING
   * 
   * Track every product click to build popularity rankings
   * Syncs to backend for global learning
   */
  async trackProductClick(
    productId: string,
    productName: string,
    searchQuery: string,
    wasVoiceSearch: boolean,
    userId?: string,
    sessionId?: string
  ): Promise<void> {
    // Add to click history
    this.clickHistory.push({
      productId,
      productName,
      searchQuery: searchQuery.toLowerCase(),
      timestamp: Date.now(),
      wasVoiceSearch,
    });
    
    // Keep only last 1000 clicks
    if (this.clickHistory.length > 1000) {
      this.clickHistory = this.clickHistory.slice(-1000);
    }
    
    // Update product ranking
    const existing = this.productRankings.get(productId);
    
    if (existing) {
      existing.clickCount++;
      if (wasVoiceSearch) existing.voiceClickCount++;
      existing.lastClicked = Date.now();
      existing.popularity = this.calculatePopularity(existing);
    } else {
      this.productRankings.set(productId, {
        productId,
        clickCount: 1,
        voiceClickCount: wasVoiceSearch ? 1 : 0,
        lastClicked: Date.now(),
        popularity: 0.5, // Start neutral
      });
    }
    
    await this.persist();
    
    // 🚨 NEW: Sync to backend (fire and forget - don't block)
    if (userId) {
      this.syncClickToBackend(productId, productName, searchQuery, wasVoiceSearch, userId, sessionId).catch(err => {
        console.warn('[Learning] Click sync failed (non-blocking):', err);
      });
    }
    
    console.log('[Learning] Tracked click:', {
      product: productName,
      totalClicks: this.productRankings.get(productId)?.clickCount,
      voiceClicks: this.productRankings.get(productId)?.voiceClickCount,
    });
  }
  
  /**
   * Calculate popularity score (0-1) based on clicks and recency
   */
  private calculatePopularity(ranking: ProductRanking): number {
    const now = Date.now();
    const daysSinceClick = (now - ranking.lastClicked) / (1000 * 60 * 60 * 24);
    
    // Decay factor: clicks lose value over time
    const recencyFactor = Math.exp(-daysSinceClick / 30); // 30-day half-life
    
    // Normalize click count (log scale to prevent outliers)
    const clickScore = Math.log(ranking.clickCount + 1) / Math.log(100);
    
    // Voice clicks are more valuable (2x weight)
    const voiceBonus = (ranking.voiceClickCount / ranking.clickCount) * 0.2;
    
    return Math.min(1, clickScore * recencyFactor + voiceBonus);
  }

  /**
   * 🧠 FEATURE 3: RANKING LAYER
   * 
   * Instead of returning best match, return top N and rank them
   */
  rankProducts(
    products: Product[],
    baseScores: Map<string, number>
  ): Product[] {
    return products
      .map(product => {
        const baseScore = baseScores.get(product._id) || 0;
        const ranking = this.productRankings.get(product._id);
        
        // Combine base score with learned popularity
        const popularityBoost = ranking ? ranking.popularity * 0.3 : 0;
        const finalScore = baseScore + popularityBoost;
        
        return { product, score: finalScore };
      })
      .sort((a, b) => b.score - a.score)
      .map(item => item.product);
  }
  
  /**
   * Get popularity score for a product
   */
  getPopularity(productId: string): number {
    return this.productRankings.get(productId)?.popularity || 0;
  }
  
  /**
   * 🧠 FEATURE 4: CONTEXT MEMORY (PRODUCTION-HARDENED)
   * 
   * Remember last items with quantities for "add one more" type queries
   * 
   * ✅ Supports multiple items
   * ✅ Tracks quantities
   * ✅ Handles "add one more" correctly
   */
  setContext(items: Array<{ name: string; quantity: number }>): void {
    this.lastContext = items.map(item => ({
      name: item.name.toLowerCase(),
      quantity: item.quantity,
    }));
    console.log('[Learning] Context set:', this.lastContext);
  }
  
  getContext(): Array<{ name: string; quantity: number }> {
    return this.lastContext;
  }
  
  getLastItem(): { name: string; quantity: number } | null {
    return this.lastContext.length > 0 
      ? this.lastContext[this.lastContext.length - 1]
      : null;
  }
  
  clearContext(): void {
    this.lastContext = [];
  }
  
  /**
   * 🧠 FEATURE 5: PERSONALIZED SUGGESTIONS
   * 
   * Get user's most clicked products
   */
  getFrequentProducts(limit: number = 10): string[] {
    return Array.from(this.productRankings.values())
      .sort((a, b) => b.clickCount - a.clickCount)
      .slice(0, limit)
      .map(r => r.productId);
  }
  
  /**
   * Get products user searches for via voice
   */
  getVoiceFrequentProducts(limit: number = 10): string[] {
    return Array.from(this.productRankings.values())
      .filter(r => r.voiceClickCount > 0)
      .sort((a, b) => b.voiceClickCount - a.voiceClickCount)
      .slice(0, limit)
      .map(r => r.productId);
  }
  
  /**
   * Persist to storage
   */
  private async persist(): Promise<void> {
    try {
      // Save user corrections only (global comes from backend)
      const userCorrections = Array.from(this.userCorrections.values());
      await storage.setItem(LEARNED_CORRECTIONS_KEY, JSON.stringify(userCorrections));
      
      // Save product rankings
      const rankings = Array.from(this.productRankings.values());
      await storage.setItem(PRODUCT_RANKINGS_KEY, JSON.stringify(rankings));
      
      // Save click history
      await storage.setItem(PRODUCT_CLICKS_KEY, JSON.stringify(this.clickHistory));
    } catch (error) {
      console.error('[Learning] Failed to persist:', error);
    }
  }
  
  /**
   * 🚨 NEW: Mark correction as bad (user feedback)
   */
  async rejectCorrection(wrong: string): Promise<void> {
    const key = wrong.toLowerCase();
    
    // Remove from learned
    this.userCorrections.delete(key);
    this.globalCorrections.delete(key);
    
    // Add to rejected list
    this.rejectedCorrections.add(key);
    
    await this.persist();
    
    console.log('[Learning] ❌ Rejected correction:', wrong);
  }
  
  /**
   * Get statistics for debugging
   */
  getStats() {
    return {
      learnedCorrections: this.learnedCorrections.size,
      productRankings: this.productRankings.size,
      clickHistory: this.clickHistory.length,
      topProducts: Array.from(this.productRankings.values())
        .sort((a, b) => b.clickCount - a.clickCount)
        .slice(0, 5)
        .map(r => ({
          productId: r.productId,
          clicks: r.clickCount,
          voiceClicks: r.voiceClickCount,
          popularity: r.popularity.toFixed(3),
        })),
    };
  }
  
  /**
   * Clear all learned data (for testing)
   */
  async clear(): Promise<void> {
    this.learnedCorrections.clear();
    this.productRankings.clear();
    this.clickHistory = [];
    this.lastContext = null;
    
    await storage.removeItem(LEARNED_CORRECTIONS_KEY);
    await storage.removeItem(PRODUCT_RANKINGS_KEY);
    await storage.removeItem(PRODUCT_CLICKS_KEY);
    
    console.log('[Learning] Cleared all data');
  }
}

// ─── Singleton Instance ──────────────────────────────────────────

export const learningEngine = new VoiceLearningEngine();

// ─── Exports ─────────────────────────────────────────────────────

export type { LearnedCorrection, ProductClick, ProductRanking };
export default learningEngine;
