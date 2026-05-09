import request from 'supertest';
import { createApp } from '../../../../createApp';
import { Application } from 'express';

/**
 * Integration tests for payment routes registration
 * 
 * These tests verify that the payment verification and webhook routes
 * are properly registered in the main Express app and are accessible.
 * 
 * Requirements: TR-003, TR-004
 */

describe('Payment Routes Integration', () => {
  let app: Application;

  beforeAll(() => {
    // Create app with minimal config for testing
    app = createApp({
      enableQueues: false,
      enableRedis: false,
      enableExternalAPIs: false,
      enableSentry: false,
      enableAuth: true,
    });
  });

  describe('Payment Verification Route', () => {
    it('should have payment verification route registered at GET /api/payments/verify/:orderId', async () => {
      // This should return 401 (unauthorized) not 404 (not found)
      // which proves the route exists
      const response = await request(app)
        .get('/api/payments/verify/test-order-id')
        .expect((res) => {
          // Route exists if we get 401 (auth required) or 500 (server error)
          // but NOT 404 (route not found)
          expect(res.status).not.toBe(404);
        });
    });

    it('should require authentication for payment verification', async () => {
      const response = await request(app)
        .get('/api/payments/verify/test-order-id');
      
      // Should return 401 Unauthorized (not 404 Not Found)
      expect(response.status).toBe(401);
    });
  });

  describe('Webhook Route', () => {
    it('should have webhook route registered at POST /api/webhooks/razorpay', async () => {
      // This should return 401 (invalid signature) not 404 (not found)
      // which proves the route exists
      const response = await request(app)
        .post('/api/webhooks/razorpay')
        .send({
          entity: 'event',
          event: 'payment.captured',
          payload: {},
        })
        .expect((res) => {
          // Route exists if we get 400/401 (signature issue) or 500 (server error)
          // but NOT 404 (route not found)
          expect(res.status).not.toBe(404);
        });
    });

    it('should require valid signature for webhook', async () => {
      const response = await request(app)
        .post('/api/webhooks/razorpay')
        .send({
          entity: 'event',
          event: 'payment.captured',
          payload: {},
        });
      
      // Should return 401 Unauthorized due to missing/invalid signature
      // (not 404 Not Found)
      expect(response.status).toBe(401);
    });
  });

  describe('Route Accessibility', () => {
    it('should return 404 for non-existent payment routes', async () => {
      const response = await request(app)
        .get('/api/payments/nonexistent');
      
      expect(response.status).toBe(404);
    });

    it('should return 404 for non-existent webhook routes', async () => {
      const response = await request(app)
        .post('/api/webhooks/nonexistent');
      
      expect(response.status).toBe(404);
    });
  });
});
