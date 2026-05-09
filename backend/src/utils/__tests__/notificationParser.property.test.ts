/**
 * Property-based tests for notification parser utility
 * 
 * Feature: low-stock-notification-system
 * Property 25: Parser Validation
 * 
 * **Validates: Requirements 14.3, 14.4**
 * 
 * Test validation catches errors for missing/invalid fields
 */

import fc from 'fast-check';
import { parseCreateNotificationData } from '../notificationParser';

// Helper to generate valid MongoDB ObjectId strings (24 hex characters)
const objectIdArb = fc.array(fc.integer({ min: 0, max: 15 }), { minLength: 24, maxLength: 24 })
  .map(arr => arr.map(n => n.toString(16)).join(''));

describe('Feature: low-stock-notification-system, Property 25: Parser Validation', () => {
  describe('Missing required fields', () => {
    it('should catch validation errors for missing type field', () => {
      fc.assert(
        fc.property(
          fc.record({
            productId: objectIdArb,
            productName: fc.string({ minLength: 1, maxLength: 200 }),
            currentStock: fc.integer({ min: 0, max: 100 }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            // Missing type field
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('type must be "LOW_STOCK"');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for missing productId field', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productName: fc.string({ minLength: 1, maxLength: 200 }),
            currentStock: fc.integer({ min: 0, max: 100 }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            // Missing productId field
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('productId is required');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for missing productName field', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: objectIdArb,
            currentStock: fc.integer({ min: 0, max: 100 }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            // Missing productName field
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('productName is required');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for missing currentStock field', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: objectIdArb,
            productName: fc.string({ minLength: 1, maxLength: 200 }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            // Missing currentStock field
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('currentStock is required');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for missing priority field', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: objectIdArb,
            productName: fc.string({ minLength: 1, maxLength: 200 }),
            currentStock: fc.integer({ min: 0, max: 100 }),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            // Missing priority field
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('priority is required');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for missing message field', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: objectIdArb,
            productName: fc.string({ minLength: 1, maxLength: 200 }),
            currentStock: fc.integer({ min: 0, max: 100 }),
            priority: fc.constantFrom('LOW', 'CRITICAL')
          }),
          (data) => {
            // Missing message field
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('message is required');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invalid field types', () => {
    it('should catch validation errors for invalid type field', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.string().filter(s => s !== 'LOW_STOCK'),
            productId: objectIdArb,
            productName: fc.string({ minLength: 1, maxLength: 200 }),
            currentStock: fc.integer({ min: 0, max: 100 }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('type must be "LOW_STOCK"');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for invalid productId (not a valid ObjectId)', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: fc.string().filter(s => s.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(s)),
            productName: fc.string({ minLength: 1, maxLength: 200 }),
            currentStock: fc.integer({ min: 0, max: 100 }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for non-string productName', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: objectIdArb,
            productName: fc.oneof(fc.integer(), fc.boolean(), fc.constant(null), fc.constant(undefined)),
            currentStock: fc.integer({ min: 0, max: 100 }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for non-integer currentStock', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: objectIdArb,
            productName: fc.string({ minLength: 1, maxLength: 200 }),
            currentStock: fc.double({ min: 0.1, max: 100.9, noNaN: true }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('currentStock must be an integer');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for invalid priority value', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: objectIdArb,
            productName: fc.string({ minLength: 1, maxLength: 200 }),
            currentStock: fc.integer({ min: 0, max: 100 }),
            priority: fc.string().filter(s => s !== 'LOW' && s !== 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('priority must be either "LOW" or "CRITICAL"');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Boundary violations', () => {
    it('should catch validation errors for empty productName', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: objectIdArb,
            productName: fc.constantFrom('', '   ', '\t', '\n'),
            currentStock: fc.integer({ min: 0, max: 100 }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('productName cannot be empty');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for productName exceeding 200 characters', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: objectIdArb,
            productName: fc.string({ minLength: 201, maxLength: 500 }),
            currentStock: fc.integer({ min: 0, max: 100 }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('productName cannot exceed 200 characters');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for negative currentStock', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: objectIdArb,
            productName: fc.string({ minLength: 1, maxLength: 200 }),
            currentStock: fc.integer({ min: -1000, max: -1 }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.string({ minLength: 1, maxLength: 500 })
          }),
          (data) => {
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('currentStock must be non-negative');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should catch validation errors for empty message', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constant('LOW_STOCK'),
            productId: objectIdArb,
            productName: fc.string({ minLength: 1, maxLength: 200 }),
            currentStock: fc.integer({ min: 0, max: 100 }),
            priority: fc.constantFrom('LOW', 'CRITICAL'),
            message: fc.constantFrom('', '   ', '\t', '\n')
          }),
          (data) => {
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
            expect(() => parseCreateNotificationData(data)).toThrow('message cannot be empty');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Multiple validation errors', () => {
    it('should catch validation errors when multiple fields are invalid', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.string().filter(s => s !== 'LOW_STOCK'),
            productId: fc.string().filter(s => s.length !== 24),
            productName: fc.constantFrom('', '   '),
            currentStock: fc.integer({ min: -100, max: -1 }),
            priority: fc.string().filter(s => s !== 'LOW' && s !== 'CRITICAL'),
            message: fc.constantFrom('', '   ')
          }),
          (data) => {
            expect(() => parseCreateNotificationData(data)).toThrow('Validation failed');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Descriptive error messages', () => {
    it('should return descriptive error messages for validation failures', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            // Missing productId
            fc.record({
              type: fc.constant('LOW_STOCK'),
              productName: fc.string({ minLength: 1, maxLength: 200 }),
              currentStock: fc.integer({ min: 0, max: 100 }),
              priority: fc.constantFrom('LOW', 'CRITICAL'),
              message: fc.string({ minLength: 1, maxLength: 500 })
            }),
            // Invalid priority
            fc.record({
              type: fc.constant('LOW_STOCK'),
              productId: objectIdArb,
              productName: fc.string({ minLength: 1, maxLength: 200 }),
              currentStock: fc.integer({ min: 0, max: 100 }),
              priority: fc.constantFrom('MEDIUM', 'HIGH', 'URGENT'),
              message: fc.string({ minLength: 1, maxLength: 500 })
            }),
            // Negative stock
            fc.record({
              type: fc.constant('LOW_STOCK'),
              productId: objectIdArb,
              productName: fc.string({ minLength: 1, maxLength: 200 }),
              currentStock: fc.integer({ min: -100, max: -1 }),
              priority: fc.constantFrom('LOW', 'CRITICAL'),
              message: fc.string({ minLength: 1, maxLength: 500 })
            })
          ),
          (data) => {
            try {
              parseCreateNotificationData(data);
              // Should not reach here
              expect(true).toBe(false);
            } catch (error: any) {
              // Verify error message is descriptive
              expect(error.message).toContain('Validation failed');
              expect(error.message.length).toBeGreaterThan(20); // Descriptive message
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
