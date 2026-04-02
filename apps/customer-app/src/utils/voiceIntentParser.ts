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
