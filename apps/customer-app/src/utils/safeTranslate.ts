/**
 * Safe Translation Utility
 * 
 * Prevents raw translation keys from being displayed in the UI.
 * Always provides a human-readable fallback when translations are missing.
 * 
 * @example
 * // Instead of: t('home.error_loading')
 * // Use: safeT(t, 'home.error_loading', 'Failed to load')
 */

/**
 * Converts a translation key into a human-readable string
 * @param key - Translation key (e.g., "home.error_loading")
 * @returns Human-readable string (e.g., "Error Loading")
 */
function humanizeKey(key: string): string {
  // Get the last part of the key (after the last dot)
  const parts = key.split('.');
  const lastPart = parts[parts.length - 1] || key;
  
  // Convert snake_case or camelCase to Title Case
  return lastPart
    .replace(/_/g, ' ')                    // Replace underscores with spaces
    .replace(/([A-Z])/g, ' $1')            // Add space before capital letters
    .replace(/\b\w/g, (c) => c.toUpperCase()) // Capitalize first letter of each word
    .trim();
}

/**
 * Safe translation function with automatic fallback
 * 
 * @param t - The translation function from useTranslation()
 * @param key - Translation key to look up
 * @param fallback - Optional custom fallback text
 * @returns Translated text or fallback (never returns raw key)
 * 
 * @example
 * const { t } = useTranslation();
 * 
 * // With custom fallback
 * safeT(t, 'home.error_loading', 'Something went wrong')
 * 
 * // With auto-generated fallback
 * safeT(t, 'home.no_products_title') // Returns "No Products Title" if missing
 */
export function safeT(
  t: (key: string) => string,
  key: string,
  fallback?: string
): string {
  try {
    const value = t(key);
    
    // i18next returns the key itself if translation is missing
    if (!value || value === key) {
      if (__DEV__) {
        console.warn(`[i18n] Missing translation: ${key}`);
      }
      return fallback || humanizeKey(key);
    }
    
    return value;
  } catch (error) {
    if (__DEV__) {
      console.error(`[i18n] Translation error for key "${key}":`, error);
    }
    return fallback || humanizeKey(key);
  }
}

/**
 * Safe translation with interpolation support
 * 
 * @param t - The translation function from useTranslation()
 * @param key - Translation key to look up
 * @param options - Interpolation options and fallback
 * @returns Translated text with interpolated values or fallback
 * 
 * @example
 * safeTWithOptions(t, 'home.error_loading', {
 *   count: 5,
 *   fallback: 'Failed to load {{count}} items'
 * })
 */
export function safeTWithOptions(
  t: (key: string, options?: any) => string,
  key: string,
  options: Record<string, any> & { fallback?: string } = {}
): string {
  try {
    const { fallback, ...interpolationOptions } = options;
    const value = t(key, interpolationOptions);
    
    if (!value || value === key) {
      if (__DEV__) {
        console.warn(`[i18n] Missing translation: ${key}`);
      }
      return fallback || humanizeKey(key);
    }
    
    return value;
  } catch (error) {
    if (__DEV__) {
      console.error(`[i18n] Translation error for key "${key}":`, error);
    }
    return options.fallback || humanizeKey(key);
  }
}

/**
 * Batch check for missing translations (useful for debugging)
 * 
 * @param t - The translation function
 * @param keys - Array of translation keys to check
 * @returns Array of missing keys
 */
export function checkMissingTranslations(
  t: (key: string) => string,
  keys: string[]
): string[] {
  const missing: string[] = [];
  
  keys.forEach(key => {
    const value = t(key);
    if (!value || value === key) {
      missing.push(key);
    }
  });
  
  if (missing.length > 0 && __DEV__) {
    console.warn('[i18n] Missing translations:', missing);
  }
  
  return missing;
}

export default safeT;
