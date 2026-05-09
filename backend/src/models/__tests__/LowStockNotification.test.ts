import mongoose from 'mongoose';
import fc from 'fast-check';
import LowStockNotification, { ILowStockNotification } from '../LowStockNotification';

describe('LowStockNotification Model', () => {
  describe('Schema Validation', () => {
    it('should create a valid low stock notification with all required fields', () => {
      const notificationData = {
        type: 'LOW_STOCK' as const,
        productId: new mongoose.Types.ObjectId(),
        productName: 'Test Product',
        currentStock: 5,
        priority: 'LOW' as const,
        message: 'Low stock: Test Product has only 5 left',
        isRead: false,
      };

      const notification = new LowStockNotification(notificationData);
      const validationError = notification.validateSync();

      expect(validationError).toBeUndefined();
      expect(notification.type).toBe('LOW_STOCK');
      expect(notification.productName).toBe('Test Product');
      expect(notification.currentStock).toBe(5);
      expect(notification.priority).toBe('LOW');
      expect(notification.isRead).toBe(false);
    });

    it('should default type to LOW_STOCK', () => {
      const notificationData = {
        productId: new mongoose.Types.ObjectId(),
        productName: 'Test Product',
        currentStock: 5,
        priority: 'LOW' as const,
        message: 'Low stock: Test Product has only 5 left',
      };

      const notification = new LowStockNotification(notificationData);

      expect(notification.type).toBe('LOW_STOCK');
    });

    it('should default isRead to false', () => {
      const notificationData = {
        type: 'LOW_STOCK' as const,
        productId: new mongoose.Types.ObjectId(),
        productName: 'Test Product',
        currentStock: 5,
        priority: 'LOW' as const,
        message: 'Low stock: Test Product has only 5 left',
      };

      const notification = new LowStockNotification(notificationData);

      expect(notification.isRead).toBe(false);
    });

    it('should accept CRITICAL priority', () => {
      const notificationData = {
        type: 'LOW_STOCK' as const,
        productId: new mongoose.Types.ObjectId(),
        productName: 'Test Product',
        currentStock: 2,
        priority: 'CRITICAL' as const,
        message: '🚨 CRITICAL: Test Product has only 2 left',
        isRead: false,
      };

      const notification = new LowStockNotification(notificationData);
      const validationError = notification.validateSync();

      expect(validationError).toBeUndefined();
      expect(notification.priority).toBe('CRITICAL');
    });

    it('should fail validation when required fields are missing', () => {
      const notificationData = {
        type: 'LOW_STOCK' as const,
        // Missing productId, productName, currentStock, priority, message
      };

      const notification = new LowStockNotification(notificationData);
      const validationError = notification.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors.productId).toBeDefined();
      expect(validationError?.errors.productName).toBeDefined();
      expect(validationError?.errors.currentStock).toBeDefined();
      expect(validationError?.errors.priority).toBeDefined();
      expect(validationError?.errors.message).toBeDefined();
    });

    it('should fail validation for invalid priority value', () => {
      const notificationData = {
        type: 'LOW_STOCK' as const,
        productId: new mongoose.Types.ObjectId(),
        productName: 'Test Product',
        currentStock: 5,
        priority: 'INVALID' as any,
        message: 'Low stock: Test Product has only 5 left',
        isRead: false,
      };

      const notification = new LowStockNotification(notificationData);
      const validationError = notification.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors.priority).toBeDefined();
    });

    it('should fail validation for negative stock', () => {
      const notificationData = {
        type: 'LOW_STOCK' as const,
        productId: new mongoose.Types.ObjectId(),
        productName: 'Test Product',
        currentStock: -1,
        priority: 'LOW' as const,
        message: 'Low stock: Test Product has only -1 left',
        isRead: false,
      };

      const notification = new LowStockNotification(notificationData);
      const validationError = notification.validateSync();

      expect(validationError).toBeDefined();
      expect(validationError?.errors.currentStock).toBeDefined();
    });

    it('should accept zero stock', () => {
      const notificationData = {
        type: 'LOW_STOCK' as const,
        productId: new mongoose.Types.ObjectId(),
        productName: 'Test Product',
        currentStock: 0,
        priority: 'CRITICAL' as const,
        message: '🚨 CRITICAL: Test Product has only 0 left',
        isRead: false,
      };

      const notification = new LowStockNotification(notificationData);
      const validationError = notification.validateSync();

      expect(validationError).toBeUndefined();
      expect(notification.currentStock).toBe(0);
    });
  });

  describe('TypeScript Interface', () => {
    it('should have correct TypeScript interface structure', () => {
      const notificationData: Partial<ILowStockNotification> = {
        type: 'LOW_STOCK',
        productId: new mongoose.Types.ObjectId(),
        productName: 'Test Product',
        currentStock: 5,
        priority: 'LOW',
        message: 'Low stock: Test Product has only 5 left',
        isRead: false,
      };

      // TypeScript compilation will fail if interface doesn't match
      expect(notificationData.type).toBe('LOW_STOCK');
      expect(notificationData.priority).toBe('LOW');
    });
  });

  describe('Collection Name', () => {
    it('should use lowstocknotifications collection', () => {
      expect(LowStockNotification.collection.name).toBe('lowstocknotifications');
    });
  });

  describe('Indexes', () => {
    it('should have required indexes defined', () => {
      const indexes = LowStockNotification.schema.indexes();
      
      // Check for compound index { productId: 1, isRead: 1 }
      const hasProductIdIsReadIndex = indexes.some(
        (index) =>
          JSON.stringify(index[0]) === JSON.stringify({ productId: 1, isRead: 1 })
      );
      expect(hasProductIdIsReadIndex).toBe(true);

      // Check for createdAt index
      const hasCreatedAtIndex = indexes.some(
        (index) => JSON.stringify(index[0]) === JSON.stringify({ createdAt: -1 })
      );
      expect(hasCreatedAtIndex).toBe(true);

      // Check for isRead index
      const hasIsReadIndex = indexes.some(
        (index) => JSON.stringify(index[0]) === JSON.stringify({ isRead: 1 })
      );
      expect(hasIsReadIndex).toBe(true);

      // Check for priority index
      const hasPriorityIndex = indexes.some(
        (index) => JSON.stringify(index[0]) === JSON.stringify({ priority: 1 })
      );
      expect(hasPriorityIndex).toBe(true);
    });
  });

  describe('Feature: low-stock-notification-system, Property 2: Notification Structure Invariants', () => {
    /**
     * **Validates: Requirements 2.2, 2.3, 2.5, 3.3**
     * 
     * For any created low stock notification, the notification SHALL contain all required fields 
     * (type="LOW_STOCK", productId, productName, currentStock, priority, message, isRead=false, createdAt), 
     * and all fields SHALL have valid types and values.
     */
    it('should contain all required fields with correct types and initial values for any valid notification data', () => {
      // Generator for valid MongoDB ObjectId
      const objectIdArb = fc.integer().map(() => new mongoose.Types.ObjectId());

      // Generator for valid notification data
      const validNotificationArb = fc.record({
        productId: objectIdArb,
        productName: fc.string({ minLength: 1, maxLength: 200 }).filter(s => s.trim().length > 0),
        currentStock: fc.integer({ min: 0, max: 100 }),
        priority: fc.constantFrom('LOW' as const, 'CRITICAL' as const),
        message: fc.string({ minLength: 1, maxLength: 500 }).filter(s => s.trim().length > 0),
      });

      fc.assert(
        fc.property(validNotificationArb, (notificationData) => {
          // Create notification
          const notification = new LowStockNotification(notificationData);

          // Verify all required fields are present
          expect(notification.type).toBeDefined();
          expect(notification.productId).toBeDefined();
          expect(notification.productName).toBeDefined();
          expect(notification.currentStock).toBeDefined();
          expect(notification.priority).toBeDefined();
          expect(notification.message).toBeDefined();
          expect(notification.isRead).toBeDefined();

          // Verify field types and values
          expect(notification.type).toBe('LOW_STOCK');
          expect(notification.productId).toBeInstanceOf(mongoose.Types.ObjectId);
          expect(typeof notification.productName).toBe('string');
          expect(typeof notification.currentStock).toBe('number');
          expect(['LOW', 'CRITICAL']).toContain(notification.priority);
          expect(typeof notification.message).toBe('string');
          expect(notification.isRead).toBe(false); // Initial value must be false

          // Verify value constraints
          expect(notification.currentStock).toBeGreaterThanOrEqual(0);
          expect(notification.productName.length).toBeGreaterThan(0);
          expect(notification.productName.length).toBeLessThanOrEqual(200);
          expect(notification.message.length).toBeGreaterThan(0);

          // Verify no validation errors
          const validationError = notification.validateSync();
          expect(validationError).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain structure invariants even with edge case values', () => {
      // Generator for valid MongoDB ObjectId
      const objectIdArb = fc.integer().map(() => new mongoose.Types.ObjectId());

      // Generator for edge case notification data
      const edgeCaseNotificationArb = fc.record({
        productId: objectIdArb,
        productName: fc.oneof(
          fc.constant('A'), // Single character
          fc.string({ minLength: 200, maxLength: 200 }).filter(s => s.trim().length > 0), // Max length
          fc.string({ minLength: 1, maxLength: 200 }).filter(s => /[^a-zA-Z0-9]/.test(s) && s.trim().length > 0) // Special characters
        ),
        currentStock: fc.oneof(
          fc.constant(0), // Zero stock
          fc.constant(1), // Minimum positive
          fc.constant(9), // Just below threshold
        ),
        priority: fc.constantFrom('LOW' as const, 'CRITICAL' as const),
        message: fc.oneof(
          fc.constant('X'), // Single character message
          fc.string({ minLength: 100, maxLength: 500 }).filter(s => s.trim().length > 0) // Long message
        ),
      });

      fc.assert(
        fc.property(edgeCaseNotificationArb, (notificationData) => {
          const notification = new LowStockNotification(notificationData);

          // All required fields must still be present and valid
          expect(notification.type).toBe('LOW_STOCK');
          expect(notification.productId).toBeInstanceOf(mongoose.Types.ObjectId);
          expect(typeof notification.productName).toBe('string');
          expect(typeof notification.currentStock).toBe('number');
          expect(['LOW', 'CRITICAL']).toContain(notification.priority);
          expect(typeof notification.message).toBe('string');
          expect(notification.isRead).toBe(false);

          // Validation should pass
          const validationError = notification.validateSync();
          expect(validationError).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should always default isRead to false when not explicitly set', () => {
      // Generator for valid MongoDB ObjectId
      const objectIdArb = fc.integer().map(() => new mongoose.Types.ObjectId());

      const notificationWithoutIsReadArb = fc.record({
        productId: objectIdArb,
        productName: fc.string({ minLength: 1, maxLength: 200 }),
        currentStock: fc.integer({ min: 0, max: 100 }),
        priority: fc.constantFrom('LOW' as const, 'CRITICAL' as const),
        message: fc.string({ minLength: 1, maxLength: 500 }),
        // Intentionally omit isRead
      });

      fc.assert(
        fc.property(notificationWithoutIsReadArb, (notificationData) => {
          const notification = new LowStockNotification(notificationData);

          // isRead must always default to false
          expect(notification.isRead).toBe(false);
        }),
        { numRuns: 100 }
      );
    });

    it('should always default type to LOW_STOCK when not explicitly set', () => {
      // Generator for valid MongoDB ObjectId
      const objectIdArb = fc.integer().map(() => new mongoose.Types.ObjectId());

      const notificationWithoutTypeArb = fc.record({
        productId: objectIdArb,
        productName: fc.string({ minLength: 1, maxLength: 200 }),
        currentStock: fc.integer({ min: 0, max: 100 }),
        priority: fc.constantFrom('LOW' as const, 'CRITICAL' as const),
        message: fc.string({ minLength: 1, maxLength: 500 }),
        // Intentionally omit type
      });

      fc.assert(
        fc.property(notificationWithoutTypeArb, (notificationData) => {
          const notification = new LowStockNotification(notificationData);

          // type must always default to LOW_STOCK
          expect(notification.type).toBe('LOW_STOCK');
        }),
        { numRuns: 100 }
      );
    });
  });
});
