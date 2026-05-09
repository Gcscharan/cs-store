import mongoose from 'mongoose';
import fc from 'fast-check';
import DeviceToken, { IDeviceToken } from '../DeviceToken';

describe('DeviceToken Model - Property Tests', () => {
  describe('Feature: low-stock-notification-system, Property 19: Device Token Registration Data Completeness', () => {
    /**
     * **Validates: Requirements 16.4, 16.5**
     * 
     * For any device token registration, all required fields (adminId, deviceToken, platform, lastActiveAt) 
     * SHALL be stored correctly with valid types and values.
     */
    it('should store all required fields with correct types and values for any valid device token registration', () => {
      // Generator for valid MongoDB ObjectId
      const objectIdArb = fc.integer().map(() => new mongoose.Types.ObjectId());

      // Generator for valid Expo push token format
      const expoPushTokenArb = fc.oneof(
        fc.string({ minLength: 20, maxLength: 100 }).map(s => `ExponentPushToken[${s}]`),
        fc.string({ minLength: 20, maxLength: 100 }) // Generic token format
      );

      // Generator for valid device token registration data
      const validDeviceTokenArb = fc.record({
        adminId: objectIdArb,
        deviceToken: expoPushTokenArb,
        platform: fc.constantFrom('ios' as const, 'android' as const),
        lastActiveAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
      });

      fc.assert(
        fc.property(validDeviceTokenArb, (tokenData) => {
          // Create device token
          const deviceToken = new DeviceToken(tokenData);

          // Verify all required fields are present
          expect(deviceToken.adminId).toBeDefined();
          expect(deviceToken.deviceToken).toBeDefined();
          expect(deviceToken.platform).toBeDefined();
          expect(deviceToken.lastActiveAt).toBeDefined();

          // Verify field types
          expect(deviceToken.adminId).toBeInstanceOf(mongoose.Types.ObjectId);
          expect(typeof deviceToken.deviceToken).toBe('string');
          expect(typeof deviceToken.platform).toBe('string');
          expect(deviceToken.lastActiveAt).toBeInstanceOf(Date);

          // Verify field values
          expect(['ios', 'android']).toContain(deviceToken.platform);
          expect(deviceToken.deviceToken.length).toBeGreaterThan(0);
          expect(deviceToken.lastActiveAt.getTime()).not.toBeNaN();

          // Verify no validation errors
          const validationError = deviceToken.validateSync();
          expect(validationError).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should maintain data completeness with edge case values', () => {
      // Generator for valid MongoDB ObjectId
      const objectIdArb = fc.integer().map(() => new mongoose.Types.ObjectId());

      // Generator for edge case device token data
      const edgeCaseDeviceTokenArb = fc.record({
        adminId: objectIdArb,
        deviceToken: fc.oneof(
          fc.constant('ExponentPushToken[a]'), // Minimal token
          fc.string({ minLength: 100, maxLength: 100 }), // Long token
          fc.string({ minLength: 20, maxLength: 50 }).map(s => `ExponentPushToken[${s}]`) // Standard format
        ),
        platform: fc.constantFrom('ios' as const, 'android' as const),
        lastActiveAt: fc.oneof(
          fc.constant(new Date('2020-01-01')), // Old date
          fc.constant(new Date()), // Current date
          fc.constant(new Date('2030-12-31')) // Future date
        ),
      });

      fc.assert(
        fc.property(edgeCaseDeviceTokenArb, (tokenData) => {
          const deviceToken = new DeviceToken(tokenData);

          // All required fields must still be present and valid
          expect(deviceToken.adminId).toBeInstanceOf(mongoose.Types.ObjectId);
          expect(typeof deviceToken.deviceToken).toBe('string');
          expect(['ios', 'android']).toContain(deviceToken.platform);
          expect(deviceToken.lastActiveAt).toBeInstanceOf(Date);
          expect(deviceToken.lastActiveAt.getTime()).not.toBeNaN();

          // Validation should pass
          const validationError = deviceToken.validateSync();
          expect(validationError).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should default lastActiveAt to current time when not explicitly set', () => {
      // Generator for valid MongoDB ObjectId
      const objectIdArb = fc.integer().map(() => new mongoose.Types.ObjectId());

      const deviceTokenWithoutLastActiveArb = fc.record({
        adminId: objectIdArb,
        deviceToken: fc.string({ minLength: 20, maxLength: 100 }),
        platform: fc.constantFrom('ios' as const, 'android' as const),
        // Intentionally omit lastActiveAt
      });

      fc.assert(
        fc.property(deviceTokenWithoutLastActiveArb, (tokenData) => {
          const beforeCreation = new Date();
          const deviceToken = new DeviceToken(tokenData);
          const afterCreation = new Date();

          // lastActiveAt must be set to current time (within reasonable bounds)
          expect(deviceToken.lastActiveAt).toBeDefined();
          expect(deviceToken.lastActiveAt).toBeInstanceOf(Date);
          expect(deviceToken.lastActiveAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime() - 1000);
          expect(deviceToken.lastActiveAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime() + 1000);
        }),
        { numRuns: 100 }
      );
    });

    it('should have timestamps enabled in schema configuration', () => {
      // Generator for valid MongoDB ObjectId
      const objectIdArb = fc.integer().map(() => new mongoose.Types.ObjectId());

      const deviceTokenArb = fc.record({
        adminId: objectIdArb,
        deviceToken: fc.string({ minLength: 20, maxLength: 100 }),
        platform: fc.constantFrom('ios' as const, 'android' as const),
      });

      fc.assert(
        fc.property(deviceTokenArb, (tokenData) => {
          const deviceToken = new DeviceToken(tokenData);

          // Verify schema has timestamps enabled
          const schemaOptions = DeviceToken.schema.options;
          expect(schemaOptions.timestamps).toBe(true);

          // Verify the schema includes createdAt and updatedAt paths
          expect(DeviceToken.schema.path('createdAt')).toBeDefined();
          expect(DeviceToken.schema.path('updatedAt')).toBeDefined();
        }),
        { numRuns: 100 }
      );
    });

    it('should validate platform field to be either ios or android', () => {
      // Generator for valid MongoDB ObjectId
      const objectIdArb = fc.integer().map(() => new mongoose.Types.ObjectId());

      const deviceTokenArb = fc.record({
        adminId: objectIdArb,
        deviceToken: fc.string({ minLength: 20, maxLength: 100 }),
        platform: fc.constantFrom('ios' as const, 'android' as const),
      });

      fc.assert(
        fc.property(deviceTokenArb, (tokenData) => {
          const deviceToken = new DeviceToken(tokenData);

          // Platform must be either 'ios' or 'android'
          expect(['ios', 'android']).toContain(deviceToken.platform);

          // Validation should pass
          const validationError = deviceToken.validateSync();
          expect(validationError).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    });
  });
});
