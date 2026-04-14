/**
 * Tests for Safe Translation Utility
 */

import { safeT, safeTWithOptions, checkMissingTranslations } from '../safeTranslate';

// Mock console methods
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

describe('safeT', () => {
  it('should return translated value when translation exists', () => {
    const mockT = (key: string) => {
      if (key === 'home.title') return 'Home Page';
      return key;
    };

    const result = safeT(mockT, 'home.title');
    expect(result).toBe('Home Page');
  });

  it('should return custom fallback when translation is missing', () => {
    const mockT = (key: string) => key; // Returns key itself (missing translation)

    const result = safeT(mockT, 'home.missing_key', 'Custom Fallback');
    expect(result).toBe('Custom Fallback');
  });

  it('should return humanized key when no fallback provided', () => {
    const mockT = (key: string) => key;

    const result = safeT(mockT, 'home.error_loading');
    expect(result).toBe('Error Loading');
  });

  it('should handle snake_case keys', () => {
    const mockT = (key: string) => key;

    const result = safeT(mockT, 'user.profile_settings');
    expect(result).toBe('Profile Settings');
  });

  it('should handle camelCase keys', () => {
    const mockT = (key: string) => key;

    const result = safeT(mockT, 'user.profileSettings');
    expect(result).toBe('Profile Settings');
  });

  it('should handle nested keys', () => {
    const mockT = (key: string) => key;

    const result = safeT(mockT, 'deeply.nested.translation.key');
    expect(result).toBe('Key');
  });

  it('should warn in dev mode when translation is missing', () => {
    const mockT = (key: string) => key;

    safeT(mockT, 'missing.key');
    
    if (__DEV__) {
      expect(console.warn).toHaveBeenCalledWith('[i18n] Missing translation: missing.key');
    }
  });

  it('should handle translation function errors gracefully', () => {
    const mockT = () => {
      throw new Error('Translation error');
    };

    const result = safeT(mockT, 'error.key', 'Fallback');
    expect(result).toBe('Fallback');
    
    if (__DEV__) {
      expect(console.error).toHaveBeenCalled();
    }
  });

  it('should handle empty string translations', () => {
    const mockT = () => '';

    const result = safeT(mockT, 'empty.key', 'Fallback');
    expect(result).toBe('Fallback');
  });

  it('should handle null/undefined translations', () => {
    const mockT = () => null as any;

    const result = safeT(mockT, 'null.key', 'Fallback');
    expect(result).toBe('Fallback');
  });
});

describe('safeTWithOptions', () => {
  it('should return translated value with interpolation', () => {
    const mockT = (key: string, options?: any) => {
      if (key === 'welcome.message') {
        return `Welcome, ${options.name}!`;
      }
      return key;
    };

    const result = safeTWithOptions(mockT, 'welcome.message', {
      name: 'John',
      fallback: 'Welcome!'
    });
    
    expect(result).toBe('Welcome, John!');
  });

  it('should return fallback when translation is missing', () => {
    const mockT = (key: string) => key;

    const result = safeTWithOptions(mockT, 'missing.key', {
      name: 'John',
      fallback: 'Hello, {{name}}!'
    });
    
    expect(result).toBe('Hello, {{name}}!');
  });

  it('should handle interpolation with multiple variables', () => {
    const mockT = (key: string, options?: any) => {
      if (key === 'order.summary') {
        return `Order #${options.orderId} - ${options.status}`;
      }
      return key;
    };

    const result = safeTWithOptions(mockT, 'order.summary', {
      orderId: '12345',
      status: 'Delivered'
    });
    
    expect(result).toBe('Order #12345 - Delivered');
  });

  it('should warn in dev mode when translation is missing', () => {
    const mockT = (key: string) => key;

    safeTWithOptions(mockT, 'missing.key', { fallback: 'Fallback' });
    
    if (__DEV__) {
      expect(console.warn).toHaveBeenCalledWith('[i18n] Missing translation: missing.key');
    }
  });

  it('should handle errors gracefully', () => {
    const mockT = () => {
      throw new Error('Translation error');
    };

    const result = safeTWithOptions(mockT, 'error.key', {
      fallback: 'Error Fallback'
    });
    
    expect(result).toBe('Error Fallback');
  });
});

describe('checkMissingTranslations', () => {
  it('should return empty array when all translations exist', () => {
    const mockT = (key: string) => {
      const translations: Record<string, string> = {
        'home.title': 'Home',
        'cart.empty': 'Cart is empty',
        'orders.list': 'Orders'
      };
      return translations[key] || key;
    };

    const keys = ['home.title', 'cart.empty', 'orders.list'];
    const missing = checkMissingTranslations(mockT, keys);
    
    expect(missing).toEqual([]);
  });

  it('should return array of missing keys', () => {
    const mockT = (key: string) => {
      const translations: Record<string, string> = {
        'home.title': 'Home'
      };
      return translations[key] || key;
    };

    const keys = ['home.title', 'cart.empty', 'orders.missing'];
    const missing = checkMissingTranslations(mockT, keys);
    
    expect(missing).toEqual(['cart.empty', 'orders.missing']);
  });

  it('should warn in dev mode when translations are missing', () => {
    const mockT = (key: string) => key;

    const keys = ['missing.key1', 'missing.key2'];
    checkMissingTranslations(mockT, keys);
    
    if (__DEV__) {
      expect(console.warn).toHaveBeenCalledWith(
        '[i18n] Missing translations:',
        ['missing.key1', 'missing.key2']
      );
    }
  });

  it('should handle empty key array', () => {
    const mockT = (key: string) => key;

    const missing = checkMissingTranslations(mockT, []);
    expect(missing).toEqual([]);
  });
});

describe('humanizeKey', () => {
  // Testing through safeT since humanizeKey is not exported
  
  it('should convert snake_case to Title Case', () => {
    const mockT = (key: string) => key;
    
    expect(safeT(mockT, 'error_loading')).toBe('Error Loading');
    expect(safeT(mockT, 'no_products_found')).toBe('No Products Found');
  });

  it('should convert camelCase to Title Case', () => {
    const mockT = (key: string) => key;
    
    expect(safeT(mockT, 'errorLoading')).toBe('Error Loading');
    expect(safeT(mockT, 'noProductsFound')).toBe('No Products Found');
  });

  it('should handle mixed formats', () => {
    const mockT = (key: string) => key;
    
    expect(safeT(mockT, 'error_loadingData')).toBe('Error Loading Data');
  });

  it('should handle single word keys', () => {
    const mockT = (key: string) => key;
    
    expect(safeT(mockT, 'error')).toBe('Error');
    expect(safeT(mockT, 'loading')).toBe('Loading');
  });

  it('should handle keys with numbers', () => {
    const mockT = (key: string) => key;
    
    expect(safeT(mockT, 'error_404')).toBe('Error 404');
  });
});

describe('Edge Cases', () => {
  it('should handle very long keys', () => {
    const mockT = (key: string) => key;
    
    const longKey = 'very.long.nested.key.with.many.parts.error_loading';
    const result = safeT(mockT, longKey);
    
    expect(result).toBe('Error Loading');
  });

  it('should handle keys with special characters', () => {
    const mockT = (key: string) => key;
    
    const result = safeT(mockT, 'error-loading');
    expect(result).toBe('Error-loading'); // Hyphens preserved
  });

  it('should handle empty key', () => {
    const mockT = (key: string) => key;
    
    const result = safeT(mockT, '', 'Fallback');
    expect(result).toBe('Fallback');
  });

  it('should handle whitespace in translations', () => {
    const mockT = (key: string) => {
      if (key === 'test.key') return '  Trimmed Value  ';
      return key;
    };
    
    const result = safeT(mockT, 'test.key');
    expect(result).toBe('  Trimmed Value  '); // Preserves original
  });
});
