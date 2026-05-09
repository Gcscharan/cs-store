/**
 * Route Wiring Tests
 * 
 * Task 15.1: Wire backend routes to main app
 * 
 * Verifies that payment verification and webhook routes are properly
 * registered in the main Express app and are accessible.
 * 
 * Requirements: TR-003, TR-004
 */

import request from 'supertest';
import { createApp } from '../../../../createApp';
import { Application } from 'express';

describe('Payment Routes Wiring', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp({
      enableQueues: false,
      enableRedis: false,
      enableExternalAPIs: false,
      enableSentry: false,
      enableAuth: true,
    });
  });

  describe('Payment Verification Route (TR-003)', () => {
    it('should have payment verification route registered at GET /api/payments/verify/:orderId', async () => {
      // Test that the route exists (will return 401 without auth, not 404)
      const res = await request(app)
        .get('/api/payments/verify/test-order-id');

      // Route exists if we get 401 (auth required) instead of 404 (not found)
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });

    it('should reject requests without authentication', async () => {
      const res = await request(app)
        .get('/api/payments/verify/test-order-id');

      expect(res.status).toBe(401);
    });
  });

  describe('Webhook Route (TR-004)', () => {
    it('should have webhook route registered at POST /api/webhooks/razorpay', async () => {
      // Test that the route exists (will return 401 for invalid signature, not 404)
      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .send({ test: 'data' });

      // Route exists if we get 401 (signature verification failed) instead of 404
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(404);
    });

    it('should reject requests without signature header', async () => {
      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .send({ test: 'data' });

      expect(res.status).toBe(401);
    });

    it('should reject requests with invalid signature', async () => {
      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', 'invalid-signature')
        .set('Content-Type', 'application/json')
        .send({ test: 'data' });

      expect(res.status).toBe(401);
    });
  });

  describe('Route Accessibility', () => {
    it('should return 404 for non-existent payment routes', async () => {
      const res = await request(app)
        .get('/api/payments/nonexistent');

      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent webhook routes', async () => {
      const res = await request(app)
        .post('/api/webhooks/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
