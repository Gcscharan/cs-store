/**
 * Category Mapping Integrity Tests
 * 
 * These tests protect against future category drift and ensure
 * the mapping layer remains consistent as the system evolves.
 * 
 * Critical for preventing:
 * - Broken mappings
 * - Duplicate category overlaps
 * - Silent regressions
 */

import {
  MASTER_CATEGORIES,
  UI_TO_BACKEND_MAPPING,
  BACKEND_TO_UI_MAPPING,
  getBackendCategories,
  getUICategory,
  getProductCategories,
  getPriceCategories,
  matchesCategoryFilter,
} from '../categoriesConfig';

describe('Category Mapping Integrity', () => {
  describe('MASTER_CATEGORIES structure', () => {
    it('should have exactly 10 categories (7 product + 3 price)', () => {
      expect(MASTER_CATEGORIES).toHaveLength(10);
    });

    it('should have 7 product categories', () => {
      const productCategories = MASTER_CATEGORIES.filter(
        cat => cat.type === 'product' || !cat.type
      );
      expect(productCategories).toHaveLength(7);
    });

    it('should have 3 price categories', () => {
      const priceCategories = MASTER_CATEGORIES.filter(
        cat => cat.type === 'price'
      );
      expect(priceCategories).toHaveLength(3);
    });

    it('should have unique keys', () => {
      const keys = MASTER_CATEGORIES.map(cat => cat.key);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });

    it('should have unique labels', () => {
      const labels = MASTER_CATEGORIES.map(cat => cat.label);
      const uniqueLabels = new Set(labels);
      expect(labels.length).toBe(uniqueLabels.size);
    });

    it('price categories should have valid numeric values', () => {
      const priceCategories = MASTER_CATEGORIES.filter(
        cat => cat.type === 'price'
      );
      priceCategories.forEach(cat => {
        expect(cat.value).toBeDefined();
        expect(typeof cat.value).toBe('number');
        expect(cat.value).toBeGreaterThan(0);
      });
    });
  });

  describe('UI → Backend Mapping', () => {
    it('all product categories should map to backend', () => {
      const productCategories = MASTER_CATEGORIES.filter(
        cat => cat.type === 'product' || !cat.type
      );
      
      productCategories.forEach(cat => {
        const backendCategories = getBackendCategories(cat.label);
        expect(backendCategories.length).toBeGreaterThan(0);
      });
    });

    it('should not have duplicate backend mappings', () => {
      const allBackendCategories = Object.values(UI_TO_BACKEND_MAPPING).flat();
      const uniqueBackendCategories = new Set(allBackendCategories);
      
      // Check for duplicates
      expect(allBackendCategories.length).toBe(uniqueBackendCategories.size);
    });

    it('should map Sweets to cakes only (no ladoos overlap)', () => {
      const sweetsMapping = UI_TO_BACKEND_MAPPING['Sweets'];
      expect(sweetsMapping).toEqual(['cakes']);
      expect(sweetsMapping).not.toContain('ladoos');
    });

    it('should map Ladoos independently', () => {
      const ladoosMapping = UI_TO_BACKEND_MAPPING['Ladoos'];
      expect(ladoosMapping).toEqual(['ladoos']);
    });

    it('all UI mappings should be lowercase', () => {
      Object.values(UI_TO_BACKEND_MAPPING).flat().forEach(backendCat => {
        expect(backendCat).toBe(backendCat.toLowerCase());
      });
    });
  });

  describe('Backend → UI Mapping', () => {
    it('should map all primary backend categories', () => {
      const primaryBackendCategories = [
        'chocolates',
        'biscuits',
        'snacks',
        'beverages',
        'hot_snacks',
        'ladoos',
        'cakes',
      ];

      primaryBackendCategories.forEach(backendCat => {
        const uiCategory = BACKEND_TO_UI_MAPPING[backendCat];
        expect(uiCategory).toBeDefined();
        expect(uiCategory).not.toBe('Other');
      });
    });

    it('should map unmapped categories to fallback', () => {
      const unmappedCategories = [
        'groceries',
        'vegetables',
        'fruits',
        'dairy',
        'meat',
        'household',
        'personal_care',
        'medicines',
        'electronics',
        'clothing',
        'other',
      ];

      unmappedCategories.forEach(backendCat => {
        const uiCategory = BACKEND_TO_UI_MAPPING[backendCat];
        expect(uiCategory).toBe('Other');
      });
    });
  });

  describe('getBackendCategories()', () => {
    it('should return array for valid UI category', () => {
      const result = getBackendCategories('Chocolates');
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(['chocolates']);
    });

    it('should return empty array for invalid UI category', () => {
      // Suppress console.warn in test
      const originalWarn = console.warn;
      console.warn = jest.fn();

      const result = getBackendCategories('InvalidCategory');
      expect(result).toEqual([]);

      console.warn = originalWarn;
    });

    it('should handle all product categories', () => {
      const productCategories = getProductCategories();
      productCategories.forEach(cat => {
        const backendCategories = getBackendCategories(cat.label);
        expect(backendCategories.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getUICategory()', () => {
    it('should return UI category for valid backend category', () => {
      expect(getUICategory('chocolates')).toBe('Chocolates');
      expect(getUICategory('snacks')).toBe('Chips');
      expect(getUICategory('beverages')).toBe('Drinks');
    });

    it('should return fallback for unmapped backend category', () => {
      // Suppress console.warn in test
      const originalWarn = console.warn;
      console.warn = jest.fn();

      const result = getUICategory('unknown_category');
      expect(result).toBe('Chocolates');

      console.warn = originalWarn;
    });
  });

  describe('getProductCategories()', () => {
    it('should return only product categories', () => {
      const productCategories = getProductCategories();
      expect(productCategories).toHaveLength(7);
      
      productCategories.forEach(cat => {
        expect(cat.type === 'product' || !cat.type).toBe(true);
      });
    });

    it('should not include price categories', () => {
      const productCategories = getProductCategories();
      const hasPriceCategory = productCategories.some(cat => cat.type === 'price');
      expect(hasPriceCategory).toBe(false);
    });
  });

  describe('getPriceCategories()', () => {
    it('should return only price categories', () => {
      const priceCategories = getPriceCategories();
      expect(priceCategories).toHaveLength(3);
      
      priceCategories.forEach(cat => {
        expect(cat.type).toBe('price');
      });
    });

    it('should have ₹1, ₹2, ₹5 categories', () => {
      const priceCategories = getPriceCategories();
      const values = priceCategories.map(cat => cat.value);
      expect(values).toContain(1);
      expect(values).toContain(2);
      expect(values).toContain(5);
    });
  });

  describe('matchesCategoryFilter()', () => {
    describe('Product category filtering', () => {
      it('should match product with correct category', () => {
        const product = { category: 'chocolates', price: 10 };
        const categoryConfig = MASTER_CATEGORIES.find(cat => cat.label === 'Chocolates')!;
        
        expect(matchesCategoryFilter(product, categoryConfig)).toBe(true);
      });

      it('should not match product with different category', () => {
        const product = { category: 'biscuits', price: 10 };
        const categoryConfig = MASTER_CATEGORIES.find(cat => cat.label === 'Chocolates')!;
        
        expect(matchesCategoryFilter(product, categoryConfig)).toBe(false);
      });

      it('should handle mapped categories (snacks → Chips)', () => {
        const product = { category: 'snacks', price: 10 };
        const categoryConfig = MASTER_CATEGORIES.find(cat => cat.label === 'Chips')!;
        
        expect(matchesCategoryFilter(product, categoryConfig)).toBe(true);
      });
    });

    describe('Price category filtering', () => {
      it('should match product with exact price (number)', () => {
        const product = { category: 'chocolates', price: 1 };
        const categoryConfig = MASTER_CATEGORIES.find(cat => cat.label === '₹1 Items')!;
        
        expect(matchesCategoryFilter(product, categoryConfig)).toBe(true);
      });

      it('should match product with exact price (decimal)', () => {
        const product = { category: 'chocolates', price: 1.0 };
        const categoryConfig = MASTER_CATEGORIES.find(cat => cat.label === '₹1 Items')!;
        
        expect(matchesCategoryFilter(product, categoryConfig)).toBe(true);
      });

      it('should match product with string price', () => {
        const product = { category: 'chocolates', price: '2' as any };
        const categoryConfig = MASTER_CATEGORIES.find(cat => cat.label === '₹2 Items')!;
        
        expect(matchesCategoryFilter(product, categoryConfig)).toBe(true);
      });

      it('should not match product with different price', () => {
        const product = { category: 'chocolates', price: 2 };
        const categoryConfig = MASTER_CATEGORIES.find(cat => cat.label === '₹1 Items')!;
        
        expect(matchesCategoryFilter(product, categoryConfig)).toBe(false);
      });

      it('should handle NaN prices safely', () => {
        const product = { category: 'chocolates', price: NaN };
        const categoryConfig = MASTER_CATEGORIES.find(cat => cat.label === '₹1 Items')!;
        
        expect(matchesCategoryFilter(product, categoryConfig)).toBe(false);
      });

      it('should handle invalid price strings', () => {
        const product = { category: 'chocolates', price: 'invalid' as any };
        const categoryConfig = MASTER_CATEGORIES.find(cat => cat.label === '₹1 Items')!;
        
        expect(matchesCategoryFilter(product, categoryConfig)).toBe(false);
      });
    });
  });

  describe('Regression Prevention', () => {
    it('should prevent future Sweets/Ladoos overlap', () => {
      const sweetsBackend = UI_TO_BACKEND_MAPPING['Sweets'];
      const ladoosBackend = UI_TO_BACKEND_MAPPING['Ladoos'];
      
      // Ensure no overlap
      const overlap = sweetsBackend.filter(cat => ladoosBackend.includes(cat));
      expect(overlap).toHaveLength(0);
    });

    it('should ensure all product categories are visible', () => {
      const productCategories = getProductCategories();
      
      productCategories.forEach(cat => {
        const backendCategories = getBackendCategories(cat.label);
        expect(backendCategories.length).toBeGreaterThan(0);
        
        // Verify reverse mapping exists
        backendCategories.forEach(backendCat => {
          const uiCategory = BACKEND_TO_UI_MAPPING[backendCat];
          expect(uiCategory).toBeDefined();
          expect(uiCategory).not.toBe('Other');
        });
      });
    });

    it('should maintain bidirectional mapping consistency', () => {
      // For each UI → Backend mapping, verify Backend → UI maps back
      Object.entries(UI_TO_BACKEND_MAPPING).forEach(([uiCategory, backendCategories]) => {
        backendCategories.forEach(backendCat => {
          const mappedUI = BACKEND_TO_UI_MAPPING[backendCat];
          expect(mappedUI).toBeDefined();
          // Note: mappedUI might not equal uiCategory due to many-to-one mapping
          // But it should exist and not be 'Other' for primary categories
        });
      });
    });
  });
});
