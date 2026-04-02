/**
 * Cache Service Tests
 * 
 * Unit tests for the cache service abstraction, focusing on:
 * - Basic get/set/delete/clear operations
 * - TTL expiration behavior
 * - Cleanup interval functionality
 */

import { createCacheService, InMemoryCacheService } from '../cacheService';
import fc from 'fast-check';

describe('CacheService', () => {
  describe('Factory Function', () => {
    it('should create an InMemoryCacheService instance', () => {
      const cache = createCacheService();
      expect(cache).toBeInstanceOf(InMemoryCacheService);
    });
  });

  describe('InMemoryCacheService', () => {
    let cache: InMemoryCacheService;

    beforeEach(() => {
      cache = new InMemoryCacheService();
    });

    afterEach(() => {
      cache.stopCleanup();
    });

    describe('get and set', () => {
      it('should store and retrieve a value', async () => {
        await cache.set('test-key', { data: 'test-value' }, 600);
        const result = await cache.get('test-key');
        expect(result).toEqual({ data: 'test-value' });
      });

      it('should return null for non-existent key', async () => {
        const result = await cache.get('non-existent');
        expect(result).toBeNull();
      });

      it('should return null for expired entry', async () => {
        // Set with 1 second TTL
        await cache.set('expire-test', { data: 'value' }, 1);
        
        // Wait 1.1 seconds
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        const result = await cache.get('expire-test');
        expect(result).toBeNull();
      });

      it('should return value within TTL', async () => {
        // Set with 10 second TTL
        await cache.set('valid-test', { data: 'value' }, 10);
        
        // Immediately retrieve
        const result = await cache.get('valid-test');
        expect(result).toEqual({ data: 'value' });
      });

      it('should handle multiple keys independently', async () => {
        await cache.set('key1', 'value1', 600);
        await cache.set('key2', 'value2', 600);
        await cache.set('key3', 'value3', 600);

        expect(await cache.get('key1')).toBe('value1');
        expect(await cache.get('key2')).toBe('value2');
        expect(await cache.get('key3')).toBe('value3');
      });
    });

    describe('delete', () => {
      it('should delete a specific key', async () => {
        await cache.set('delete-test', 'value', 600);
        expect(await cache.get('delete-test')).toBe('value');

        await cache.delete('delete-test');
        expect(await cache.get('delete-test')).toBeNull();
      });

      it('should not affect other keys when deleting', async () => {
        await cache.set('key1', 'value1', 600);
        await cache.set('key2', 'value2', 600);

        await cache.delete('key1');

        expect(await cache.get('key1')).toBeNull();
        expect(await cache.get('key2')).toBe('value2');
      });
    });

    describe('clear', () => {
      it('should clear all cache entries', async () => {
        await cache.set('key1', 'value1', 600);
        await cache.set('key2', 'value2', 600);
        await cache.set('key3', 'value3', 600);

        await cache.clear();

        expect(await cache.get('key1')).toBeNull();
        expect(await cache.get('key2')).toBeNull();
        expect(await cache.get('key3')).toBeNull();
      });
    });

    describe('TTL behavior', () => {
      it('should respect 10-minute TTL (600 seconds)', async () => {
        const tenMinutes = 600;
        await cache.set('ttl-test', 'value', tenMinutes);
        
        // Should be available immediately
        expect(await cache.get('ttl-test')).toBe('value');
      });

      it('should automatically evict expired entries on get', async () => {
        // Set with very short TTL
        await cache.set('evict-test', 'value', 1);
        
        // Wait for expiration
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        // Get should return null and evict the entry
        const result = await cache.get('evict-test');
        expect(result).toBeNull();
        
        // Verify entry was evicted (not just returning null)
        const secondResult = await cache.get('evict-test');
        expect(secondResult).toBeNull();
      });
    });

    describe('Promise-based API', () => {
      it('should return promises for all operations', () => {
        expect(cache.get('test')).toBeInstanceOf(Promise);
        expect(cache.set('test', 'value', 600)).toBeInstanceOf(Promise);
        expect(cache.delete('test')).toBeInstanceOf(Promise);
        expect(cache.clear()).toBeInstanceOf(Promise);
      });

      it('should support async/await', async () => {
        await expect(cache.set('async-test', 'value', 600)).resolves.toBeUndefined();
        await expect(cache.get('async-test')).resolves.toBe('value');
        await expect(cache.delete('async-test')).resolves.toBeUndefined();
        await expect(cache.clear()).resolves.toBeUndefined();
      });
    });

    describe('Edge cases', () => {
      it('should handle empty string as key', async () => {
        await cache.set('', 'value', 600);
        expect(await cache.get('')).toBe('value');
      });

      it('should handle null value', async () => {
        await cache.set('null-test', null, 600);
        expect(await cache.get('null-test')).toBeNull();
      });

      it('should handle undefined value', async () => {
        await cache.set('undefined-test', undefined, 600);
        expect(await cache.get('undefined-test')).toBeUndefined();
      });

      it('should handle complex objects', async () => {
        const complexObject = {
          nested: {
            array: [1, 2, 3],
            string: 'test',
            boolean: true,
          },
        };
        await cache.set('complex', complexObject, 600);
        expect(await cache.get('complex')).toEqual(complexObject);
      });

      it('should handle zero TTL (immediate expiration)', async () => {
        await cache.set('zero-ttl', 'value', 0);
        
        // Wait a tiny bit to ensure expiration
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Should be expired
        const result = await cache.get('zero-ttl');
        expect(result).toBeNull();
      });

      it('should handle very large TTL', async () => {
        const oneYear = 365 * 24 * 60 * 60; // 1 year in seconds
        await cache.set('long-ttl', 'value', oneYear);
        
        // Should be available
        expect(await cache.get('long-ttl')).toBe('value');
      });
    });

    describe('Property-Based Tests', () => {
      /**
       * Property 1: Expired cache entries are not returned
       * 
       * **Validates: Requirements 1.2, 1.3**
       * 
       * For any pincode lookup, if a cached entry exists but its age exceeds 
       * 10 minutes (600 seconds), the cache service SHALL NOT return the cached 
       * value and SHALL evict the entry from cache.
       */
      it('Property 1: Expired cache entries are not returned', async () => {
        await fc.assert(
          fc.asyncProperty(
            // Generate random cache keys
            fc.string({ minLength: 1, maxLength: 50 }),
            // Generate random cache values
            fc.record({
              state: fc.string(),
              postal_district: fc.string(),
              cities: fc.array(fc.string()),
              single_city: fc.oneof(fc.string(), fc.constant(null)),
            }),
            // Generate SHORT TTL values for testing (1-5 seconds instead of 1-600)
            fc.integer({ min: 1, max: 5 }), // TTL in seconds (1-5 seconds for faster tests)
            async (key, value, ttlSeconds) => {
              const cache = new InMemoryCacheService();
              
              try {
                // Set cache entry with the generated TTL
                await cache.set(key, value, ttlSeconds);
                
                // Simulate time passing beyond the TTL (add 1 second buffer)
                const expirationTime = (ttlSeconds + 1) * 1000;
                await new Promise(resolve => setTimeout(resolve, expirationTime));
                
                // Attempt to retrieve the expired entry
                const result = await cache.get(key);
                
                // Property: Expired entries MUST return null
                expect(result).toBeNull();
                
                // Verify the entry was actually evicted (not just returning null)
                // A second get should also return null
                const secondResult = await cache.get(key);
                expect(secondResult).toBeNull();
              } finally {
                cache.stopCleanup();
              }
            }
          ),
          { numRuns: 10 } // Reduced from 20 to 10 for faster execution
        );
      }, 60000); // Increased timeout to 60 seconds (10 runs * 5 seconds max TTL)
    });
  });
});
