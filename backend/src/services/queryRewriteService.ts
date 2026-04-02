/**
 * Query Rewrite Service
 * 
 * Phase 5: Query Understanding
 * Expands and rewrites queries for better search results
 * 
 * Examples:
 * - "cold" → "cold medicine"
 * - "snack" → "chips snacks"
 * - "drink" → "soft drinks beverages"
 * 
 * This is how Google/Amazon handle ambiguous queries
 */

import { logger } from '../utils/logger';

/**
 * Query rewrite rules
 * 
 * Format: { pattern: /regex/, replacement: 'expanded query' }
 */
const REWRITE_RULES = [
  // Health & Medicine
  { pattern: /\bcold\b/i, replacement: 'cold medicine fever' },
  { pattern: /\bheadache\b/i, replacement: 'headache pain relief medicine' },
  { pattern: /\bfever\b/i, replacement: 'fever medicine paracetamol' },
  
  // Food & Snacks
  { pattern: /\bsnack\b/i, replacement: 'snacks chips namkeen' },
  { pattern: /\bchips\b/i, replacement: 'chips lays kurkure' },
  { pattern: /\bbiscuit\b/i, replacement: 'biscuits cookies' },
  
  // Beverages
  { pattern: /\bdrink\b/i, replacement: 'drinks beverages soft drinks' },
  { pattern: /\bcold drink\b/i, replacement: 'cold drinks coke pepsi' },
  { pattern: /\bjuice\b/i, replacement: 'juice fruit juice' },
  
  // Dairy
  { pattern: /\bmilk\b/i, replacement: 'milk dairy' },
  { pattern: /\bcurd\b/i, replacement: 'curd yogurt dahi' },
  
  // Staples
  { pattern: /\brice\b/i, replacement: 'rice basmati' },
  { pattern: /\bwheat\b/i, replacement: 'wheat flour atta' },
  { pattern: /\boil\b/i, replacement: 'oil cooking oil' },
  
  // Personal Care
  { pattern: /\bsoap\b/i, replacement: 'soap bathing soap' },
  { pattern: /\bshampoo\b/i, replacement: 'shampoo hair care' },
  
  // Household
  { pattern: /\bdetergent\b/i, replacement: 'detergent washing powder' },
  { pattern: /\btissue\b/i, replacement: 'tissue paper tissues' },
];

/**
 * Rewrite query for better search results
 * 
 * @param query - Original user query
 * @returns Rewritten query (or original if no match)
 */
export function rewriteQuery(query: string): string {
  try {
    const trimmed = query.trim();
    
    // Check each rule
    for (const rule of REWRITE_RULES) {
      if (rule.pattern.test(trimmed)) {
        const rewritten = trimmed.replace(rule.pattern, rule.replacement);
        
        logger.debug('[QueryRewrite] Rewrite applied:', {
          original: trimmed,
          rewritten,
          rule: rule.pattern.toString(),
        });
        
        return rewritten;
      }
    }
    
    // No rewrite needed
    return trimmed;
  } catch (error) {
    logger.error('[QueryRewrite] Error rewriting query:', error);
    return query; // Safe fallback
  }
}

/**
 * Check if query was rewritten
 */
export function wasRewritten(original: string, rewritten: string): boolean {
  return original.trim() !== rewritten.trim();
}

export default {
  rewriteQuery,
  wasRewritten,
};
