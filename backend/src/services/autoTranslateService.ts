/**
 * Auto-Translation Service
 * Uses Google Translate API with Redis caching for automatic translation
 * of dynamic content (product names, descriptions)
 */

import { createClient } from 'redis';

// Redis client singleton
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });
    redisClient.on('error', (err) => console.error('Redis Client Error', err));
    await redisClient.connect();
  }
  return redisClient;
}

// Supported languages
export type SupportedLanguage = 'en' | 'te' | 'hi';

const LANGUAGE_CODES: Record<SupportedLanguage, string> = {
  en: 'en',
  te: 'te',
  hi: 'hi',
};

interface TranslateOptions {
  text: string;
  sourceLang?: SupportedLanguage;
  targetLang: SupportedLanguage;
}

interface TranslationResult {
  translatedText: string;
  cached: boolean;
}

/**
 * Generate cache key for translation
 */
function getCacheKey(text: string, sourceLang: string, targetLang: string): string {
  // Use hash of text for shorter keys
  const hash = Buffer.from(text).toString('base64').slice(0, 64);
  return `translate:${sourceLang}:${targetLang}:${hash}`;
}

/**
 * Translate text using Google Translate API
 * Falls back to original text if translation fails
 */
export async function translateText(options: TranslateOptions): Promise<TranslationResult> {
  const { text, sourceLang = 'en', targetLang } = options;

  // No need to translate if same language
  if (sourceLang === targetLang) {
    return { translatedText: text, cached: false };
  }

  // Skip empty text
  if (!text || text.trim() === '') {
    return { translatedText: text, cached: false };
  }

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!apiKey) {
    console.warn('GOOGLE_TRANSLATE_API_KEY not set, skipping translation');
    return { translatedText: text, cached: false };
  }

  try {
    // Check Redis cache first
    const redis = await getRedisClient();
    const cacheKey = getCacheKey(text, sourceLang, targetLang);
    const cached = await redis.get(cacheKey);

    if (cached) {
      return { translatedText: cached, cached: true };
    }

    // Call Google Translate API
    const url = 'https://translation.googleapis.com/language/translate/v2';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q: text,
        source: LANGUAGE_CODES[sourceLang],
        target: LANGUAGE_CODES[targetLang],
        format: 'text',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google Translate API error:', errorData);
      return { translatedText: text, cached: false };
    }

    const data = await response.json();
    const translatedText = data.data?.translations?.[0]?.translatedText || text;

    // Cache the result for 30 days (translation doesn't change often)
    await redis.setEx(cacheKey, 30 * 24 * 60 * 60, translatedText);

    return { translatedText, cached: false };
  } catch (error) {
    console.error('Translation error:', error);
    return { translatedText: text, cached: false };
  }
}

/**
 * Translate product name and description to all supported languages
 */
export async function translateProduct(
  name: string,
  description: string,
  sourceLang: SupportedLanguage = 'en'
): Promise<{
  nameTranslations: Record<SupportedLanguage, string>;
  descriptionTranslations: Record<SupportedLanguage, string>;
}> {
  const targetLanguages: SupportedLanguage[] = ['en', 'te', 'hi'];

  const nameTranslations: Record<SupportedLanguage, string> = {} as any;
  const descriptionTranslations: Record<SupportedLanguage, string> = {} as any;

  // Translate to all target languages in parallel
  await Promise.all(
    targetLanguages.map(async (targetLang) => {
      const [nameResult, descResult] = await Promise.all([
        translateText({ text: name, sourceLang, targetLang }),
        translateText({ text: description, sourceLang, targetLang }),
      ]);

      nameTranslations[targetLang] = nameResult.translatedText;
      descriptionTranslations[targetLang] = descResult.translatedText;
    })
  );

  return { nameTranslations, descriptionTranslations };
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeTranslationService(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
