/**
 * MASTER CATEGORY CONFIGURATION
 * 
 * This is the SINGLE SOURCE OF TRUTH for all product categories.
 * Mobile User Dashboard defines the categories, everything else adapts.
 * 
 * DO NOT modify this without updating all consuming platforms:
 * - Mobile User Dashboard
 * - Mobile Admin Dashboard
 * - Web Dashboard (future)
 * - Backend filtering logic
 */

/**
 * Production monitoring hook for category errors
 * Logs to console AND reports to monitoring system (Sentry/Datadog/etc)
 * Rate-limited to prevent log flooding
 */
const seenErrors = new Set<string>();

function logCategoryError(message: string, meta?: Record<string, any>) {
  // Rate limiting: Only log unique errors once
  const errorKey = JSON.stringify({ message, ...meta });
  if (seenErrors.has(errorKey)) return;
  seenErrors.add(errorKey);
  
  console.warn(message, meta);
  
  // Future-ready: Plug into monitoring system
  // This will automatically work when Sentry/Datadog is configured
  if (typeof globalThis !== 'undefined' && (globalThis as any).reportError) {
    (globalThis as any).reportError(message, meta);
  }
  
  // Alternative: Direct Sentry integration (if available)
  if (typeof globalThis !== 'undefined' && (globalThis as any).Sentry) {
    (globalThis as any).Sentry.captureMessage(message, {
      level: 'warning',
      extra: meta,
      tags: { domain: 'category_mapping' },
    });
  }
}

export interface CategoryConfig {
  key: string;
  label: string;
  type?: 'product' | 'price';
  value?: number;
  image?: any;
  isTextTile?: boolean;
  tileText?: string;
  tileSubtext?: string;
  tileBg?: string;
  tileColor?: string;
}

/**
 * MASTER CATEGORY LIST
 * Order matters - this is the display order in UI
 */
export const MASTER_CATEGORIES: CategoryConfig[] = [
  {
    key: 'chocolates',
    label: 'Chocolates',
    type: 'product',
    image: require('../assets/images/chocolates.png'),
  },
  {
    key: 'biscuits',
    label: 'Biscuits',
    type: 'product',
    image: require('../assets/images/biscuits.png'),
  },
  {
    key: 'chips',
    label: 'Chips',
    type: 'product',
    image: require('../assets/images/chips.png'),
  },
  {
    key: 'drinks',
    label: 'Drinks',
    type: 'product',
    image: require('../assets/images/drinks.png'),
  },
  {
    key: 'hot_snacks',
    label: 'Hot Snacks',
    type: 'product',
    image: require('../assets/images/hot-snacks.png'),
  },
  {
    key: 'ladoos',
    label: 'Ladoos',
    type: 'product',
    image: require('../assets/images/ladoos.png'),
  },
  {
    key: 'sweets',
    label: 'Sweets',
    type: 'product',
    image: require('../assets/images/sweets.png'),
  },
  // COIN CATEGORIES (Price-based filtering)
  {
    key: 'price_1',
    label: '₹1 Items',
    type: 'price',
    value: 1,
    isTextTile: true,
    tileText: '₹1',
    tileSubtext: 'DEALS',
    tileBg: '#FFF0E6',
    tileColor: '#E65C00',
  },
  {
    key: 'price_2',
    label: '₹2 Items',
    type: 'price',
    value: 2,
    isTextTile: true,
    tileText: '₹2',
    tileSubtext: 'DEALS',
    tileBg: '#EFF6FF',
    tileColor: '#2563EB',
  },
  {
    key: 'price_5',
    label: '₹5 Items',
    type: 'price',
    value: 5,
    isTextTile: true,
    tileText: '₹5',
    tileSubtext: 'DEALS',
    tileBg: '#F0FDF4',
    tileColor: '#16A34A',
  },
];

/**
 * CATEGORY MAPPING: Backend → UI
 * Maps backend category names to UI display names
 */
export const BACKEND_TO_UI_MAPPING: Record<string, string> = {
  chocolates: 'Chocolates',
  biscuits: 'Biscuits',
  snacks: 'Chips',
  beverages: 'Drinks',
  hot_snacks: 'Hot Snacks',
  ladoos: 'Ladoos',
  cakes: 'Sweets',
  // Fallback for unmapped categories
  groceries: 'Other',
  vegetables: 'Other',
  fruits: 'Other',
  dairy: 'Other',
  meat: 'Other',
  household: 'Other',
  personal_care: 'Other',
  medicines: 'Other',
  electronics: 'Other',
  clothing: 'Other',
  other: 'Other',
};

/**
 * CATEGORY MAPPING: UI → Backend
 * Maps UI display names to backend category names for filtering
 */
export const UI_TO_BACKEND_MAPPING: Record<string, string[]> = {
  'Chocolates': ['chocolates'],
  'Biscuits': ['biscuits'],
  'Chips': ['snacks'],
  'Drinks': ['beverages'],
  'Hot Snacks': ['hot_snacks'],
  'Ladoos': ['ladoos'],
  'Sweets': ['cakes'], // Sweets = cakes only (ladoos has its own category)
};

/**
 * Get backend categories for a UI category
 * DEV: Throws error for unmapped categories (fail fast)
 * PROD: Logs warning + reports to monitoring (observable)
 */
export function getBackendCategories(uiCategory: string): string[] {
  const mapped = UI_TO_BACKEND_MAPPING[uiCategory];
  if (!mapped) {
    const errorMsg = `[Category] Unmapped UI category: "${uiCategory}"`;
    
    // Hard fail in development (forces fix)
    if (__DEV__) {
      throw new Error(errorMsg);
    }
    
    // Soft fail in production with monitoring
    logCategoryError(errorMsg, {
      uiCategory,
      availableCategories: Object.keys(UI_TO_BACKEND_MAPPING),
      timestamp: new Date().toISOString(),
    });
  }
  return mapped || [];
}

/**
 * Get UI category for a backend category
 * DEV: Throws error for unmapped categories (fail fast)
 * PROD: Logs warning + reports to monitoring (observable)
 */
export function getUICategory(backendCategory: string): string {
  const mapped = BACKEND_TO_UI_MAPPING[backendCategory];
  if (!mapped) {
    const errorMsg = `[Category] Unmapped backend category: "${backendCategory}" - defaulting to "Chocolates"`;
    
    // Hard fail in development (forces fix)
    if (__DEV__) {
      throw new Error(errorMsg);
    }
    
    // Soft fail in production with monitoring
    logCategoryError(errorMsg, { 
      backendCategory,
      fallback: 'Chocolates',
      timestamp: new Date().toISOString(),
    });
  }
  return mapped || 'Chocolates';
}

/**
 * Check if a product matches a category filter
 */
export function matchesCategoryFilter(
  product: { category: string; price: number },
  categoryConfig: CategoryConfig
): boolean {
  if (categoryConfig.type === 'price') {
    // Price-based filtering with safe number comparison
    const productPrice = Number(product.price);
    const targetPrice = Number(categoryConfig.value);
    return !isNaN(productPrice) && !isNaN(targetPrice) && productPrice === targetPrice;
  } else {
    // Product category filtering
    const backendCategories = getBackendCategories(categoryConfig.label);
    const productCategory = String(product.category || '').toLowerCase();
    return backendCategories.includes(productCategory);
  }
}

/**
 * Get product categories only (exclude price categories)
 */
export function getProductCategories(): CategoryConfig[] {
  return MASTER_CATEGORIES.filter(cat => cat.type === 'product' || !cat.type);
}

/**
 * Get price categories only
 */
export function getPriceCategories(): CategoryConfig[] {
  return MASTER_CATEGORIES.filter(cat => cat.type === 'price');
}

// For backward compatibility
export const CURATED_CATEGORIES = MASTER_CATEGORIES.map(cat => ({
  name: cat.label,
  image: cat.image,
  isTextTile: cat.isTextTile,
  tileText: cat.tileText,
  tileSubtext: cat.tileSubtext,
  tileBg: cat.tileBg,
  tileColor: cat.tileColor,
}));

export const CATEGORIES = CURATED_CATEGORIES;
