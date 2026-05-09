/**
 * Property-based tests for Notification Serializer
 * 
 * Feature: low-stock-notification-system
 * Property 14: Round-Trip Serialization
 * Property 26: Timestamp Serialization Format
 * 
 * **Validates: Requirements 14.5, 14.6**
 */

import fc from 'fast-check';
import mongoose from 'mongoose';
import {
  serializeNotification,
  SerializedNotification
} from '../notificationSerializer';

// Helper to generate valid MongoDB ObjectId
const objectIdArb = fc.integer().map(() => new mongoose.Types.ObjectId());

// Generator for valid notification data
const notificationArb = fc.record({
  _id: objectIdArb,
  type: fc.constant('LOW_STOCK'),
  productId: objectIdArb,
  productName: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
  currentStock: fc.integer({ min: 0, max: 100 }),
  priority: fc.constantFrom('LOW', 'CRITICAL'),
  message: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
  isRead: fc.boolean(),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).filter(d => !isNaN(d.getTime())),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).filter(d => !isNaN(d.getTime()))
});

describe('Feature: low-stock-notification-system, Property 14: Round-Trip Serialization', () => {
  /**
   * **Validates: Requirement 14.6**
   * 
   * For any valid Notification_Model object, serializing to JSON and then parsing back 
   * SHALL produce an equivalent object with all semantic fields preserved.
   */
  it('should preserve all semantic fields after serialization (round-trip property)', () => {
    fc.assert(
      fc.property(notificationArb, (notification) => {
        // Serialize notification
        const serialized = serializeNotification(notification);

        // Verify all semantic fields are preserved
        expect(serialized._id).toBe(notification._id.toString());
        expect(serialized.type).toBe(notification.type);
        expect(serialized.productId).toBe(notification.productId.toString());
        expect(serialized.productName).toBe(notification.productName);
        expect(serialized.currentStock).toBe(notification.currentStock);
        expect(serialized.priority).toBe(notification.priority);
        expect(serialized.message).toBe(notification.message);
        expect(serialized.isRead).toBe(notification.isRead);
        
        // Verify timestamp is preserved (ISO 8601 format)
        expect(serialized.createdAt).toBe(notification.createdAt.toISOString());
        
        // Verify round-trip: parsing serialized timestamp produces equivalent date
        const parsedDate = new Date(serialized.createdAt);
        expect(parsedDate.getTime()).toBe(notification.createdAt.getTime());
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain semantic equivalence for edge case values', () => {
    // Generator for edge case notifications
    const edgeCaseNotificationArb = fc.record({
      _id: objectIdArb,
      type: fc.constant('LOW_STOCK'),
      productId: objectIdArb,
      productName: fc.oneof(
        fc.constant('A'), // Single character
        fc.string({ minLength: 200, maxLength: 200 }).filter(s => s.trim().length > 0), // Max length
        fc.string({ minLength: 1, maxLength: 200 }).filter(s => /[^a-zA-Z0-9]/.test(s) && s.trim().length > 0) // Special characters
      ),
      currentStock: fc.oneof(
        fc.constant(0), // Zero stock
        fc.constant(1), // Minimum positive
        fc.constant(100) // High stock
      ),
      priority: fc.constantFrom('LOW', 'CRITICAL'),
      message: fc.oneof(
        fc.constant('X'), // Single character
        fc.string({ minLength: 100, maxLength: 500 }).filter(s => s.trim().length > 0) // Long message
      ),
      isRead: fc.constantFrom(true, false),
      createdAt: fc.oneof(
        fc.constant(new Date('2020-01-01T00:00:00.000Z')), // Old date
        fc.constant(new Date()), // Current date
        fc.constant(new Date('2030-12-31T23:59:59.999Z')) // Future date
      ),
      updatedAt: fc.date()
    });

    fc.assert(
      fc.property(edgeCaseNotificationArb, (notification) => {
        const serialized = serializeNotification(notification);

        // All semantic fields must be preserved
        expect(serialized._id).toBe(notification._id.toString());
        expect(serialized.type).toBe(notification.type);
        expect(serialized.productId).toBe(notification.productId.toString());
        expect(serialized.productName).toBe(notification.productName);
        expect(serialized.currentStock).toBe(notification.currentStock);
        expect(serialized.priority).toBe(notification.priority);
        expect(serialized.message).toBe(notification.message);
        expect(serialized.isRead).toBe(notification.isRead);
        expect(serialized.createdAt).toBe(notification.createdAt.toISOString());
      }),
      { numRuns: 100 }
    );
  });

  it('should convert ObjectIds to strings consistently', () => {
    fc.assert(
      fc.property(notificationArb, (notification) => {
        const serialized = serializeNotification(notification);

        // ObjectIds must be converted to strings
        expect(typeof serialized._id).toBe('string');
        expect(typeof serialized.productId).toBe('string');
        
        // String representation must match ObjectId.toString()
        expect(serialized._id).toBe(notification._id.toString());
        expect(serialized.productId).toBe(notification.productId.toString());
        
        // String must be valid 24-character hex
        expect(serialized._id).toMatch(/^[0-9a-f]{24}$/);
        expect(serialized.productId).toMatch(/^[0-9a-f]{24}$/);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve type information after serialization', () => {
    fc.assert(
      fc.property(notificationArb, (notification) => {
        const serialized = serializeNotification(notification);

        // Type must always be LOW_STOCK
        expect(serialized.type).toBe('LOW_STOCK');
        
        // Priority must be either LOW or CRITICAL
        expect(['LOW', 'CRITICAL']).toContain(serialized.priority);
        
        // isRead must be boolean
        expect(typeof serialized.isRead).toBe('boolean');
        
        // currentStock must be number
        expect(typeof serialized.currentStock).toBe('number');
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: low-stock-notification-system, Property 26: Timestamp Serialization Format', () => {
  /**
   * **Validates: Requirement 14.5**
   * 
   * For any notification serialized to JSON, the createdAt field SHALL be formatted 
   * as an ISO 8601 timestamp string.
   */
  it('should format createdAt as ISO 8601 timestamp string', () => {
    fc.assert(
      fc.property(notificationArb, (notification) => {
        const serialized = serializeNotification(notification);

        // createdAt must be a string
        expect(typeof serialized.createdAt).toBe('string');
        
        // Must be valid ISO 8601 format
        expect(serialized.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        
        // Must be parseable back to a Date
        const parsedDate = new Date(serialized.createdAt);
        expect(parsedDate.getTime()).not.toBeNaN();
        
        // Round-trip must produce same ISO string
        expect(parsedDate.toISOString()).toBe(serialized.createdAt);
      }),
      { numRuns: 100 }
    );
  });

  it('should format timestamps consistently across different dates', () => {
    // Generator for various date scenarios
    const dateArb = fc.oneof(
      fc.constant(new Date('2020-01-01T00:00:00.000Z')), // Start of year
      fc.constant(new Date('2024-12-31T23:59:59.999Z')), // End of year
      fc.constant(new Date('2024-06-15T12:30:45.123Z')), // Mid-year with milliseconds
      fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }) // Random date
    );

    const notificationWithDateArb = fc.record({
      _id: objectIdArb,
      type: fc.constant('LOW_STOCK'),
      productId: objectIdArb,
      productName: fc.string({ minLength: 1, maxLength: 200 }),
      currentStock: fc.integer({ min: 0, max: 100 }),
      priority: fc.constantFrom('LOW', 'CRITICAL'),
      message: fc.string({ minLength: 1, maxLength: 500 }),
      isRead: fc.boolean(),
      createdAt: dateArb,
      updatedAt: dateArb
    });

    fc.assert(
      fc.property(notificationWithDateArb, (notification) => {
        const serialized = serializeNotification(notification);

        // Must be ISO 8601 format
        expect(serialized.createdAt).toBe(notification.createdAt.toISOString());
        
        // Must include timezone (Z for UTC)
        expect(serialized.createdAt).toMatch(/Z$/);
        
        // Must include milliseconds
        expect(serialized.createdAt).toMatch(/\.\d{3}Z$/);
      }),
      { numRuns: 100 }
    );
  });

  it('should preserve timestamp precision (milliseconds)', () => {
    fc.assert(
      fc.property(notificationArb, (notification) => {
        const serialized = serializeNotification(notification);

        // Parse back to Date
        const parsedDate = new Date(serialized.createdAt);
        
        // Millisecond precision must be preserved
        expect(parsedDate.getTime()).toBe(notification.createdAt.getTime());
        expect(parsedDate.getMilliseconds()).toBe(notification.createdAt.getMilliseconds());
      }),
      { numRuns: 100 }
    );
  });

  it('should always use UTC timezone (Z suffix)', () => {
    fc.assert(
      fc.property(notificationArb, (notification) => {
        const serialized = serializeNotification(notification);

        // Must end with Z (UTC timezone)
        expect(serialized.createdAt).toMatch(/Z$/);
        
        // Must not contain timezone offset like +00:00
        expect(serialized.createdAt).not.toMatch(/[+-]\d{2}:\d{2}$/);
      }),
      { numRuns: 100 }
    );
  });

  it('should format timestamps consistently regardless of input date characteristics', () => {
    // Generator for dates with specific characteristics
    const specialDateArb = fc.oneof(
      fc.constant(new Date('2024-02-29T00:00:00.000Z')), // Leap year
      fc.constant(new Date('2024-01-01T00:00:00.001Z')), // 1 millisecond
      fc.constant(new Date('2024-12-31T23:59:59.999Z')), // Last millisecond of year
      fc.constant(new Date('2024-07-04T12:00:00.000Z')), // Noon, no milliseconds
    );

    const notificationWithSpecialDateArb = fc.record({
      _id: objectIdArb,
      type: fc.constant('LOW_STOCK'),
      productId: objectIdArb,
      productName: fc.string({ minLength: 1, maxLength: 200 }),
      currentStock: fc.integer({ min: 0, max: 100 }),
      priority: fc.constantFrom('LOW', 'CRITICAL'),
      message: fc.string({ minLength: 1, maxLength: 500 }),
      isRead: fc.boolean(),
      createdAt: specialDateArb,
      updatedAt: specialDateArb
    });

    fc.assert(
      fc.property(notificationWithSpecialDateArb, (notification) => {
        const serialized = serializeNotification(notification);

        // Must always be valid ISO 8601
        expect(serialized.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        
        // Must be parseable
        const parsedDate = new Date(serialized.createdAt);
        expect(parsedDate.getTime()).toBe(notification.createdAt.getTime());
      }),
      { numRuns: 100 }
    );
  });
});
