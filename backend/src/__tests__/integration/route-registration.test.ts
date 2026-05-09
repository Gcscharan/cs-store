/**
 * Route Registration Test
 * 
 * Verifies that payment verification and webhook routes are properly
 * registered in the main Express app.
 * 
 * Task: 15.1 - Wire backend routes to main app
 * Requirements: TR-003, TR-004
 */

import request from 'supertest';
import { createApp } from '../../createApp';

describe('Payment Route Registration', () => {
  let app: any;

  beforeAll(() => {
    // Create app with minimal config for route testing
    app = createApp({
      enableQueues: false,
      enableRedis: false,
      enableExternalAPIs: false,
      enableSentry: false,
      enableAuth: true,
    });
  });

  describe('Payment Verification Route', () => {
    it('should have GET /api/payments/verify/:orderId route registered', async () => {
      const response = await request(app)
        .get('/api/payments/verify/test-order-id')
        .expect((res) => {
          // Route exists if we don't get 404
          expect(res.status).not.toBe(404);
        });

      // Should get 401 (unauthorized) since we're not authenticated
      // This proves the route exists and auth middleware is applied
      expect(response.status).toBe(401);
    });

    it('should require authentication for payment verification', async () => {
      const response = await request(app)
        .get('/api/payments/verify/test-order-id');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Webhook Route', () => {
    it('should have POST /api/webhooks/razorpay route registered', async () => {
      const response = await request(app)
        .post('/api/webhooks/razorpay')
        .send({})
        .expect((res) => {
          // Route exists if we don't get 404
          expect(res.status).not.toBe(404);
        });

      // Should get 401 (invalid signature) since we're not sending valid webhook data
      // This proves the route exists and signature verification middleware is applied
      expect(response.status).toBe(401);
    });

    it('should require valid signature for webhook', async () => {
      const response = await request(app)
        .post('/api/webhooks/razorpay')
        .send({
          entity: 'event',
          event: 'payment.captured',
          payload: {},
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Route Not Found', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Route not found');
    });
  });
});
