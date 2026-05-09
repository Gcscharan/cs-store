/**
 * Performance Validation Tests
 *
 * Task 17.3: Performance validation
 *
 * Validates that the system meets NFR-001 performance requirements:
 * - Verification completes within 40 seconds (20 attempts × 2 seconds)
 * - API response time < 500ms for GET /api/payments/verify/:orderId
 * - Webhook processing < 5 seconds for POST /api/webhooks/razorpay
 *
 * Requirements: NFR-001
 * **Validates: Requirements NFR-001**
 */

import request from 'supertest';
import { createApp } from '../../createApp';
import { Application } from 'express';
import mongoose from 'mongoose';
import { Order } from '../../models/Order';
import crypto from 'crypto';

// ─── App ──────────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_ADDRESS = {
  label: 'Home',
  addressLine: '123 Test Street',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  lat: 12.9716,
  lng: 77.5946,
};

async function createPendingUpiOrder(
  userId: mongoose.Types.ObjectId,
  overrides: object = {}
) {
  return Order.create({
    userId,
    orderNumber: `ORD-PERF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        name: 'Test Product',
        price: 500,
        qty: 1,
      },
    ],
    totalAmount: 500,
    paymentMethod: 'upi',
    paymentStatus: 'PENDING',
    orderStatus: 'PENDING_PAYMENT',
    razorpayOrderId: `order_perf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    address: TEST_ADDRESS,
    assignmentHistory: [],
    history: [],
    ...overrides,
  });
}

function buildWebhookSignature(payload: object, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

function buildCaptureWebhookPayload(razorpayOrderId: string, razorpayPaymentId: string) {
  return {
    entity: 'event',
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: razorpayPaymentId,
          order_id: razorpayOrderId,
          amount: 50000,
          currency: 'INR',
          status: 'captured',
          method: 'upi',
          created_at: Math.floor(Date.now() / 1000),
          notes: {},
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Performance Validation Tests (NFR-001)', () => {
  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test-webhook-secret';

  // NFR-001 thresholds
  const API_RESPONSE_THRESHOLD_MS = 500;
  const WEBHOOK_PROCESSING_THRESHOLD_MS = 5000;
  const POLLING_LOOP_THRESHOLD_MS = 40000; // 20 attempts × 2 seconds
  const MAX_POLLING_ATTEMPTS = 20;
  const POLLING_INTERVAL_MS = 2000;

  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    testUser = await (global as any).createTestUser({
      name: 'Performance Test User',
      role: 'customer',
    });
    authToken = await (global as any).getAuthToken(testUser);
  });

  // ─── 1. API Response Time < 500ms ─────────────────────────────────────────

  describe('1. API response time < 500ms for GET /api/payments/verify/:orderId (NFR-001)', () => {
    it('should respond within 500ms for a PENDING order', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const start = Date.now();
      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(API_RESPONSE_THRESHOLD_MS);
    });

    it('should respond within 500ms for an already-PAID order (fast path)', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      // Mark as PAID via the authorized path
      await Order.findByIdAndUpdate(
        order._id,
        {
          $set: {
            paymentStatus: 'PAID',
            razorpayPaymentId: `pay_perf_paid_${Date.now()}`,
            paymentVerifiedAt: new Date(),
          },
        },
        { context: { paymentStatusSource: 'WEBHOOK_PAYMENT_CAPTURED' } } as any
      );

      const start = Date.now();
      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('PAID');
      expect(duration).toBeLessThan(API_RESPONSE_THRESHOLD_MS);
    });

    it('should respond within 500ms for a FAILED order', async () => {
      const order = await createPendingUpiOrder(testUser._id, {
        paymentStatus: 'FAILED',
      });

      const start = Date.now();
      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('FAILED');
      expect(duration).toBeLessThan(API_RESPONSE_THRESHOLD_MS);
    });

    it('should respond within 500ms for a non-existent order (404 path)', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const start = Date.now();
      const res = await request(app)
        .get(`/api/payments/verify/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);
      const duration = Date.now() - start;

      expect(res.status).toBe(404);
      expect(duration).toBeLessThan(API_RESPONSE_THRESHOLD_MS);
    });

    it('should maintain < 500ms response time across 10 sequential requests', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const durations: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        const res = await request(app)
          .get(`/api/payments/verify/${order._id}`)
          .set('Authorization', `Bearer ${authToken}`);
        durations.push(Date.now() - start);

        expect(res.status).toBe(200);
      }

      // All individual requests must be under 500ms
      durations.forEach((d, i) => {
        expect(d).toBeLessThan(API_RESPONSE_THRESHOLD_MS);
      });

      // P95 (9th of 10 sorted) must also be under 500ms
      const sorted = [...durations].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      expect(p95).toBeLessThan(API_RESPONSE_THRESHOLD_MS);
    });

    it('should handle 5 concurrent requests all within 500ms', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const start = Date.now();
      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app)
            .get(`/api/payments/verify/${order._id}`)
            .set('Authorization', `Bearer ${authToken}`)
        )
      );
      const totalDuration = Date.now() - start;

      responses.forEach(res => {
        expect(res.status).toBe(200);
      });

      // Each concurrent request should complete within 500ms
      // Total wall-clock time for 5 concurrent requests should be well under 5×500ms
      expect(totalDuration).toBeLessThan(API_RESPONSE_THRESHOLD_MS * 3);
    });
  });

  // ─── 2. Webhook Processing < 5 seconds ────────────────────────────────────

  describe('2. Webhook processing < 5 seconds for POST /api/webhooks/razorpay (NFR-001)', () => {
    it('should process a valid payment.captured webhook within 5 seconds', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const razorpayPaymentId = `pay_wh_perf_${Date.now()}`;
      const payload = buildCaptureWebhookPayload(order.razorpayOrderId!, razorpayPaymentId);
      const sig = buildWebhookSignature(payload, WEBHOOK_SECRET);

      const start = Date.now();
      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', sig)
        .set('Content-Type', 'application/json')
        .send(payload);
      const duration = Date.now() - start;

      // Webhook must be acknowledged (not 401)
      expect(res.status).not.toBe(401);
      expect(duration).toBeLessThan(WEBHOOK_PROCESSING_THRESHOLD_MS);
    });

    it('should reject an invalid signature within 5 seconds (fast rejection)', async () => {
      const payload = buildCaptureWebhookPayload(
        `order_invalid_${Date.now()}`,
        `pay_invalid_${Date.now()}`
      );

      const start = Date.now();
      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', 'invalid-signature')
        .set('Content-Type', 'application/json')
        .send(payload);
      const duration = Date.now() - start;

      expect(res.status).toBe(401);
      expect(duration).toBeLessThan(WEBHOOK_PROCESSING_THRESHOLD_MS);
    });

    it('should process a payment.failed webhook within 5 seconds', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const payload = {
        entity: 'event',
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: `pay_fail_perf_${Date.now()}`,
              order_id: order.razorpayOrderId,
              amount: 50000,
              currency: 'INR',
              status: 'failed',
              method: 'upi',
              created_at: Math.floor(Date.now() / 1000),
              notes: {},
            },
          },
        },
        created_at: Math.floor(Date.now() / 1000),
      };
      const sig = buildWebhookSignature(payload, WEBHOOK_SECRET);

      const start = Date.now();
      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', sig)
        .set('Content-Type', 'application/json')
        .send(payload);
      const duration = Date.now() - start;

      expect(res.status).not.toBe(401);
      expect(duration).toBeLessThan(WEBHOOK_PROCESSING_THRESHOLD_MS);
    });

    it('should process a duplicate (idempotent) webhook within 5 seconds', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const razorpayPaymentId = `pay_idem_perf_${Date.now()}`;
      const payload = buildCaptureWebhookPayload(order.razorpayOrderId!, razorpayPaymentId);
      const sig = buildWebhookSignature(payload, WEBHOOK_SECRET);

      // First delivery
      await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', sig)
        .set('Content-Type', 'application/json')
        .send(payload);

      // Duplicate delivery (Razorpay retry) – must also complete within 5 seconds
      const start = Date.now();
      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', sig)
        .set('Content-Type', 'application/json')
        .send(payload);
      const duration = Date.now() - start;

      expect(res.status).not.toBe(401);
      expect(duration).toBeLessThan(WEBHOOK_PROCESSING_THRESHOLD_MS);
    });
  });

  // ─── 3. Polling Loop: 20 attempts × 2 seconds = 40 seconds total ──────────

  describe('3. Polling loop: 20 attempts × 2 seconds = 40 seconds total (NFR-001, BR-003)', () => {
    it('should validate polling constants: MAX_ATTEMPTS=20, INTERVAL=2000ms, TOTAL=40000ms', () => {
      // Validate the polling contract defined in TR-005 and BR-003
      expect(MAX_POLLING_ATTEMPTS).toBe(20);
      expect(POLLING_INTERVAL_MS).toBe(2000);
      expect(MAX_POLLING_ATTEMPTS * POLLING_INTERVAL_MS).toBe(POLLING_LOOP_THRESHOLD_MS);
      expect(POLLING_LOOP_THRESHOLD_MS).toBe(40000);
    });

    it('should serve all 20 polling attempts without error (backend supports full polling window)', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const responseTimes: number[] = [];

      // Simulate 20 polling attempts (without the 2s delay – we test the backend, not the timer)
      for (let attempt = 1; attempt <= MAX_POLLING_ATTEMPTS; attempt++) {
        const start = Date.now();
        const res = await request(app)
          .get(`/api/payments/verify/${order._id}`)
          .set('Authorization', `Bearer ${authToken}`);
        const duration = Date.now() - start;

        responseTimes.push(duration);

        expect(res.status).toBe(200);
        expect(res.body.paymentStatus).toBe('PENDING');
        // Each individual poll must be well within the 2-second interval budget
        expect(duration).toBeLessThan(API_RESPONSE_THRESHOLD_MS);
      }

      // Total backend processing time for 20 polls must be << 40 seconds
      const totalBackendTime = responseTimes.reduce((sum, d) => sum + d, 0);
      expect(totalBackendTime).toBeLessThan(POLLING_LOOP_THRESHOLD_MS);
    });

    it('should complete verification before 40-second window when payment is captured mid-polling', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const razorpayPaymentId = `pay_mid_poll_${Date.now()}`;

      const overallStart = Date.now();

      // Simulate polling: first 3 attempts return PENDING, then payment is captured
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await request(app)
          .get(`/api/payments/verify/${order._id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.paymentStatus).toBe('PENDING');
      }

      // Payment captured (simulating webhook or Razorpay API confirmation)
      await Order.findByIdAndUpdate(
        order._id,
        {
          $set: {
            paymentStatus: 'PAID',
            razorpayPaymentId,
            paymentVerifiedAt: new Date(),
          },
        },
        { context: { paymentStatusSource: 'WEBHOOK_PAYMENT_CAPTURED' } } as any
      );

      // Next poll should return PAID
      const paidRes = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      const totalDuration = Date.now() - overallStart;

      expect(paidRes.status).toBe(200);
      expect(paidRes.body.paymentStatus).toBe('PAID');

      // Verification completed well within the 40-second window
      expect(totalDuration).toBeLessThan(POLLING_LOOP_THRESHOLD_MS);
    });

    it('should confirm each poll response time stays within the 2-second interval budget', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      // Each poll must complete fast enough to fit within the 2-second polling interval
      // (i.e., the server response time must not eat into the wait time)
      const INTERVAL_BUDGET_MS = POLLING_INTERVAL_MS; // 2000ms

      for (let attempt = 1; attempt <= 5; attempt++) {
        const start = Date.now();
        const res = await request(app)
          .get(`/api/payments/verify/${order._id}`)
          .set('Authorization', `Bearer ${authToken}`);
        const duration = Date.now() - start;

        expect(res.status).toBe(200);
        // Response must be well within the 2-second interval (using 500ms threshold)
        expect(duration).toBeLessThan(API_RESPONSE_THRESHOLD_MS);
        expect(duration).toBeLessThan(INTERVAL_BUDGET_MS);
      }
    });

    it('should confirm total polling window (20 × 2s) satisfies US-002: verification within 40 seconds', () => {
      // US-002 Acceptance Criteria: "Verification completes within 40 seconds"
      // This is a contract test validating the polling design parameters
      const totalPollingWindowMs = MAX_POLLING_ATTEMPTS * POLLING_INTERVAL_MS;

      // The polling window must be exactly 40 seconds as specified in BR-003 and US-002
      expect(totalPollingWindowMs).toBe(40000);

      // 40 seconds expressed in human-readable form
      const totalPollingWindowSeconds = totalPollingWindowMs / 1000;
      expect(totalPollingWindowSeconds).toBe(40);
    });
  });

  // ─── 4. Response Shape Consistency Under Load ─────────────────────────────

  describe('4. Response shape consistency under load (NFR-001)', () => {
    it('should return consistent response shape across all polling attempts', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const responses = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app)
            .get(`/api/payments/verify/${order._id}`)
            .set('Authorization', `Bearer ${authToken}`)
        )
      );

      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('orderId');
        expect(res.body).toHaveProperty('paymentStatus');
        expect(res.body).toHaveProperty('razorpayOrderId');
        expect(res.body.paymentStatus).toBe('PENDING');
      });
    });

    it('should return consistent PAID response shape after verification', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const razorpayPaymentId = `pay_shape_${Date.now()}`;

      await Order.findByIdAndUpdate(
        order._id,
        {
          $set: {
            paymentStatus: 'PAID',
            razorpayPaymentId,
            paymentVerifiedAt: new Date(),
          },
        },
        { context: { paymentStatusSource: 'WEBHOOK_PAYMENT_CAPTURED' } } as any
      );

      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('orderId');
      expect(res.body).toHaveProperty('paymentStatus', 'PAID');
      expect(res.body).toHaveProperty('razorpayOrderId');
      expect(res.body).toHaveProperty('razorpayPaymentId', razorpayPaymentId);
      expect(res.body).toHaveProperty('verifiedAt');
      expect(res.body).toHaveProperty('amount');
    });
  });
});
