/**
 * Voice Correction Tests
 * 
 * Tests for dynamic catalog-driven voice correction system
 */

import { 
  correctVoiceQuery, 
  correctMultiWordQuery,
  findBestMatch,
  findBestProductMatch,
  normalize,
  correctionEngine 
} from '../voiceCorrection';
import type { Product } from '../../types';

// Mock products for testing
const mockProducts: Product[] = [
  {
    _id: '1',
    name: 'Green Lays 52g',
    description: 'Crispy potato chips',
    price: 20,
    mrp: 25,
    category: 'Snacks',
    images: [],
    stock: 100,
  },
  {
    _id: '2',
    name: 'Dairy Milk Chocolate',
    description: 'Smooth milk chocolate',
    price: 50,
    mrp: 60,
    category: 'Chocolate',
    images: [],
    stock: 50,
  },
  {
    _id: '3',
    name: 'Coke 500ml',
    description: 'Refreshing cola drink',
    price: 40,
    mrp: 45,
    category: 'Beverages',
    images: [],
    stock: 200,
  },
  {
    _id: '4',
    name: 'Amul Milk 1L',
    description: 'Fresh full cream milk',
    price: 60,
    mrp: 65,
    category: 'Dairy',
    images: [],
    stock: 150,
  },
];

describe('Voice Correction - Dynamic System', () => {
  beforeEach(() => {
    // Clear and rebuild dictionary before each test
    correctionEngine.clear();
    correctionEngine.buildDictionary(mockProducts);
  });

  describe('normalize', () => {
    it('should convert to lowercase', () => {
      expect(normalize('GREEN LAYS')).toBe('green lays');
    });

    it('should remove special characters', () => {
      expect(normalize('green-lays!')).toBe('greenlays');
    });

    it('should trim whitespace', () => {
      expect(normalize('  green lays  ')).toBe('green lays');
    });
  });

  describe('Dictionary Building', () => {
    it('should build dictionary from products', () => {
      const dictionary = correctionEngine.getDictionary();
      expect(dictionary.length).toBeGreaterThan(0);
    });

    it('should include product names', () => {
      const dictionary = correctionEngine.getDictionary();
      const productNames = dictionary.filter(e => e.type === 'product');
      expect(productNames.length).toBe(4);
    });

    it('should include individual words', () => {
      const dictionary = correctionEngine.getDictionary();
      const words = dictionary.filter(e => e.type === 'word');
      expect(words.length).toBeGreaterThan(0);
    });

    it('should include categories', () => {
      const dictionary = correctionEngine.getDictionary();
      const categories = dictionary.filter(e => e.type === 'category');
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  describe('findBestMatch', () => {
    it('should correct "greenlense" to "green lays"', () => {
      const result = findBestMatch('greenlense');
      expect(result).not.toBeNull();
      expect(result?.text).toContain('green');
      expect(result?.score).toBeGreaterThan(0.6);
    });

    it('should correct "dary milk" to "dairy milk"', () => {
      const result = findBestMatch('dary milk');
      expect(result).not.toBeNull();
      expect(result?.text).toContain('dairy');
      expect(result?.score).toBeGreaterThan(0.6);
    });

    it('should correct "cok" to "coke"', () => {
      const result = findBestMatch('cok');
      expect(result).not.toBeNull();
      expect(result?.text).toContain('coke');
      expect(result?.score).toBeGreaterThan(0.6);
    });

    it('should return null for very low confidence', () => {
      const result = findBestMatch('xyz123abc', 0.6);
      expect(result).toBeNull();
    });

    it('should prefer full product names', () => {
      const result = findBestMatch('green lays');
      expect(result).not.toBeNull();
      expect(result?.type).toBe('product');
    });
  });

  describe('findBestProductMatch', () => {
    it('should find best matching product directly', () => {
      const result = findBestProductMatch('greenlense', mockProducts);
      expect(result).not.toBeNull();
      expect(result?.product.name).toContain('Green Lays');
      expect(result?.score).toBeGreaterThan(0.6);
    });

    it('should return null for no match', () => {
      const result = findBestProductMatch('xyz123', mockProducts, 0.6);
      expect(result).toBeNull();
    });
  });

  describe('correctVoiceQuery', () => {
    it('should correct and return metadata', () => {
      const result = correctVoiceQuery('greenlense');
      expect(result.matched).toBe(true);
      expect(result.corrected).not.toBe('greenlense');
      expect(result.confidence).toBeGreaterThan(0.6);
      expect(result.original).toBe('greenlense');
    });

    it('should not correct high-confidence queries', () => {
      const result = correctVoiceQuery('green lays');
      expect(result.matched).toBe(true);
      expect(result.corrected).toContain('green');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should return original for low confidence', () => {
      const result = correctVoiceQuery('xyz123abc');
      expect(result.matched).toBe(false);
      expect(result.corrected).toBe('xyz123abc');
      expect(result.confidence).toBe(0);
    });

    it('should handle empty input', () => {
      const result = correctVoiceQuery('');
      expect(result.matched).toBe(false);
      expect(result.corrected).toBe('');
    });
  });

  describe('correctMultiWordQuery', () => {
    it('should correct multiple words', () => {
      const result = correctMultiWordQuery('greenlense and dary milk');
      expect(result).toContain('green');
      expect(result).toContain('dairy');
    });

    it('should handle single word', () => {
      const result = correctMultiWordQuery('greenlense');
      expect(result).toContain('green');
    });
  });

  describe('Cache Management', () => {
    it('should indicate when refresh is needed', () => {
      // Fresh dictionary
      expect(correctionEngine.needsRefresh()).toBe(false);
    });

    it('should allow manual clear', () => {
      correctionEngine.clear();
      expect(correctionEngine.getDictionary().length).toBe(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle common misspellings', () => {
      const testCases = [
        { input: 'greenlense', expected: 'green' },
        { input: 'dary milk', expected: 'dairy' },
        { input: 'cok', expected: 'coke' },
        { input: 'aml milk', expected: 'amul' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = correctVoiceQuery(input);
        expect(result.corrected.toLowerCase()).toContain(expected);
      });
    });

    it('should handle phonetic similarities', () => {
      // "lays" and "laze" sound similar
      const result = findBestMatch('laze');
      expect(result).not.toBeNull();
      expect(result?.text).toContain('lays');
    });

    it('should handle partial matches', () => {
      const result = findBestMatch('green');
      expect(result).not.toBeNull();
      expect(result?.text).toContain('green');
    });
  });

  describe('Dynamic Updates', () => {
    it('should work with newly added products', () => {
      // Add new product
      const newProduct: Product = {
        _id: '5',
        name: 'Oreo Cookies',
        description: 'Chocolate sandwich cookies',
        price: 30,
        mrp: 35,
        category: 'Biscuits',
        images: [],
        stock: 80,
      };

      // Rebuild dictionary with new product
      correctionEngine.buildDictionary([...mockProducts, newProduct]);

      // Test correction
      const result = correctVoiceQuery('orio cookies');
      expect(result.matched).toBe(true);
      expect(result.corrected).toContain('oreo');
    });

    it('should handle removed products', () => {
      // Rebuild with fewer products
      correctionEngine.buildDictionary(mockProducts.slice(0, 2));

      const dictionary = correctionEngine.getDictionary();
      const productNames = dictionary.filter(e => e.type === 'product');
      expect(productNames.length).toBe(2);
    });
  });
});
