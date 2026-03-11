/**
 * Build-time translation checker
 * FAILS the build if any translation key is missing in Telugu or Hindi
 * This ensures you can NEVER accidentally ship untranslated text.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

type TranslationObject = Record<string, string>;

// Read JSON files using fs (avoids ESM import attribute issues)
const localesDir = join(process.cwd(), 'src', 'locales');

function loadTranslations(filename: string): TranslationObject {
  const path = join(localesDir, filename);
  const content = readFileSync(path, 'utf-8');
  return JSON.parse(content);
}

const en = loadTranslations('en.json');
const te = loadTranslations('te.json');
const hi = loadTranslations('hi.json');

function getAllKeys(obj: TranslationObject): string[] {
  return Object.keys(obj);
}

const enKeys = getAllKeys(en);
const teKeys = getAllKeys(te);
const hiKeys = getAllKeys(hi);

let hasErrors = false;

// Check Telugu
const missingTe = enKeys.filter(k => !teKeys.includes(k));
if (missingTe.length > 0) {
  console.error(`\n❌ MISSING TELUGU TRANSLATIONS (${missingTe.length}):`);
  missingTe.forEach(k => console.error(`   te.json missing: "${k}"`));
  hasErrors = true;
}

// Check Hindi
const missingHi = enKeys.filter(k => !hiKeys.includes(k));
if (missingHi.length > 0) {
  console.error(`\n❌ MISSING HINDI TRANSLATIONS (${missingHi.length}):`);
  missingHi.forEach(k => console.error(`   hi.json missing: "${k}"`));
  hasErrors = true;
}

// Check for extra keys in non-English files (optional warning)
const extraTe = teKeys.filter(k => !enKeys.includes(k));
if (extraTe.length > 0) {
  console.warn(`\n⚠️  EXTRA TELUGU KEYS (${extraTe.length}):`);
  extraTe.forEach(k => console.warn(`   te.json has extra key: "${k}"`));
}

const extraHi = hiKeys.filter(k => !enKeys.includes(k));
if (extraHi.length > 0) {
  console.warn(`\n⚠️  EXTRA HINDI KEYS (${extraHi.length}):`);
  extraHi.forEach(k => console.warn(`   hi.json has extra key: "${k}"`));
}

if (hasErrors) {
  console.error('\n🚫 BUILD BLOCKED: Fix missing translations before deploying\n');
  process.exit(1);
} else {
  console.log(`✅ All ${enKeys.length} translation keys present in all 3 languages`);
  process.exit(0);
}
