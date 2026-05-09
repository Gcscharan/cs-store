#!/usr/bin/env node

/**
 * i18n Translation Validation Script
 * 
 * Scans the codebase for translation keys and validates them against
 * the translation files to ensure no missing translations.
 * 
 * Usage:
 *   node scripts/validate-i18n.js
 * 
 * Exit codes:
 *   0 - All translations valid
 *   1 - Missing translations found
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Configuration
const CONFIG = {
  translationFile: path.join(__dirname, '../packages/i18n/src/locales/en.json'),
  sourceDir: path.join(__dirname, '../apps/customer-app/src'),
  filePattern: '**/*.{ts,tsx}',
  ignorePatterns: [
    '**/node_modules/**',
    '**/__tests__/**',
    '**/*.test.ts',
    '**/*.test.tsx',
  ],
};

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Load translation file
 */
function loadTranslations() {
  try {
    const content = fs.readFileSync(CONFIG.translationFile, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`${colors.red}Error loading translation file:${colors.reset}`, error.message);
    process.exit(1);
  }
}

/**
 * Extract translation keys from source files
 */
function extractKeysFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const keys = new Set();
  
  // Pattern 1: t('key') or t("key")
  const pattern1 = /\bt\(['"]([a-zA-Z0-9._-]+)['"]\)/g;
  let match;
  
  while ((match = pattern1.exec(content)) !== null) {
    keys.add(match[1]);
  }
  
  // Pattern 2: safeT(t, 'key', ...) or safeT(t, "key", ...)
  const pattern2 = /safeT\(t,\s*['"]([a-zA-Z0-9._-]+)['"]/g;
  
  while ((match = pattern2.exec(content)) !== null) {
    keys.add(match[1]);
  }
  
  // Pattern 3: safeTWithOptions(t, 'key', ...)
  const pattern3 = /safeTWithOptions\(t,\s*['"]([a-zA-Z0-9._-]+)['"]/g;
  
  while ((match = pattern3.exec(content)) !== null) {
    keys.add(match[1]);
  }
  
  return Array.from(keys);
}

/**
 * Get all source files
 */
function getSourceFiles() {
  const pattern = path.join(CONFIG.sourceDir, CONFIG.filePattern);
  
  return glob.sync(pattern, {
    ignore: CONFIG.ignorePatterns.map(p => path.join(CONFIG.sourceDir, p)),
  });
}

/**
 * Check if a translation key exists in the translations object
 */
function keyExists(translations, key) {
  const parts = key.split('.');
  let current = translations;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return false;
    }
  }
  
  return true;
}

/**
 * Flatten nested translation object to dot notation
 */
function flattenTranslations(obj, prefix = '') {
  const result = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenTranslations(value, newKey));
    } else {
      result[newKey] = value;
    }
  }
  
  return result;
}

/**
 * Main validation function
 */
function validateTranslations() {
  console.log(`${colors.cyan}=== i18n Translation Validation ===${colors.reset}\n`);
  
  // Load translations
  console.log(`${colors.blue}Loading translations...${colors.reset}`);
  const translations = loadTranslations();
  const flatTranslations = flattenTranslations(translations);
  console.log(`${colors.green}✓${colors.reset} Loaded ${Object.keys(flatTranslations).length} translation keys\n`);
  
  // Get source files
  console.log(`${colors.blue}Scanning source files...${colors.reset}`);
  const sourceFiles = getSourceFiles();
  console.log(`${colors.green}✓${colors.reset} Found ${sourceFiles.length} source files\n`);
  
  // Extract keys from all files
  console.log(`${colors.blue}Extracting translation keys...${colors.reset}`);
  const allKeys = new Set();
  const keysByFile = {};
  
  for (const file of sourceFiles) {
    const keys = extractKeysFromFile(file);
    if (keys.length > 0) {
      keysByFile[file] = keys;
      keys.forEach(key => allKeys.add(key));
    }
  }
  
  console.log(`${colors.green}✓${colors.reset} Found ${allKeys.size} unique translation keys in use\n`);
  
  // Validate keys
  console.log(`${colors.blue}Validating translation keys...${colors.reset}\n`);
  const missingKeys = [];
  const validKeys = [];
  
  for (const key of allKeys) {
    if (keyExists(translations, key)) {
      validKeys.push(key);
    } else {
      missingKeys.push(key);
    }
  }
  
  // Report results
  console.log(`${colors.cyan}=== Validation Results ===${colors.reset}\n`);
  
  if (missingKeys.length === 0) {
    console.log(`${colors.green}✓ All translation keys are valid!${colors.reset}`);
    console.log(`  Total keys: ${allKeys.size}`);
    console.log(`  Valid: ${validKeys.length}`);
    console.log(`  Missing: 0\n`);
    return true;
  }
  
  console.log(`${colors.red}✗ Found ${missingKeys.length} missing translation keys:${colors.reset}\n`);
  
  // Group missing keys by prefix
  const missingByPrefix = {};
  for (const key of missingKeys) {
    const prefix = key.split('.')[0];
    if (!missingByPrefix[prefix]) {
      missingByPrefix[prefix] = [];
    }
    missingByPrefix[prefix].push(key);
  }
  
  // Display missing keys grouped by prefix
  for (const [prefix, keys] of Object.entries(missingByPrefix)) {
    console.log(`${colors.yellow}${prefix}:${colors.reset}`);
    keys.forEach(key => {
      console.log(`  - ${key}`);
      
      // Find files using this key
      const filesUsingKey = Object.entries(keysByFile)
        .filter(([_, fileKeys]) => fileKeys.includes(key))
        .map(([file, _]) => path.relative(process.cwd(), file));
      
      if (filesUsingKey.length > 0) {
        console.log(`    ${colors.cyan}Used in:${colors.reset} ${filesUsingKey.join(', ')}`);
      }
    });
    console.log();
  }
  
  // Suggest fixes
  console.log(`${colors.cyan}=== Suggested Fixes ===${colors.reset}\n`);
  console.log('Add the following keys to packages/i18n/src/locales/en.json:\n');
  
  for (const [prefix, keys] of Object.entries(missingByPrefix)) {
    console.log(`"${prefix}": {`);
    keys.forEach(key => {
      const keyName = key.split('.').pop();
      const humanized = keyName
        .replace(/_/g, ' ')
        .replace(/([A-Z])/g, ' $1')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
      console.log(`  "${keyName}": "${humanized}",`);
    });
    console.log('},\n');
  }
  
  return false;
}

/**
 * Generate statistics
 */
function generateStats() {
  const translations = loadTranslations();
  const flatTranslations = flattenTranslations(translations);
  const sourceFiles = getSourceFiles();
  
  const allKeys = new Set();
  for (const file of sourceFiles) {
    const keys = extractKeysFromFile(file);
    keys.forEach(key => allKeys.add(key));
  }
  
  const usedKeys = Array.from(allKeys).filter(key => keyExists(translations, key));
  const unusedKeys = Object.keys(flatTranslations).filter(key => !allKeys.has(key));
  
  console.log(`${colors.cyan}=== Translation Statistics ===${colors.reset}\n`);
  console.log(`Total translation keys defined: ${Object.keys(flatTranslations).length}`);
  console.log(`Total keys used in code: ${allKeys.size}`);
  console.log(`Used keys: ${usedKeys.length}`);
  console.log(`Unused keys: ${unusedKeys.length}`);
  console.log(`Coverage: ${((usedKeys.length / allKeys.size) * 100).toFixed(1)}%\n`);
  
  if (unusedKeys.length > 0 && unusedKeys.length < 20) {
    console.log(`${colors.yellow}Unused keys (consider removing):${colors.reset}`);
    unusedKeys.forEach(key => console.log(`  - ${key}`));
    console.log();
  }
}

// Run validation
const isValid = validateTranslations();

// Show stats if requested
if (process.argv.includes('--stats')) {
  console.log();
  generateStats();
}

// Exit with appropriate code
process.exit(isValid ? 0 : 1);
