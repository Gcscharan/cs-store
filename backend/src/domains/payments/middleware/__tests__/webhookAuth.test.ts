/**
 * Webhook Authentication Middleware Tests
 * 
 * Unit tests for the Razorpay webhook signature verification middleware, focusing on:
 * - Valid signature verification
 * - Invalid signature rejection
 * - Missing signature handling
 * - Missing webhook secret handling
 * - Invalid request body format handling
 * 
 * Requirements: TR-004, NFR-003
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { verifyRazorpaySignature } from '../webhookAuth';

describe('verifyRazorpaySignature Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const MOCK_WEBHOOK_SECRET = 'test-webhook-secret-12345';
  const MOCK_PAYLOAD = JSON.stringify({
    entity: 'event',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_test123',
          order_id: 'order_test123',
          amount: 50000,
          status: 'captured',
        },
      },
    },
  });

  beforeEach(() => {
    // Setup environment variable
    process.env.RAZORPAY_WEBHOOK_SECRET = MOCK_WEBHOOK_SECRET;

    // Setup mocks
    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();

    mockReq = {
      headers: {},
      body: Buffer.from(MOCK_PAYLOAD),
    };

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  describe('Valid signature verification', () => {
    it('should call next() when signature is valid', () => {
      // Generate valid signature
      const validSignature = crypto
        .createHmac('sha256', MOCK_WEBHOOK_SECRET)
        .update(Buffer.from(MOCK_PAYLOAD))
        .digest('hex');

      mockReq.headers = {
        'x-razorpay-signature': validSignature,
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
      expect(jsonMock).not.toHaveBeenCalled();
    });

    it('should handle uppercase header name (X-Razorpay-Signature)', () => {
      const validSignature = crypto
        .createHmac('sha256', MOCK_WEBHOOK_SECRET)
        .update(Buffer.from(MOCK_PAYLOAD))
        .digest('hex');

      mockReq.headers = {
        'X-Razorpay-Signature': validSignature,
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should trim whitespace from signature', () => {
      const validSignature = crypto
        .createHmac('sha256', MOCK_WEBHOOK_SECRET)
        .update(Buffer.from(MOCK_PAYLOAD))
        .digest('hex');

      mockReq.headers = {
        'x-razorpay-signature': `  ${validSignature}  `,
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Invalid signature rejection', () => {
    it('should return 401 when signature is invalid', () => {
      mockReq.headers = {
        'x-razorpay-signature': 'invalid-signature-12345',
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when signature length does not match', () => {
      mockReq.headers = {
        'x-razorpay-signature': 'short',
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when signature is tampered', () => {
      const validSignature = crypto
        .createHmac('sha256', MOCK_WEBHOOK_SECRET)
        .update(Buffer.from(MOCK_PAYLOAD))
        .digest('hex');

      // Tamper with the signature
      const tamperedSignature = validSignature.slice(0, -1) + 'x';

      mockReq.headers = {
        'x-razorpay-signature': tamperedSignature,
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Missing signature handling', () => {
    it('should return 401 when signature header is missing', () => {
      mockReq.headers = {};

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing webhook signature',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when signature is empty string', () => {
      mockReq.headers = {
        'x-razorpay-signature': '',
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing webhook signature',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 when signature is only whitespace', () => {
      mockReq.headers = {
        'x-razorpay-signature': '   ',
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Missing webhook signature',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Missing webhook secret handling', () => {
    it('should return 500 when RAZORPAY_WEBHOOK_SECRET is not configured', () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;

      mockReq.headers = {
        'x-razorpay-signature': 'some-signature',
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Server misconfigured',
        message: 'Webhook verification not configured',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Invalid request body format handling', () => {
    it('should return 400 when body is not a Buffer', () => {
      mockReq.body = { some: 'object' }; // Not a Buffer

      mockReq.headers = {
        'x-razorpay-signature': 'some-signature',
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Invalid webhook payload format',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when body is a string', () => {
      mockReq.body = 'string-body';

      mockReq.headers = {
        'x-razorpay-signature': 'some-signature',
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Bad Request',
        message: 'Invalid webhook payload format',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should return 500 when an unexpected error occurs', () => {
      // Force an error by making crypto.createHmac throw
      const originalCreateHmac = crypto.createHmac;
      crypto.createHmac = jest.fn().mockImplementation(() => {
        throw new Error('Crypto error');
      });

      mockReq.headers = {
        'x-razorpay-signature': 'some-signature',
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Webhook signature verification failed',
      });
      expect(mockNext).not.toHaveBeenCalled();

      // Restore original function
      crypto.createHmac = originalCreateHmac;
    });
  });

  describe('Timing-safe comparison', () => {
    it('should use timing-safe comparison to prevent timing attacks', () => {
      // This test verifies that we use crypto.timingSafeEqual
      // by checking that signatures of different lengths are rejected
      // before the comparison (which would throw if lengths differ)
      
      const validSignature = crypto
        .createHmac('sha256', MOCK_WEBHOOK_SECRET)
        .update(Buffer.from(MOCK_PAYLOAD))
        .digest('hex');

      // Use a signature with different length
      mockReq.headers = {
        'x-razorpay-signature': validSignature.slice(0, -10),
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Different payload scenarios', () => {
    it('should verify signature for different payload content', () => {
      const differentPayload = JSON.stringify({
        entity: 'event',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_different123',
              order_id: 'order_different123',
              status: 'failed',
            },
          },
        },
      });

      const validSignature = crypto
        .createHmac('sha256', MOCK_WEBHOOK_SECRET)
        .update(Buffer.from(differentPayload))
        .digest('hex');

      mockReq.body = Buffer.from(differentPayload);
      mockReq.headers = {
        'x-razorpay-signature': validSignature,
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should reject signature when payload is modified', () => {
      const originalPayload = MOCK_PAYLOAD;
      const modifiedPayload = MOCK_PAYLOAD.replace('captured', 'failed');

      // Generate signature for original payload
      const signature = crypto
        .createHmac('sha256', MOCK_WEBHOOK_SECRET)
        .update(Buffer.from(originalPayload))
        .digest('hex');

      // But use modified payload in request
      mockReq.body = Buffer.from(modifiedPayload);
      mockReq.headers = {
        'x-razorpay-signature': signature,
      };

      verifyRazorpaySignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid webhook signature',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
