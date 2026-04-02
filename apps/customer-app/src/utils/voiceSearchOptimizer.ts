/**
 * Voice Search Optimizer
 * 
 * 🚀 LEVEL 2: SCALABLE SEARCH ENGINE
 * 
 * Handles 10,000+ products efficiently:
 * - Pre-filtering (reduce search space)
 * - Indexing (fast lookups)
 * - Multi-word parsing
 * - Candidate ranking
 */

import type { Product } from '../types';
import { normalize } from './voiceCorrection';

// ─── Types ───────────────────────────────────────────────────────

interface SearchIndex {
  byFirstLetter: Map<string, Product[]>;
  byFirstTwoLetters: Map<string, Product[]>;
  byCategory: Map<string, Product[]>;
  allProducts: Product[];
}

interface SearchCandidate {
  product: Product;
  score: number;
  matchType: 'exact' | 'prefix' | 'contains' | 'fuzzy';
}

// ─── Search Optimizer Class ──────────────────────────────────────

class VoiceSearchOptimizer {
  private index: SearchIndex = {
    byFirstLetter: new Map(),
    byFirstTwoLetters: new Map(),
    byCategory: new Map(),
    allProducts: [],
  };
  
  /**
   * 🧠 FEATURE 6: BUILD SEARCH INDEX
   * 
   * Pre-compute indexes for fast lookups
   */
  buildIndex(products: Product[]): void {
    const startTime = Date.now();
    
    // Clear existing index
    this.index = {
      byFirstLetter: new Map(),
      byFirstTwoLetters: new Map(),
      byCategory: new Map(),
      allProducts: products,
    };
    
    for (const product of products) {
      const name = normalize(product.name);
      
      // Index by first letter
      const firstLetter = name[0];
      if (firstLetter) {
        if (!this.index.byFirstLetter.has(firstLetter)) {
          this.index.byFirstLetter.set(firstLetter, []);
        }
        this.index.byFirstLetter.get(firstLetter)!.push(product);
      }
      
      // Index by first two letters
      const firstTwo = name.substring(0, 2);
      if (firstTwo.length === 2) {
        if (!this.index.byFirstTwoLetters.has(firstTwo)) {
          this.index.byFirstTwoLetters.set(firstTwo, []);
        }
        this.index.byFirstTwoLetters.get(firstTwo)!.push(product);
      }
      
      // Index by category
      if (product.category) {
        const category = normalize(product.category);
        if (!this.index.byCategory.has(category)) {
          this.index.byCategory.set(category, []);
        }
        this.index.byCategory.get(category)!.push(product);
      }
    }
    
    const buildTime = Date.now() - startTime;
    console.log('[SearchOptimizer] Index built:', {
      products: products.length,
      firstLetterKeys: this.index.byFirstLetter.size,
      firstTwoKeys: this.index.byFirstTwoLetters.size,
      categories: this.index.byCategory.size,
      buildTime: `${buildTime}ms`,
    });
  }
  
  /**
   * 🧠 CRITICAL: PRE-FILTER CANDIDATES
   * 
   * Instead of checking ALL products, filter to likely matches first
   * This is what makes 10,000+ products fast
   */
  getCandidates(query: string): Product[] {
    const normalized = normalize(query);
    
    if (normalized.length === 0) {
      return this.index.allProducts.slice(0, 50); // Return first 50
    }
    
    const candidates = new Set<Product>();
    
    // Strategy 1: First letter match (fastest)
    const firstLetter = normalized[0];
    const firstLetterMatches = this.index.byFirstLetter.get(firstLetter) || [];
    firstLetterMatches.forEach(p => candidates.add(p));
    
    // Strategy 2: First two letters (more precise)
    if (normalized.length >= 2) {
      const firstTwo = normalized.substring(0, 2);
      const firstTwoMatches = this.index.byFirstTwoLetters.get(firstTwo) || [];
      firstTwoMatches.forEach(p => candidates.add(p));
    }
    
    // Strategy 3: Category match
    const words = normalized.split(/\s+/);
    for (const word of words) {
      const categoryMatches = this.index.byCategory.get(word) || [];
      categoryMatches.forEach(p => candidates.add(p));
    }
    
    // If too few candidates, expand search
    if (candidates.size < 10) {
      // Add products that contain any word from query
      for (const product of this.index.allProducts) {
        const productName = normalize(product.name);
        if (words.some(word => productName.includes(word))) {
          candidates.add(product);
        }
      }
    }
    
    const result = Array.from(candidates);
    
    console.log('[SearchOptimizer] Candidates:', {
      query,
      total: this.index.allProducts.length,
      candidates: result.length,
      reduction: `${((1 - result.length / this.index.allProducts.length) * 100).toFixed(1)}%`,
    });
    
    return result;
  }

  /**
   * 🧠 MULTI-WORD INTENT PARSING
   * 
   * "2 green lays and coke" → [
   *   { item: "green lays", quantity: 2 },
   *   { item: "coke", quantity: 1 }
   * ]
   */
  parseMultiWordIntent(query: string): Array<{ item: string; quantity: number }> {
    const normalized = normalize(query);
    const items: Array<{ item: string; quantity: number }> = [];
    
    // Split by "and" or ","
    const parts = normalized.split(/\s+and\s+|,\s*/);
    
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      
      // Extract quantity (number at start)
      const quantityMatch = trimmed.match(/^(\d+)\s+(.+)$/);
      
      if (quantityMatch) {
        const quantity = parseInt(quantityMatch[1], 10);
        const item = quantityMatch[2];
        items.push({ item, quantity });
      } else {
        // No quantity specified, default to 1
        items.push({ item: trimmed, quantity: 1 });
      }
    }
    
    return items;
  }
  
  /**
   * 🧠 SMART RANKING
   * 
   * Rank candidates by multiple factors:
   * - Match quality (exact > prefix > contains > fuzzy)
   * - Product popularity (from learning engine)
   * - Recency
   */
  rankCandidates(
    candidates: Product[],
    query: string,
    popularityScores: Map<string, number>
  ): SearchCandidate[] {
    const normalized = normalize(query);
    
    return candidates
      .map(product => {
        const productName = normalize(product.name);
        
        // Determine match type and base score
        let score = 0;
        let matchType: SearchCandidate['matchType'] = 'fuzzy';
        
        if (productName === normalized) {
          // Exact match
          score = 1.0;
          matchType = 'exact';
        } else if (productName.startsWith(normalized)) {
          // Prefix match
          score = 0.8;
          matchType = 'prefix';
        } else if (productName.includes(normalized)) {
          // Contains match
          score = 0.6;
          matchType = 'contains';
        } else {
          // Fuzzy match (word overlap)
          const queryWords = normalized.split(/\s+/);
          const productWords = productName.split(/\s+/);
          const overlap = queryWords.filter(qw => 
            productWords.some(pw => pw.includes(qw) || qw.includes(pw))
          ).length;
          score = (overlap / queryWords.length) * 0.4;
          matchType = 'fuzzy';
        }
        
        // Add popularity boost (0-0.3)
        const popularity = popularityScores.get(product._id) || 0;
        score += popularity * 0.3;
        
        return { product, score, matchType };
      })
      .filter(c => c.score > 0.3) // Filter low scores
      .sort((a, b) => b.score - a.score);
  }
  
  /**
   * Get index statistics
   */
  getStats() {
    return {
      totalProducts: this.index.allProducts.length,
      firstLetterKeys: this.index.byFirstLetter.size,
      firstTwoKeys: this.index.byFirstTwoLetters.size,
      categories: this.index.byCategory.size,
      avgProductsPerLetter: this.index.allProducts.length / this.index.byFirstLetter.size,
    };
  }
  
  /**
   * Clear index
   */
  clear(): void {
    this.index = {
      byFirstLetter: new Map(),
      byFirstTwoLetters: new Map(),
      byCategory: new Map(),
      allProducts: [],
    };
  }
}

// ─── Singleton Instance ──────────────────────────────────────────

export const searchOptimizer = new VoiceSearchOptimizer();

// ─── Exports ─────────────────────────────────────────────────────

export type { SearchIndex, SearchCandidate };
export default searchOptimizer;
