/**
 * voiceToCartEngine.ts
 * 
 * 🚀 VOICE → CART ENGINE
 * 
 * Transforms voice input into structured shopping actions.
 * This is the leap from "smart search" to "shopping assistant".
 * 
 * User says: "2 milk packets and 1 coke"
 * System does: Adds 2 milk + 1 coke to cart instantly
 * 
 * Architecture:
 *   Voice → Intent Parser → Product Resolver → Cart Action
 */

import { buildSearchQuery } from './voiceIntentParser';

// ─── Types ────────────────────────────────────────────────────────

export type VoiceIntent = 'ADD_TO_CART' | 'SEARCH' | 'FILTER' | 'NAVIGATE';

export interface VoiceItem {
  name: string;
  quantity: number;
  originalText: string;
}

export interface ResolvedItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  image?: string;
}

export interface VoiceActionResult {
  intent: VoiceIntent;
  items: VoiceItem[];
  resolvedItems?: ResolvedItem[];
  searchQuery?: string;
  confidence: 'high' | 'medium' | 'low';
  needsConfirmation: boolean;
}

// ─── Quantity Extraction ──────────────────────────────────────────

/**
 * Extract quantity from text
 * Examples:
 *   "2 milk" → 2
 *   "one coke" → 1
 *   "milk" → 1 (default)
 */
function extractQuantity(text: string): { quantity: number; cleanText: string } {
  const normalized = text.toLowerCase().trim();
  
  // Number patterns
  const numberMatch = normalized.match(/^(\d+)\s+(.+)$/);
  if (numberMatch) {
    return {
      quantity: parseInt(numberMatch[1], 10),
      cleanText: numberMatch[2],
    };
  }
  
  // Word numbers
  const wordNumbers: Record<string, number> = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'a': 1, 'an': 1,
  };
  
  for (const [word, num] of Object.entries(wordNumbers)) {
    const pattern = new RegExp(`^${word}\\s+(.+)$`, 'i');
    const match = normalized.match(pattern);
    if (match) {
      return {
        quantity: num,
        cleanText: match[1],
      };
    }
  }
  
  // Default: 1
  return {
    quantity: 1,
    cleanText: normalized,
  };
}

// ─── Item Splitting ───────────────────────────────────────────────

/**
 * Split multiple items from voice input
 * Examples:
 *   "milk and coke" → ["milk", "coke"]
 *   "2 lays, 1 coke and bread" → ["2 lays", "1 coke", "bread"]
 */
function splitItems(text: string): string[] {
  // Split by common separators
  const parts = text.split(/\s+(?:and|,)\s+|\s*,\s*/);
  
  return parts
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

// ─── Intent Detection ─────────────────────────────────────────────

/**
 * Detect user intent from voice input
 * 
 * ADD_TO_CART indicators:
 *   - Quantity mentioned ("2 milk")
 *   - Multiple items ("milk and coke")
 *   - Action words ("add", "get", "buy")
 * 
 * SEARCH indicators:
 *   - Single item, no quantity
 *   - Question words ("show", "find")
 *   - Filter words ("under 50", "cheap")
 */
function detectIntent(text: string): VoiceIntent {
  const normalized = text.toLowerCase().trim();
  
  // Strong ADD_TO_CART signals
  const addSignals = [
    /^\d+\s+/,                    // Starts with number
    /\s+and\s+/,                  // Multiple items
    /,/,                          // Comma-separated
    /\b(add|get|buy|order|take)\b/i,  // Action verbs
  ];
  
  for (const signal of addSignals) {
    if (signal.test(normalized)) {
      return 'ADD_TO_CART';
    }
  }
  
  // FILTER signals
  if (/\b(under|below|less than|cheaper|budget)\b/i.test(normalized)) {
    return 'FILTER';
  }
  
  // Default to SEARCH for single items
  return 'SEARCH';
}

// ─── Parse Voice to Items ─────────────────────────────────────────

/**
 * Master parser: Voice text → Structured items
 * 
 * Input: "2 dairy milk and 1 coke"
 * Output: [
 *   { name: "dairy milk", quantity: 2, originalText: "2 dairy milk" },
 *   { name: "coke", quantity: 1, originalText: "1 coke" }
 * ]
 */
export function parseVoiceToItems(rawText: string): VoiceItem[] {
  const parts = splitItems(rawText);
  
  return parts.map(part => {
    const { quantity, cleanText } = extractQuantity(part);
    const cleanName = buildSearchQuery(cleanText); // Use existing fuzzy matcher
    
    return {
      name: cleanName,
      quantity,
      originalText: part,
    };
  });
}

// ─── Confidence Scoring ───────────────────────────────────────────

/**
 * Calculate confidence in voice interpretation
 * 
 * HIGH: Clear quantity + known product
 * MEDIUM: Single item or ambiguous quantity
 * LOW: Very short or unclear input
 */
function calculateConfidence(items: VoiceItem[], rawText: string): 'high' | 'medium' | 'low' {
  // Too short = low confidence
  if (rawText.trim().length < 3) {
    return 'low';
  }
  
  // Multiple items with quantities = high confidence
  if (items.length > 1 && items.every(i => i.quantity > 0)) {
    return 'high';
  }
  
  // Single item with explicit quantity = high confidence
  if (items.length === 1 && items[0].quantity > 1) {
    return 'high';
  }
  
  // Single item, quantity 1 = medium confidence (could be search)
  if (items.length === 1) {
    return 'medium';
  }
  
  return 'medium';
}

// ─── Main Engine ──────────────────────────────────────────────────

/**
 * 🚀 VOICE TO CART ENGINE
 * 
 * Master function that processes voice input and returns structured action
 * 
 * @param rawText - Raw voice transcription
 * @returns VoiceActionResult with intent, items, and confidence
 */
export function processVoiceInput(rawText: string): VoiceActionResult {
  const intent = detectIntent(rawText);
  const items = parseVoiceToItems(rawText);
  const confidence = calculateConfidence(items, rawText);
  
  // Determine if confirmation is needed
  const needsConfirmation = 
    confidence === 'low' || 
    (intent === 'ADD_TO_CART' && items.length > 3) || // Many items
    items.some(i => i.quantity > 10); // Large quantities
  
  // For SEARCH intent, create search query
  const searchQuery = intent === 'SEARCH' 
    ? buildSearchQuery(rawText)
    : undefined;
  
  return {
    intent,
    items,
    confidence,
    needsConfirmation,
    searchQuery,
  };
}

// ─── Product Resolution ───────────────────────────────────────────

/**
 * Resolve voice items to actual products
 * 
 * This function should be called with your product search API
 * to match voice items to real products in your catalog.
 * 
 * @param items - Parsed voice items
 * @param searchFn - Function to search products (e.g., fuzzy search API)
 * @returns Resolved items with product IDs and details
 */
export async function resolveItems(
  items: VoiceItem[],
  searchFn: (query: string) => Promise<any[]>
): Promise<ResolvedItem[]> {
  const resolved: ResolvedItem[] = [];
  
  for (const item of items) {
    try {
      // Search for best match
      const results = await searchFn(item.name);
      
      console.log('[VoiceCart] Search results for', item.name, ':', results);
      
      if (results && results.length > 0) {
        const bestMatch = results[0]; // Take top result
        
        console.log('[VoiceCart] Best match:', {
          id: bestMatch._id || bestMatch.id,
          name: bestMatch.name,
          price: bestMatch.price,
          images: bestMatch.images,
          firstImage: bestMatch.images?.[0]
        });
        
        // Extract image URL - images is an array of strings
        const imageUrl = bestMatch.images?.[0] || undefined;
        
        console.log('[VoiceCart] Extracted image URL:', imageUrl);
        
        resolved.push({
          productId: bestMatch._id || bestMatch.id,
          productName: bestMatch.name,
          quantity: item.quantity,
          price: bestMatch.price,
          image: imageUrl,
        });
      }
    } catch (error) {
      console.warn(`[VoiceCart] Failed to resolve: ${item.name}`, error);
    }
  }
  
  console.log('[VoiceCart] Final resolved items:', resolved);
  
  return resolved;
}

// ─── Smart Suggestions ────────────────────────────────────────────

/**
 * Generate smart suggestions when voice input is ambiguous
 * 
 * Example: "milk" → Show Amul, Heritage, A2 options
 */
export function generateSuggestions(
  items: VoiceItem[],
  searchResults: any[]
): { item: VoiceItem; suggestions: any[] }[] {
  return items.map(item => ({
    item,
    suggestions: searchResults.filter(product => 
      product.name.toLowerCase().includes(item.name.toLowerCase())
    ).slice(0, 3), // Top 3 suggestions
  }));
}

// ─── Context Memory ───────────────────────────────────────────────

/**
 * Voice context memory for follow-up commands
 * 
 * User: "add 2 milk"
 * User: "add one more" → Should add 1 more milk (total 3)
 */
export class VoiceContextMemory {
  private lastItems: VoiceItem[] = [];
  private lastAction: VoiceIntent | null = null;
  private timestamp: number = 0;
  
  // Context expires after 2 minutes
  private readonly CONTEXT_TIMEOUT = 2 * 60 * 1000;
  
  update(items: VoiceItem[], action: VoiceIntent) {
    this.lastItems = items;
    this.lastAction = action;
    this.timestamp = Date.now();
  }
  
  getContext(): { items: VoiceItem[]; action: VoiceIntent | null } | null {
    if (Date.now() - this.timestamp > this.CONTEXT_TIMEOUT) {
      this.clear();
      return null;
    }
    
    return {
      items: this.lastItems,
      action: this.lastAction,
    };
  }
  
  clear() {
    this.lastItems = [];
    this.lastAction = null;
    this.timestamp = 0;
  }
  
  /**
   * Handle follow-up commands like "add one more"
   */
  handleFollowUp(text: string): VoiceItem[] | null {
    const normalized = text.toLowerCase().trim();
    
    // Detect follow-up patterns
    const followUpPatterns = [
      /^(add\s+)?(one|two|three|\d+)\s+more$/i,
      /^more$/i,
      /^same$/i,
    ];
    
    const isFollowUp = followUpPatterns.some(p => p.test(normalized));
    
    if (!isFollowUp) {
      return null;
    }
    
    const context = this.getContext();
    if (!context || context.items.length === 0) {
      return null;
    }
    
    // Extract additional quantity
    const match = normalized.match(/(\d+|one|two|three)\s+more/i);
    let additionalQty = 1;
    
    if (match) {
      const qtyText = match[1].toLowerCase();
      const wordToNum: Record<string, number> = { 'one': 1, 'two': 2, 'three': 3 };
      additionalQty = wordToNum[qtyText] || parseInt(qtyText, 10) || 1;
    }
    
    // Return last items with updated quantity
    return context.items.map(item => ({
      ...item,
      quantity: additionalQty,
    }));
  }
}

// ─── Export Singleton ─────────────────────────────────────────────

export const voiceContext = new VoiceContextMemory();
