/**
 * Razorpay Client Utility Tests
 * 
 * Tests for Razorpay client initialization, error handling, and singleton pattern
 * Requirements: TR-001
 */

import Razorpay from 'razorpay';
import { logger } from '../logger';

// Mock the Razorpay SDK
jest.mock('razorpay');

// Mock logger to avoid console output during tests
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks are set up
import { getRazorpayClient, resetRazorpayClient } from '../razorpay';

describe('Razorpay Client Utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Reset singleton instance
    resetRazorpayClient();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('getRazorpayClient', () => {
    it('should initialize Razorpay client with valid credentials', () => {
      // Set up environment variables
      process.env.RAZORPAY_KEY_ID = 'rzp_test_1234567890';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret_key';

      const client = getRazorpayClient();

      expect(client).toBeDefined();
      expect(Razorpay).toHaveBeenCalledWith({
        key_id: 'rzp_test_1234567890',
        key_secret: 'test_secret_key',
      });
      expect(Razorpay).toHaveBeenCalledTimes(1);
    });

    it('should return the same instance on subsequent calls (singleton)', () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_1234567890';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret_key';

      const client1 = getRazorpayClient();
      const client2 = getRazorpayClient();

      expect(client1).toBe(client2);
      expect(Razorpay).toHaveBeenCalledTimes(1); // Only initialized once
    });

    it('should throw error when RAZORPAY_KEY_ID is missing', () => {
      process.env.RAZORPAY_KEY_SECRET = 'test_secret_key';
      delete process.env.RAZORPAY_KEY_ID;

      expect(() => getRazorpayClient()).toThrow(
        'Missing Razorpay credentials: RAZORPAY_KEY_ID'
      );
    });

    it('should throw error when RAZORPAY_KEY_SECRET is missing', () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_1234567890';
      delete process.env.RAZORPAY_KEY_SECRET;

      expect(() => getRazorpayClient()).toThrow(
        'Missing Razorpay credentials: RAZORPAY_KEY_SECRET'
      );
    });

    it('should throw error when both credentials are missing', () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;

      expect(() => getRazorpayClient()).toThrow(
        'Missing Razorpay credentials: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET'
      );
    });

    it('should detect test environment from key prefix', () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_1234567890';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret_key';

      getRazorpayClient();

      expect(logger.info).toHaveBeenCalledWith(
        '✅ Razorpay client initialized successfully',
        expect.objectContaining({
          environment: 'test',
        })
      );
    });

    it('should detect live environment from key prefix', () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_live_1234567890';
      process.env.RAZORPAY_KEY_SECRET = 'live_secret_key';

      getRazorpayClient();

      expect(logger.info).toHaveBeenCalledWith(
        '✅ Razorpay client initialized successfully',
        expect.objectContaining({
          environment: 'live',
        })
      );
    });

    it('should mask key ID in logs for security', () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_1234567890';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret_key';

      getRazorpayClient();

      expect(logger.info).toHaveBeenCalledWith(
        '✅ Razorpay client initialized successfully',
        expect.objectContaining({
          keyId: 'rzp_test...',
        })
      );
    });

    it('should handle Razorpay initialization errors', () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_1234567890';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret_key';

      // Mock Razorpay constructor to throw error
      (Razorpay as jest.MockedClass<typeof Razorpay>).mockImplementationOnce(() => {
        throw new Error('Invalid credentials');
      });

      expect(() => getRazorpayClient()).toThrow(
        'Failed to initialize Razorpay client'
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to initialize Razorpay client',
        expect.objectContaining({
          error: expect.any(Error),
        })
      );
    });
  });

  describe('resetRazorpayClient', () => {
    it('should reset singleton instance', () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_test_1234567890';
      process.env.RAZORPAY_KEY_SECRET = 'test_secret_key';

      // Create first instance
      const client1 = getRazorpayClient();
      expect(Razorpay).toHaveBeenCalledTimes(1);

      // Reset
      resetRazorpayClient();

      // Create new instance
      const client2 = getRazorpayClient();
      expect(Razorpay).toHaveBeenCalledTimes(2); // New instance created

      // Instances should be different
      expect(client1).not.toBe(client2);
    });
  });
});
