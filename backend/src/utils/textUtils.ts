/**
 * Text Utilities
 * 
 * Shared text processing functions
 */

/**
 * Normalize text: lowercase, remove special chars, trim
 * 
 * 🚨 CRITICAL: Use this EVERYWHERE before saving/comparing
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' '); // Collapse multiple spaces
}

/**
 * Calculate Levenshtein distance
 */
export function levenshteinDistance(s1: string, s2: string): number {
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
 * Calculate similarity score (0-1)
 */
export function similarity(a: string, b: string): number {
  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}
