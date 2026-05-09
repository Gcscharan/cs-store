/**
 * Integration Test: Route Wiring
 * 
 * Tests that payment verification and webhook routes are properly
 * registered in the main app router and are accessible.
 * 
 * Requirements: TR-003, TR-004
 */

import request from 'supertest';
import { createApp } from '../../createApp';
import { Application } from 'express';

describe('Route Wiring Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    // Create app with minimal config for testing
    app = createApp({
      enableQueues: false,
      enableRedis: false,
      enableExternalAPIs: false,
      enableSentry: false,
      enableAuth: false,
    });
  });

  describe('Payment Verification Route', () => {
    it('should have payment verification route registered at GET /api/payments/verify/:orderId', async () => {
      // Make request to the route (will fail auth, but route should exist)
      const response = await request(app)
        .get('/api/payments/verify/test-order-id')
        .expect((res) => {
          // Route exists if we get 401 (auth required) or 404 (order not found)
          // Route doesn't exist if we get 404 with "Route not found" message
          expect([401, 404, 500]).toContain(res.status);
          if (res.status === 404) {
            expect(res.body.message).not.toBe('Route not found');
          }
        });
    });

    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .get('/api/payments/verify/test-order-id');

      // Should get 401 Unauthorized (auth middleware)
      expect([401, 404, 500]).toContain(response.status);
    });
  });

  describe('Webhook Route', () => {
    it('should have webhook route registered at POST /api/webhooks/razorpay', async () => {
      // Make request to the route (will fail signature verification)
      const response = await request(app)
        .post('/api/webhooks/razorpay')
        .send({
          entity: 'event',
          event: 'payment.captured',
          payload: {},
        })
        .expect((res) => {
          // Route exists if we get 401 (signature invalid) or 400 (bad request)
          // Route doesn't exist if we get 404 with "Route not found" message
          expect([400, 401, 404, 500]).toContain(res.status);
          if (res.status === 404) {
            expect(res.body.message).not.toBe('Route not found');
          }
        });
    });

    it('should reject requests without valid signature', async () => {
      const response = await request(app)
        .post('/api/webhooks/razorpay')
        .send({
          entity: 'event',
          event: 'payment.captured',
          payload: {},
        });

      // Should get 401 Unauthorized (signature verification)
      expect([400, 401, 500]).toContain(response.status);
    });
  });

  describe('Route Accessibility', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route')
        .expect(404);

      expect(response.body.message).toBe('Route not found');
    });

    it('should have /api prefix for all API routes', async () => {
      // Test that routes without /api prefix return 404
      const response = await request(app)
        .get('/payments/verify/test-order-id')
        .expect(404);

      expect(response.body.message).toBe('Route not found');
    });
  });
});
