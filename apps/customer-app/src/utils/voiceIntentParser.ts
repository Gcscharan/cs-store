/**
 * voiceIntentParser.ts
 * 
 * Bridges raw voice STT (Speech-to-Text) into structured shopping intents.
 * Converts fuzzy pronunciations ("lace", "cook") into clean product keywords.
 */

// ─── Dictionary & Mappings ────────────────────────────────────────────────

const PRODUCT_DICTIONARY: Record<string, string[]> = {
  lays: ['lays', 'lace', 'lase', 'lais', 'layss'],
  coke: ['coke', 'cook', 'coca', 'cola'],
  dairy_milk: ['dairy', 'dairy milk', 'milk chocolate', 'silk'],
  maggi: ['maggi', 'maggie', 'magi'],
  biscuits: ['biscuit', 'biscuits', 'biscit'],
  chips: ['chip', 'chips'],
  kurkure: ['kurkure', 'kurkuri', 'kurkurey'],
  thumbs_up: ['thumbs up', 'thumps up', 'thumbsup'],
  mixture: ['mixture', 'mix'],
  boondi: ['boondi', 'bundi'],
  ladoo: ['ladoo', 'ladu', 'laddoo'],
  amul: ['amul', 'milk', 'butter', 'cheese', 'paneer'],
  bread: ['bread', 'pav', 'bun'],
  eggs: ['eggs', 'egg', 'anda'],
  surf_excel: ['surf', 'surf excel', 'detergent', 'powder'],
  dettol: ['dettol', 'soap', 'antiseptic'],
  colgate: ['colgate', 'toothpaste', 'paste'],
  horlicks: ['horlicks', 'health drink'],
  bournvita: ['bournvita'],
  red_label: ['red label', 'tea', 'chai'],
  bru: ['bru', 'coffee'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * 1. Normalize Text
 * Lowercase, remove special chars, trim.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * 2. Extract Keywords
 * Split into raw intent tokens
 */
function extractKeywords(text: string): string[] {
  if (!text) return [];
  return text.split(/\s+/);
}

/**
 * 3. Levenshtein Distance
 * For fuzzy matching when exact variant match fails.
 */
function levenshteinDistance(s1: string, s2: string): number {
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;
  const arr: number[][] = [];
  for (let i = 0; i <= s2.length; i++) arr[i] = [i];
  for (let j = 0; j <= s1.length; j++) arr[0][j] = j;
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      arr[i][j] = s2[i - 1] === s1[j - 1]
        ? arr[i - 1][j - 1]
        : 1 + Math.min(arr[i - 1][j - 1], arr[i][j - 1], arr[i - 1][j]);
    }
  }
  return arr[s2.length][s1.length];
}

function wordSimilarity(a: string, b: string): number {
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length === 0) return 1.0;
  return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}

/**
 * 4. Smart Fuzzy Match / Dictionary Lookup
 * Finds the correct canonical keyword or returns the raw word if no mapping exists.
 */
function matchProduct(word: string): string {
  // 1. Precise Match
  for (const [canonical, variants] of Object.entries(PRODUCT_DICTIONARY)) {
    if (variants.includes(word)) {
      return canonical.replace(/_/g, ' '); 
    }
  }

  // 2. Fuzzy Match (Levensthein)
  let bestMatch = null;
  let highestScore = 0;

  for (const [canonical, variants] of Object.entries(PRODUCT_DICTIONARY)) {
    for (const variant of variants) {
      const score = wordSimilarity(variant, word);
      if (score > 0.7 && score > highestScore) {
        highestScore = score;
        bestMatch = canonical;
      }
    }
  }

  if (bestMatch) {
    return bestMatch.replace(/_/g, ' ');
  }

  return word;
}

// ─── Core Export ─────────────────────────────────────────────────────────

/**
 * buildSearchQuery
 * Master pipeline: string -> clean -> match -> dedup -> final query string
 */
export function buildSearchQuery(rawText: string): string {
  // Try to match hardcoded multi-word exact matches first
  let cleanText = normalizeText(rawText);
  
  // Custom multi-word replacements
  if (cleanText.includes('dairy milk') || cleanText.includes('milk chocolate')) {
    cleanText = cleanText.replace(/dairy milk|milk chocolate/g, 'dairy_milk');
  }
  if (cleanText.includes('thumbs up') || cleanText.includes('thumps up')) {
    cleanText = cleanText.replace(/thumbs up|thumps up/g, 'thumbs_up');
  }

  const words = extractKeywords(cleanText);
  const mappedWords = words.map(matchProduct);

  // Deduplicate array
  const uniqueIntents = [...new Set(mappedWords)];

  return uniqueIntents.join(' ');
}

// ─── Voice Filter Extraction ───────────────────────────────────────────────

/**
 * Structured filter hints extracted from a FILTER-intent voice utterance.
 * Field names/values mirror FilterState so they can be spread directly into
 * the SearchScreen filter state.
 */
export interface VoiceFilters {
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'relevance' | 'price' | 'newest' | 'sales' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Convert words like "twenty", "fifty", "hundred" into numbers, and parse a
 * leading "rs"/"rupees" amount. Returns null when no number is present.
 */
function parseSpokenNumber(token: string): number | null {
  const WORD_NUMBERS: Record<string, number> = {
    ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50,
    sixty: 60, seventy: 70, eighty: 80, ninety: 90,
    hundred: 100, thousand: 1000,
  };
  const t = token.toLowerCase().trim();
  if (WORD_NUMBERS[t] !== undefined) return WORD_NUMBERS[t];
  const digits = t.replace(/[^0-9]/g, '');
  if (digits.length > 0) return Number(digits);
  return null;
}

/**
 * extractVoiceFilters
 * Parses price bounds and sort hints from a natural-language filter phrase.
 *
 * Examples:
 *   "biscuits under 50"           -> { maxPrice: 50 }
 *   "show me cheap chips"         -> { sortBy: 'price', sortOrder: 'asc' }
 *   "premium chocolates"          -> { sortBy: 'price', sortOrder: 'desc' }
 *   "snacks between 20 and 100"   -> { minPrice: 20, maxPrice: 100 }
 *   "top rated coffee"            -> { sortBy: 'rating', sortOrder: 'desc' }
 *   "newest drinks"               -> { sortBy: 'newest', sortOrder: 'desc' }
 *
 * Returns an empty object when no recognizable hints are present, so callers
 * can safely spread the result without overriding existing filters.
 */
export function extractVoiceFilters(rawText: string): VoiceFilters {
  const text = (rawText || '').toLowerCase().replace(/[₹,]/g, ' ');
  const filters: VoiceFilters = {};

  // ── Price bounds ──────────────────────────────────────────────────────
  // "between X and Y"
  const between = text.match(/between\s+(\w+)\s+(?:and|to)\s+(\w+)/);
  if (between) {
    const lo = parseSpokenNumber(between[1]);
    const hi = parseSpokenNumber(between[2]);
    if (lo !== null) filters.minPrice = Math.min(lo, hi ?? lo);
    if (hi !== null) filters.maxPrice = Math.max(lo ?? hi, hi);
  }

  // "under / below / less than / cheaper than / within / up to X"
  if (filters.maxPrice === undefined) {
    const upper = text.match(
      /(?:under|below|less than|cheaper than|within|up to|max|maximum|upto)\s+(?:rs\.?\s*|rupees?\s*)?(\w+)/
    );
    if (upper) {
      const n = parseSpokenNumber(upper[1]);
      if (n !== null && n > 0) filters.maxPrice = n;
    }
  }

  // "above / over / more than / at least / starting from X"
  if (filters.minPrice === undefined) {
    const lower = text.match(
      /(?:above|over|more than|at least|starting from|min|minimum)\s+(?:rs\.?\s*|rupees?\s*)?(\w+)/
    );
    if (lower) {
      const n = parseSpokenNumber(lower[1]);
      if (n !== null && n > 0) filters.minPrice = n;
    }
  }

  // ── Sort hints ────────────────────────────────────────────────────────
  if (/\b(cheap(est)?|low(est)? price|budget|affordable|low to high)\b/.test(text)) {
    filters.sortBy = 'price';
    filters.sortOrder = 'asc';
  } else if (/\b(expensive|premium|costly|high(est)? price|luxury|high to low)\b/.test(text)) {
    filters.sortBy = 'price';
    filters.sortOrder = 'desc';
  } else if (/\b(top rated|best rated|highest rated|best reviewed|top rating)\b/.test(text)) {
    filters.sortBy = 'rating';
    filters.sortOrder = 'desc';
  } else if (/\b(newest|latest|new arrivals?|recent)\b/.test(text)) {
    filters.sortBy = 'newest';
    filters.sortOrder = 'desc';
  } else if (/\b(best ?sell(er|ing)|popular|most sold|trending)\b/.test(text)) {
    filters.sortBy = 'sales';
    filters.sortOrder = 'desc';
  }

  return filters;
}
