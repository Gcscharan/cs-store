/**
 * voiceCorrection.ts
 * 
 * 🚀 PRODUCTION-GRADE VOICE CORRECTION SYSTEM
 * Dynamic catalog-driven approach (not static dictionary)
 * 
 * Architecture:
 * Voice → Correction Engine → Product Catalog → Ranked Results
 * 
 * Example: "greenlense" → "green lays"
 */

import type { Product } from '../types';

// ─── Dynamic Dictionary Management ───────────────────────────────────────

interface DictionaryEntry {
  text: string;           // searchable text
  productId?: string;     // linked product ID
  type: 'product' | 'category' | 'word';
  popularity?: number;    // for future ranking
}

class VoiceCorrectionEngine {
  private dictionary: DictionaryEntry[] = [];
  private lastUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Build dynamic dictionary from product catalog
   */
  buildDictionary(products: Product[]): void {
    const entries: DictionaryEntry[] = [];
    const seen = new Set<string>();

    products.forEach(product => {
      const name = product.name.toLowerCase().trim();
      
      // Add full product name (highest priority)
      if (name && !seen.has(name)) {
        entries.push({
          text: name,
          productId: product._id,
          type: 'product',
        });
        seen.add(name);
      }

      // Add individual words from product name
      const words = name.split(/\s+/).filter(w => w.length > 2);
      words.forEach(word => {
        if (!seen.has(word)) {
          entries.push({
            text: word,
            productId: product._id,
            type: 'word',
          });
          seen.add(word);
        }
      });

      // Add category if available
      if (product.category) {
        const category = product.category.toLowerCase().trim();
        if (category && !seen.has(category)) {
          entries.push({
            text: category,
            type: 'category',
          });
          seen.add(category);
        }
      }
    });

    this.dictionary = entries;
    this.lastUpdate = Date.now();

    console.log('[VoiceCorrection] Dictionary built:', {
      totalEntries: entries.length,
      products: entries.filter(e => e.type === 'product').length,
      words: entries.filter(e => e.type === 'word').length,
      categories: entries.filter(e => e.type === 'category').length,
    });
  }

  /**
   * Check if dictionary needs refresh
   */
  needsRefresh(): boolean {
    return Date.now() - this.lastUpdate > this.CACHE_DURATION;
  }

  /**
   * Get current dictionary
   */
  getDictionary(): DictionaryEntry[] {
    return this.dictionary;
  }

  /**
   * Clear dictionary (for testing)
   */
  clear(): void {
    this.dictionary = [];
    this.lastUpdate = 0;
  }
}

// Singleton instance
export const correctionEngine = new VoiceCorrectionEngine();

// ─── Normalization ───────────────────────────────────────────────────────

/**
 * Normalize text: lowercase, remove special chars, trim
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();
}

// ─── Levenshtein Distance ────────────────────────────────────────────────

/**
 * Calculate edit distance between two strings
 */
function levenshteinDistance(s1: string, s2: string): number {
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;
  
  const arr: number[][] = [];
  
  for (let i = 0; i <= s2.length; i++) {
    arr[i] = [i];
  }
  
  for (let j = 0; j <= s1.length; j++) {
    arr[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      const cost = s2[i - 1] === s1[j - 1] ? 0 : 1;
      arr[i][j] = Math.min(
        arr[i - 1][j] + 1,
        arr[i][j - 1] + 1,
        arr[i - 1][j - 1] + cost
      );
    }
  }
  
  return arr[s2.length][s1.length];
}

/**
 * Calculate similarity score (0-1) based on Levenshtein distance
 */
function levenshteinSimilarity(a: string, b: string): number {
  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

// ─── Phonetic Matching ───────────────────────────────────────────────────

/**
 * Simple Soundex implementation for phonetic matching
 */
function soundex(word: string): string {
  if (!word) return '';
  
  word = word.toUpperCase();
  const firstLetter = word[0];
  
  const mapping: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  };
  
  let code = firstLetter;
  let prevCode = mapping[firstLetter] || '';
  
  for (let i = 1; i < word.length && code.length < 4; i++) {
    const char = word[i];
    const charCode = mapping[char];
    
    if (charCode && charCode !== prevCode) {
      code += charCode;
      prevCode = charCode;
    } else if (!charCode) {
      prevCode = '';
    }
  }
  
  return (code + '000').substring(0, 4);
}

/**
 * Check if two words sound similar
 */
function phoneticMatch(a: string, b: string): boolean {
  return soundex(a) === soundex(b);
}

// ─── Substring Similarity ────────────────────────────────────────────────

/**
 * Calculate substring similarity score
 */
function substringScore(input: string, candidate: string): number {
  const inputLower = input.toLowerCase();
  const candidateLower = candidate.toLowerCase();
  
  if (inputLower === candidateLower) return 1.0;
  if (candidateLower.includes(inputLower)) return 0.8;
  if (inputLower.includes(candidateLower)) return 0.7;
  
  // Word-level overlap
  const inputWords = inputLower.split(/\s+/);
  const candidateWords = candidateLower.split(/\s+/);
  
  let matches = 0;
  for (const word of inputWords) {
    if (candidateWords.some(cw => cw.includes(word) || word.includes(cw))) {
      matches++;
    }
  }
  
  return matches / Math.max(inputWords.length, candidateWords.length);
}

// ─── Combined Scoring ────────────────────────────────────────────────────

interface MatchResult {
  text: string;
  score: number;
  productId?: string;
  type: 'product' | 'category' | 'word';
  breakdown: {
    levenshtein: number;
    phonetic: number;
    substring: number;
    typeBonus: number;
    final: number;
  };
}

/**
 * Calculate combined similarity score
 */
function calculateScore(input: string, entry: DictionaryEntry): MatchResult {
  const inputNorm = normalize(input);
  const candidateNorm = normalize(entry.text);
  
  // 1. Levenshtein similarity
  const levenScore = levenshteinSimilarity(inputNorm, candidateNorm);
  
  // 2. Phonetic matching
  const phonetic = phoneticMatch(inputNorm, candidateNorm) ? 0.2 : 0;
  
  // 3. Substring similarity
  const substringScoreValue = substringScore(inputNorm, candidateNorm);
  
  // 4. Type bonus (prefer full product names)
  const typeBonus = entry.type === 'product' ? 0.1 : 0;
  
  // 5. Combined score with weights
  const finalScore = (
    levenScore * 0.5 +           // 50% edit distance
    substringScoreValue * 0.3 +  // 30% substring match
    phonetic +                    // 20% phonetic boost
    typeBonus                     // 10% product name boost
  );
  
  return {
    text: entry.text,
    score: finalScore,
    productId: entry.productId,
    type: entry.type,
    breakdown: {
      levenshtein: levenScore,
      phonetic,
      substring: substringScoreValue,
      typeBonus,
      final: finalScore,
    },
  };
}

// ─── Find Best Match ─────────────────────────────────────────────────────

/**
 * Find best matching entry from dynamic dictionary
 */
export function findBestMatch(input: string, threshold: number = 0.6): MatchResult | null {
  const normalized = normalize(input);
  
  if (!normalized) return null;
  
  const dictionary = correctionEngine.getDictionary();
  
  if (dictionary.length === 0) {
    console.warn('[VoiceCorrection] Dictionary is empty. Call buildDictionary() first.');
    return null;
  }
  
  let bestMatch: MatchResult | null = null;
  
  for (const entry of dictionary) {
    const result = calculateScore(normalized, entry);
    
    if (!bestMatch || result.score > bestMatch.score) {
      bestMatch = result;
    }
  }
  
  // Only return if score exceeds threshold
  if (bestMatch && bestMatch.score >= threshold) {
    return bestMatch;
  }
  
  return null;
}

// ─── Product-Level Matching ──────────────────────────────────────────────

/**
 * Find best matching product directly from catalog
 * This is more accurate than word-level matching
 */
export function findBestProductMatch(
  input: string,
  products: Product[],
  threshold: number = 0.6
): { product: Product; score: number } | null {
  const normalized = normalize(input);
  
  if (!normalized || products.length === 0) return null;
  
  let bestMatch: { product: Product; score: number } | null = null;
  
  for (const product of products) {
    const productName = normalize(product.name);
    
    // Calculate similarity
    const levenScore = levenshteinSimilarity(normalized, productName);
    const substringScoreValue = substringScore(normalized, productName);
    const phonetic = phoneticMatch(normalized, productName) ? 0.2 : 0;
    
    const score = levenScore * 0.5 + substringScoreValue * 0.3 + phonetic;
    
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { product, score };
    }
  }
  
  if (bestMatch && bestMatch.score >= threshold) {
    return bestMatch;
  }
  
  return null;
}

// ─── Main Correction Function ────────────────────────────────────────────

/**
 * Correct voice search query using dynamic catalog
 * 
 * 🚀 UPGRADED WITH LEARNING ENGINE + A/B TESTING
 * 
 * Priority:
 * 1. Check learned corrections FIRST (from user behavior)
 * 2. Fall back to algorithmic matching
 * 
 * @param text - Raw voice transcription
 * @param threshold - Minimum confidence score (default: 0.6)
 * @param userId - User ID for A/B testing bucketing (optional)
 * @returns Corrected query or original if no good match
 */
export function correctVoiceQuery(
  text: string, 
  threshold: number = 0.6,
  userId?: string
): {
  corrected: string;
  original: string;
  confidence: number;
  matched: boolean;
  productId?: string;
  source: 'learned' | 'algorithmic' | 'none';
  variant?: string;
  experimentName?: string;
} {
  const normalized = normalize(text);
  
  if (!normalized) {
    return {
      corrected: text,
      original: text,
      confidence: 0,
      matched: false,
      source: 'none',
    };
  }
  
  // 🧪 A/B TESTING: Get experiment config and apply variant threshold
  let experimentVariant: string | undefined;
  let experimentName: string | undefined;
  let effectiveThreshold = threshold;
  
  if (userId) {
    try {
      // This will be populated by the experiment service
      // For now, we'll use the default threshold
      // The backend will handle experiment assignment
      // TODO: Fetch experiment config from backend API
    } catch (error) {
      // Experiment service not available, use default threshold
    }
  }
  
  // 🧠 STEP 1: Check learned corrections FIRST
  // This is imported dynamically to avoid circular dependencies
  try {
    const { learningEngine } = require('./voiceLearningEngine');
    const learned = learningEngine.getLearnedCorrection(normalized);
    
    if (learned && learned.confidence >= effectiveThreshold) {
      console.log('[VoiceCorrection] ✅ Using LEARNED correction:', {
        original: text,
        corrected: learned.correct,
        confidence: learned.confidence,
        usedCount: learned.count,
        variant: experimentVariant,
        threshold: effectiveThreshold,
      });
      
      return {
        corrected: learned.correct,
        original: text,
        confidence: learned.confidence,
        matched: true,
        productId: learned.productId,
        source: 'learned',
        variant: experimentVariant,
        experimentName,
      };
    }
  } catch (error) {
    // Learning engine not initialized yet, continue with algorithmic
  }
  
  // 🧠 STEP 2: Fall back to algorithmic matching
  const match = findBestMatch(normalized, effectiveThreshold);
  
  if (match) {
    console.log('[VoiceCorrection] ✅ Using ALGORITHMIC match:', {
      original: text,
      corrected: match.text,
      confidence: match.score.toFixed(2),
      type: match.type,
      productId: match.productId,
      variant: experimentVariant,
      threshold: effectiveThreshold,
    });
    
    return {
      corrected: match.text,
      original: text,
      confidence: match.score,
      matched: true,
      productId: match.productId,
      source: 'algorithmic',
      variant: experimentVariant,
      experimentName,
    };
  }
  
  console.log('[VoiceCorrection] ❌ No match found (threshold:', effectiveThreshold, ')');
  
  return {
    corrected: text,
    original: text,
    confidence: 0,
    matched: false,
    source: 'none',
    variant: experimentVariant,
    experimentName,
  };
}

// ─── Multi-Word Intelligence ─────────────────────────────────────────────

/**
 * Correct multi-word queries by matching each word individually
 * Then reconstruct the corrected phrase
 */
export function correctMultiWordQuery(text: string, threshold: number = 0.6): string {
  const words = text.split(/\s+/);
  
  const correctedWords = words.map(word => {
    const result = correctVoiceQuery(word, threshold);
    return result.corrected;
  });
  
  return correctedWords.join(' ');
}

// ─── Exports ──────────────────────────────────────────────────────────────

export default {
  correctionEngine,
  correctVoiceQuery,
  correctMultiWordQuery,
  findBestMatch,
  findBestProductMatch,
  normalize,
};
