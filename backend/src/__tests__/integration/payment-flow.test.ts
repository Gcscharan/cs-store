/**
 * Integration Tests: Backend Payment Flow (End-to-End)
 *
 * Task 15.3: Write integration tests for end-to-end flow
 *
 * Tests the complete backend payment flow from order creation through
 * Razorpay verification and webhook handling.
 *
 * Test scenarios:
 * - Create order → Open Razorpay → Poll → Verify → Success
 * - Create order → Payment fails → Show error
 * - Create order → Timeout → Show timeout message
 * - Create order → App kill → Restart → Resume polling
 * - Webhook updates order before polling completes
 *
 * Requirements: BR-001, BR-002, BR-003, BR-004, BR-005
 * **Validates: Requirements BR-001, BR-002, BR-003, BR-004, BR-005**
 *
 * NOTE: The webhook processor uses MongoDB transactions (replica-set feature).
 * In the test environment (standalone MongoDB), webhook tests verify the route
 * is reachable and signature verification works. Order state transitions that
 * would normally be driven by webhooks are simulated by directly updating the
 * Order document, which is the correct approach for unit/integration testing
 * of the verification endpoint.
 */

import request from 'supertest';
import { createApp } from '../../createApp';
import { Application } from 'express';
import mongoose from 'mongoose';
import { Order } from '../../models/Order';
import crypto from 'crypto';

// ─── App (created once for the suite) ────────────────────────────────────────

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

/** Build a valid Razorpay HMAC-SHA256 signature for a webhook payload */
function buildWebhookSignature(payload: object, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
}

/** Minimal valid order address required by the schema */
const TEST_ADDRESS = {
  label: 'Home',
  addressLine: '123 Test Street',
  city: 'Bengaluru',
  state: 'Karnataka',
  pincode: '560001',
  lat: 12.9716,
  lng: 77.5946,
};

/** Create a minimal UPI order directly in the DB */
async function createPendingUpiOrder(userId: mongoose.Types.ObjectId, overrides: object = {}) {
  return Order.create({
    userId,
    orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        name: 'Test Product',
        price: 100,
        qty: 1,
      },
    ],
    totalAmount: 100,
    paymentMethod: 'upi',
    paymentStatus: 'PENDING',
    orderStatus: 'PENDING_PAYMENT',
    razorpayOrderId: `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    address: TEST_ADDRESS,
    assignmentHistory: [],
    history: [],
    ...overrides,
  });
}

/**
 * Simulate what the webhook processor does when it successfully processes a
 * payment.captured event. In the test environment, MongoDB transactions are
 * not available (standalone), so we update the order directly.
 */
async function simulateWebhookCapture(
  orderId: mongoose.Types.ObjectId,
  razorpayPaymentId: string
) {
  await Order.updateOne(
    { _id: orderId },
    {
      $set: {
        paymentStatus: 'PAID',
        razorpayPaymentId,
        paymentVerifiedAt: new Date(),
      },
    },
    { context: { paymentStatusSource: 'WEBHOOK_PAYMENT_CAPTURED' } } as any
  );
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Backend Payment Flow – Integration Tests', () => {
  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test-webhook-secret';

  // Each test creates its own user + token because beforeEach in setup-globals.ts
  // clears all collections between tests.
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    testUser = await (global as any).createTestUser({
      name: 'Payment Flow Test User',
      role: 'customer',
    });
    authToken = await (global as any).getAuthToken(testUser);
  });

  // ─── Scenario 1: Full success flow ────────────────────────────────────────

  describe('Scenario 1: Create order → Open Razorpay → Poll → Verify → Success', () => {
    it('should return PENDING on first poll before payment is captured (BR-002)', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('PENDING');
      expect(res.body.orderId).toBeDefined();
      expect(res.body.razorpayOrderId).toBe(order.razorpayOrderId);
    });

    it('should return PAID after order is marked paid (simulating webhook capture) (BR-002)', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const razorpayPaymentId = `pay_${Date.now()}`;

      // Simulate webhook updating the order
      await simulateWebhookCapture(order._id, razorpayPaymentId);

      // Poll: should now return PAID
      const pollRes = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(pollRes.status).toBe(200);
      expect(pollRes.body.paymentStatus).toBe('PAID');
      expect(pollRes.body.razorpayPaymentId).toBe(razorpayPaymentId);
    });

    it('should return PAID on first poll when webhook processed before polling starts (BR-005)', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const razorpayPaymentId = `pay_early_${Date.now()}`;

      // Webhook arrives before any polling – simulate its effect
      await simulateWebhookCapture(order._id, razorpayPaymentId);

      // First poll should immediately return PAID
      const pollRes = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(pollRes.status).toBe(200);
      expect(pollRes.body.paymentStatus).toBe('PAID');
      expect(pollRes.body.razorpayPaymentId).toBe(razorpayPaymentId);
    });

    it('should return PAID consistently for an already-paid order (BR-002)', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      await simulateWebhookCapture(order._id, `pay_already_${Date.now()}`);

      // Poll multiple times – should always return PAID
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .get(`/api/payments/verify/${order._id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.paymentStatus).toBe('PAID');
      }
    });

    it('should include verifiedAt timestamp in PAID response (BR-002)', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      await simulateWebhookCapture(order._id, `pay_ts_${Date.now()}`);

      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('PAID');
      expect(res.body.verifiedAt).toBeDefined();
    });
  });

  // ─── Scenario 2: Payment failure ──────────────────────────────────────────

  describe('Scenario 2: Create order → Payment fails → Show error', () => {
    it('should return PENDING when polling before any payment event (BR-002)', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('PENDING');
    });

    it('should return FAILED status when order is already marked FAILED (BR-002)', async () => {
      const order = await Order.create({
        userId: testUser._id,
        orderNumber: `ORD-FAIL-${Date.now()}`,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            name: 'Test Product',
            price: 100,
            qty: 1,
          },
        ],
        totalAmount: 100,
        paymentMethod: 'upi',
        paymentStatus: 'FAILED',
        orderStatus: 'PENDING_PAYMENT',
        razorpayOrderId: `order_fail_${Date.now()}`,
        address: TEST_ADDRESS,
        assignmentHistory: [],
        history: [],
      });

      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('FAILED');
    });

    it('should return FAILED after payment failure is recorded (BR-002)', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      // Simulate payment failure (e.g. from webhook or polling)
      await Order.updateOne(
        { _id: order._id },
        { $set: { paymentStatus: 'FAILED' } }
      );

      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('FAILED');
    });
  });

  // ─── Scenario 3: Timeout ──────────────────────────────────────────────────

  describe('Scenario 3: Create order → Timeout → Show timeout message', () => {
    it('should consistently return PENDING across 20 polling attempts (BR-003)', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const MAX_ATTEMPTS = 20;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const res = await request(app)
          .get(`/api/payments/verify/${order._id}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.paymentStatus).toBe('PENDING');
        expect(res.body.orderId).toBeDefined();
      }

      // After 20 attempts the mobile app should show the timeout message.
      // The backend continues to serve PENDING – it is the client's responsibility
      // to stop polling and display the timeout UI.
    });

    it('should return consistent response shape on every poll', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const res1 = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      const res2 = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res1.body.orderId).toBe(res2.body.orderId);
      expect(res1.body.paymentStatus).toBe(res2.body.paymentStatus);
      expect(res1.body.razorpayOrderId).toBe(res2.body.razorpayOrderId);
    });
  });

  // ─── Scenario 4: App kill → Restart → Resume polling ─────────────────────

  describe('Scenario 4: Create order → App kill → Restart → Resume polling', () => {
    it('should allow resuming verification after app restart (order still PENDING) (BR-004)', async () => {
      // Step 1: Order created before app kill
      const order = await createPendingUpiOrder(testUser._id);

      // Step 2: App is killed – order ID was persisted in AsyncStorage on the device.
      //         On the backend, the order remains PENDING.

      // Step 3: App restarts and resumes polling with the stored order ID
      const resumeRes = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.paymentStatus).toBe('PENDING');
      expect(resumeRes.body.orderId).toBeDefined();
    });

    it('should return PAID on resume when payment completed during app downtime (BR-004)', async () => {
      // Step 1: Order created before app kill
      const order = await createPendingUpiOrder(testUser._id);

      // Step 2: While app was killed, user completed payment → webhook arrived and updated order
      await simulateWebhookCapture(order._id, `pay_recovery_${Date.now()}`);

      // Step 3: App restarts and polls – should immediately get PAID
      const resumeRes = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(resumeRes.status).toBe(200);
      expect(resumeRes.body.paymentStatus).toBe('PAID');
      expect(resumeRes.body.razorpayPaymentId).toBeDefined();
    });

    it('should still serve stale orders (> 1 hour old) – backend has no age restriction (BR-004)', async () => {
      const oneHourAgo = new Date(Date.now() - 3_600_001);

      const order = await Order.create({
        userId: testUser._id,
        orderNumber: `ORD-STALE-${Date.now()}`,
        items: [
          {
            productId: new mongoose.Types.ObjectId(),
            name: 'Test Product',
            price: 100,
            qty: 1,
          },
        ],
        totalAmount: 100,
        paymentMethod: 'upi',
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING_PAYMENT',
        razorpayOrderId: `order_stale_${Date.now()}`,
        address: TEST_ADDRESS,
        assignmentHistory: [],
        history: [],
        createdAt: oneHourAgo,
      });

      // Backend serves the order regardless of age
      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('PENDING');

      // Note: The mobile app is responsible for clearing stale orders from AsyncStorage.
    });
  });

  // ─── Scenario 5: Webhook updates order before polling completes ───────────

  describe('Scenario 5: Webhook updates order before polling completes', () => {
    it('should reflect PAID on next poll after webhook updates order mid-polling (BR-005)', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      // First poll – PENDING
      const poll1 = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(poll1.status).toBe(200);
      expect(poll1.body.paymentStatus).toBe('PENDING');

      // Webhook arrives between polls – simulate its effect on the order
      await simulateWebhookCapture(order._id, `pay_mid_${Date.now()}`);

      // Second poll – PAID
      const poll2 = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(poll2.status).toBe(200);
      expect(poll2.body.paymentStatus).toBe('PAID');
      expect(poll2.body.razorpayPaymentId).toBeDefined();
    });

    it('should return PAID immediately when webhook processed before first poll (BR-005)', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const razorpayPaymentId = `pay_before_poll_${Date.now()}`;

      // Webhook processed before any polling
      await simulateWebhookCapture(order._id, razorpayPaymentId);

      // First poll should immediately return PAID
      const poll1 = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(poll1.status).toBe(200);
      expect(poll1.body.paymentStatus).toBe('PAID');
      expect(poll1.body.razorpayPaymentId).toBe(razorpayPaymentId);
    });

    it('should handle idempotent duplicate webhook: order stays PAID with same payment ID (BR-005)', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const razorpayPaymentId = `pay_idem_${Date.now()}`;

      // First webhook capture
      await simulateWebhookCapture(order._id, razorpayPaymentId);

      // Duplicate webhook (Razorpay retries) – simulate idempotent update
      await simulateWebhookCapture(order._id, razorpayPaymentId);

      // Order should still be PAID with the same payment ID
      const updatedOrder = await Order.findById(order._id);
      expect(updatedOrder!.paymentStatus).toBe('PAID');
      expect(updatedOrder!.razorpayPaymentId).toBe(razorpayPaymentId);

      // Verification endpoint should return PAID
      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('PAID');
    });
  });

  // ─── Webhook Route Security ───────────────────────────────────────────────

  describe('Webhook Route Security (BR-006)', () => {
    it('should reject webhook with invalid signature', async () => {
      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', 'invalid-signature-value')
        .set('Content-Type', 'application/json')
        .send({ entity: 'event', event: 'payment.captured', payload: {} });

      expect(res.status).toBe(401);
    });

    it('should reject webhook with missing signature header', async () => {
      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .send({ entity: 'event', event: 'payment.captured', payload: {} });

      expect(res.status).toBe(401);
    });

    it('should accept webhook with valid signature (route is reachable)', async () => {
      const webhookPayload = {
        entity: 'event',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_sig_test_${Date.now()}`,
              order_id: `order_sig_test_${Date.now()}`,
              amount: 10000,
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

      const sig = buildWebhookSignature(webhookPayload, WEBHOOK_SECRET);

      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', sig)
        .set('Content-Type', 'application/json')
        .send(webhookPayload);

      // Route is reachable and signature is valid – may return 200 or 4xx/5xx
      // depending on whether the order/PaymentIntent exists, but NOT 401
      expect(res.status).not.toBe(401);
    });
  });

  // ─── Verification Endpoint Security ──────────────────────────────────────

  describe('Verification Endpoint Security (BR-006)', () => {
    it('should require authentication for payment verification endpoint', async () => {
      const orderId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/payments/verify/${orderId}`);

      expect(res.status).toBe(401);
    });

    it('should return 404 when user tries to verify another user\'s order', async () => {
      const otherUser = await (global as any).createTestUser({ role: 'customer' });
      const otherOrder = await createPendingUpiOrder(otherUser._id);

      // testUser tries to access otherUser's order
      const res = await request(app)
        .get(`/api/payments/verify/${otherOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });

    it('should return 404 for non-existent order ID', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();

      const res = await request(app)
        .get(`/api/payments/verify/${nonExistentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── Performance ──────────────────────────────────────────────────────────

  describe('Performance (NFR-001)', () => {
    it('should respond to verification poll within 500ms', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const start = Date.now();

      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should handle concurrent polling requests without errors', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const concurrentRequests = Array.from({ length: 5 }, () =>
        request(app)
          .get(`/api/payments/verify/${order._id}`)
          .set('Authorization', `Bearer ${authToken}`)
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.paymentStatus).toBe('PENDING');
      });
    });
  });
});
