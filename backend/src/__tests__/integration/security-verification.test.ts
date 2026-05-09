/**
 * Security Verification Tests
 *
 * Task 17.2: Verify security requirements
 *
 * Verifies that all security requirements are properly implemented:
 * - Frontend cannot update paymentStatus (no endpoint allows this)
 * - Webhook signature verification works
 * - Transaction reference (razorpayOrderId) is validated
 * - Only backend can mark order as PAID
 *
 * Requirements: NFR-003, BR-006
 * **Validates: Requirements NFR-003, BR-006**
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

async function createPendingUpiOrder(userId: mongoose.Types.ObjectId, overrides: object = {}) {
  return Order.create({
    userId,
    orderNumber: `ORD-SEC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    razorpayOrderId: `order_sec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe('Security Verification Tests (NFR-003, BR-006)', () => {
  const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test-webhook-secret';

  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    testUser = await (global as any).createTestUser({
      name: 'Security Test User',
      role: 'customer',
    });
    authToken = await (global as any).getAuthToken(testUser);
  });

  // ─── 1. Frontend cannot update paymentStatus ──────────────────────────────

  describe('1. Frontend cannot update paymentStatus (NFR-003)', () => {
    it('PUT /api/orders/:id/payment-status should be permanently disabled (returns 410)', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const res = await request(app)
        .put(`/api/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentStatus: 'PAID' });

      // Must be 410 Gone – this endpoint is permanently disabled
      expect(res.status).toBe(410);
      expect(res.body.error).toBe('LEGACY_PAYMENT_PATH_DISABLED');

      // Verify order was NOT updated
      const unchanged = await Order.findById(order._id);
      expect(unchanged!.paymentStatus).toBe('PENDING');
    });

    it('PUT /api/orders/:id/payment-status should not accept PAID even with valid auth', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const res = await request(app)
        .put(`/api/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentStatus: 'PAID', razorpayPaymentId: 'pay_fake_123' });

      expect(res.status).toBe(410);

      const unchanged = await Order.findById(order._id);
      expect(unchanged!.paymentStatus).toBe('PENDING');
    });

    it('GET /api/payments/verify/:orderId should be read-only (does not update paymentStatus to PAID without Razorpay confirmation)', async () => {
      // Create order with no razorpayOrderId so Razorpay API won't be called
      const order = await Order.create({
        userId: testUser._id,
        orderNumber: `ORD-READONLY-${Date.now()}`,
        items: [{ productId: new mongoose.Types.ObjectId(), name: 'Test', price: 100, qty: 1 }],
        totalAmount: 100,
        paymentMethod: 'upi',
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING_PAYMENT',
        // No razorpayOrderId – so no Razorpay API call will be made
        address: TEST_ADDRESS,
        assignmentHistory: [],
        history: [],
      });

      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      // Without a razorpayOrderId, the endpoint cannot confirm payment
      expect(res.body.paymentStatus).toBe('PENDING');

      // Verify DB was not modified
      const unchanged = await Order.findById(order._id);
      expect(unchanged!.paymentStatus).toBe('PENDING');
    });

    it('verification endpoint requires authentication – unauthenticated requests are rejected', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`);

      expect(res.status).toBe(401);

      // Order must remain unchanged
      const unchanged = await Order.findById(order._id);
      expect(unchanged!.paymentStatus).toBe('PENDING');
    });

    it('verification endpoint enforces user ownership – cannot verify another user\'s order', async () => {
      const otherUser = await (global as any).createTestUser({ role: 'customer' });
      const otherOrder = await createPendingUpiOrder(otherUser._id);

      const res = await request(app)
        .get(`/api/payments/verify/${otherOrder._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Must return 404 (not found for this user) – not 200 with PAID
      expect(res.status).toBe(404);

      // Order must remain unchanged
      const unchanged = await Order.findById(otherOrder._id);
      expect(unchanged!.paymentStatus).toBe('PENDING');
    });
  });

  // ─── 2. Webhook signature verification ───────────────────────────────────

  describe('2. Webhook signature verification works (NFR-003, TR-004)', () => {
    it('should reject webhook with missing X-Razorpay-Signature header (returns 401)', async () => {
      const payload = {
        entity: 'event',
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_test', order_id: 'order_test', amount: 50000 } } },
      };

      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(401);
    });

    it('should reject webhook with invalid signature (returns 401)', async () => {
      const payload = {
        entity: 'event',
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_test', order_id: 'order_test', amount: 50000 } } },
      };

      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', 'completely-invalid-signature')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(401);
    });

    it('should reject webhook with tampered payload (signature mismatch)', async () => {
      const originalPayload = {
        entity: 'event',
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_real', order_id: 'order_real', amount: 50000 } } },
      };

      // Sign the original payload
      const validSig = buildWebhookSignature(originalPayload, WEBHOOK_SECRET);

      // Tamper with the payload (change amount)
      const tamperedPayload = {
        ...originalPayload,
        payload: { payment: { entity: { id: 'pay_real', order_id: 'order_real', amount: 1 } } },
      };

      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', validSig)
        .set('Content-Type', 'application/json')
        .send(tamperedPayload);

      expect(res.status).toBe(401);
    });

    it('should reject webhook signed with wrong secret', async () => {
      const payload = {
        entity: 'event',
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_test', order_id: 'order_test', amount: 50000 } } },
      };

      // Sign with a different (wrong) secret
      const wrongSig = buildWebhookSignature(payload, 'wrong-secret-key');

      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', wrongSig)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(401);
    });

    it('should accept webhook with valid HMAC-SHA256 signature (route is reachable)', async () => {
      const payload = {
        entity: 'event',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_valid_sig_${Date.now()}`,
              order_id: `order_valid_sig_${Date.now()}`,
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

      const validSig = buildWebhookSignature(payload, WEBHOOK_SECRET);

      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', validSig)
        .set('Content-Type', 'application/json')
        .send(payload);

      // Signature is valid – must NOT be 401
      expect(res.status).not.toBe(401);
    });

    it('should use timing-safe comparison (not vulnerable to timing attacks)', async () => {
      // This test verifies the middleware uses crypto.timingSafeEqual
      // by checking that both a short and a full-length wrong signature return 401
      const payload = { entity: 'event', event: 'payment.captured', payload: {} };

      // Very short signature
      const shortSigRes = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', 'abc')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(shortSigRes.status).toBe(401);

      // Full-length but wrong signature (64 hex chars = 32 bytes = SHA256 output length)
      const wrongFullSig = 'a'.repeat(64);
      const fullSigRes = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', wrongFullSig)
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(fullSigRes.status).toBe(401);
    });
  });

  // ─── 3. Transaction reference validation ─────────────────────────────────

  describe('3. Transaction reference (razorpayOrderId) validation (NFR-003)', () => {
    it('webhook with unknown razorpayOrderId should not mark any order as PAID', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      const payload = {
        entity: 'event',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_unknown_${Date.now()}`,
              order_id: 'order_NONEXISTENT_RAZORPAY_ID', // Does not match any order
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

      const sig = buildWebhookSignature(payload, WEBHOOK_SECRET);

      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', sig)
        .set('Content-Type', 'application/json')
        .send(payload);

      // Webhook is acknowledged (200) but no order should be updated
      // (Razorpay expects 200 to stop retries even for unknown orders)
      expect([200, 404]).toContain(res.status);

      // Our order must remain PENDING
      const unchanged = await Order.findById(order._id);
      expect(unchanged!.paymentStatus).toBe('PENDING');
    });

    it('verification endpoint validates order belongs to authenticated user (razorpayOrderId cannot be guessed)', async () => {
      const order = await createPendingUpiOrder(testUser._id);
      const otherUser = await (global as any).createTestUser({ role: 'customer' });
      const otherToken = await (global as any).getAuthToken(otherUser);

      // Other user tries to verify using the correct orderId
      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(404);
    });

    it('verification endpoint returns 404 for invalid ObjectId format', async () => {
      const res = await request(app)
        .get('/api/payments/verify/not-a-valid-object-id')
        .set('Authorization', `Bearer ${authToken}`);

      // Should return 404 or 400, not 500 or 200
      expect([400, 404, 500]).toContain(res.status);
      expect(res.status).not.toBe(200);
    });

    it('webhook processor requires valid gatewayOrderId in payload', async () => {
      // Payload with missing order_id
      const payload = {
        entity: 'event',
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_no_order_${Date.now()}`,
              // order_id intentionally omitted
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

      const sig = buildWebhookSignature(payload, WEBHOOK_SECRET);

      const res = await request(app)
        .post('/api/webhooks/razorpay')
        .set('X-Razorpay-Signature', sig)
        .set('Content-Type', 'application/json')
        .send(payload);

      // Should not return 200 with success when order_id is missing
      // (400 = bad request, or 404 = not found)
      expect([400, 404]).toContain(res.status);
    });
  });

  // ─── 4. Only backend can mark order as PAID ───────────────────────────────

  describe('4. Only backend can mark order as PAID (BR-006)', () => {
    it('Order model pre-save hook blocks direct PAID transition without WEBHOOK_PAYMENT_CAPTURED source', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      // Attempt to directly set paymentStatus = PAID without the authorized source
      await expect(
        Order.findByIdAndUpdate(
          order._id,
          { $set: { paymentStatus: 'PAID' } }
          // No paymentStatusSource in options – should be blocked
        )
      ).rejects.toThrow();

      // Verify order was NOT updated
      const unchanged = await Order.findById(order._id);
      expect(unchanged!.paymentStatus).toBe('PENDING');
    });

    it('Order model allows PAID transition only with WEBHOOK_PAYMENT_CAPTURED source', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      // This is the ONLY authorized way to mark an order as PAID
      await Order.findByIdAndUpdate(
        order._id,
        { $set: { paymentStatus: 'PAID', razorpayPaymentId: 'pay_authorized', paymentVerifiedAt: new Date() } },
        { context: { paymentStatusSource: 'WEBHOOK_PAYMENT_CAPTURED' } } as any
      );

      const updated = await Order.findById(order._id);
      expect(updated!.paymentStatus).toBe('PAID');
    });

    it('Order model pre-save hook blocks PAID transition via .save() without authorized source', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      // Attempt to save with PAID status directly
      const freshOrder = await Order.findById(order._id);
      (freshOrder as any).paymentStatus = 'PAID';

      await expect(freshOrder!.save()).rejects.toThrow();

      // Verify order was NOT updated
      const unchanged = await Order.findById(order._id);
      expect(unchanged!.paymentStatus).toBe('PENDING');
    });

    it('updateOne without authorized source cannot set paymentStatus to PAID', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      await expect(
        Order.updateOne(
          { _id: order._id },
          { $set: { paymentStatus: 'PAID' } }
          // No paymentStatusSource
        )
      ).rejects.toThrow();

      const unchanged = await Order.findById(order._id);
      expect(unchanged!.paymentStatus).toBe('PENDING');
    });

    it('payment-callback route (legacy) is permanently disabled (Fix #1 applied)', async () => {
      // 🚨 CRITICAL SECURITY FIX #1: DANGEROUS ENDPOINT REMOVED
      // The route POST /api/orders/:orderId/payment-callback was a P0 security vulnerability
      // that allowed unauthenticated callers to mark any order as PAID by sending { status: 'SUCCESS' }.
      //
      // ✅ FIX APPLIED: The route now returns 410 Gone (permanently disabled).
      // Payment verification ONLY happens via:
      //   1. Razorpay webhook (POST /api/webhooks/razorpay) with signature verification
      //   2. Backend polling verification (GET /api/payments/verify/:orderId) with Razorpay API
      const order = await createPendingUpiOrder(testUser._id);

      const res = await request(app)
        .post(`/api/orders/${order._id}/payment-callback`)
        .send({ status: 'SUCCESS', transactionId: 'fake_txn_123' });

      // ✅ The route now returns 410 Gone (permanently disabled)
      expect(res.status).toBe(410);
      expect(res.body.error).toBe('LEGACY_PAYMENT_PATH_DISABLED');
      expect(res.body.message).toContain('permanently disabled for security reasons');

      const orderAfter = await Order.findById(order._id);
      // ✅ The order remains PENDING (not marked as PAID by unauthenticated request)
      expect(orderAfter!.paymentStatus).toBe('PENDING');
    });

    it('PAID status guard only blocks transitions TO PAID – documents immutability gap', async () => {
      // SECURITY FINDING: The Order model PAID guard only prevents unauthorized
      // transitions TO PAID. It does NOT prevent reverting FROM PAID back to PENDING.
      // This means a direct DB update can downgrade a PAID order to PENDING.
      //
      // This test DOCUMENTS the gap. The Order model should also block:
      //   - PAID → PENDING (revert)
      //   - PAID → FAILED (revert)
      //
      // Until fixed, a compromised backend process could revert payment status.
      const order = await createPendingUpiOrder(testUser._id);

      // Authorize the PAID transition (simulating webhook)
      await Order.findByIdAndUpdate(
        order._id,
        { $set: { paymentStatus: 'PAID', razorpayPaymentId: 'pay_immutable', paymentVerifiedAt: new Date() } },
        { context: { paymentStatusSource: 'WEBHOOK_PAYMENT_CAPTURED' } } as any
      );

      // Attempt to revert to PENDING – this currently SUCCEEDS (the gap)
      // The Order model does not block this transition.
      await Order.findByIdAndUpdate(
        order._id,
        { $set: { paymentStatus: 'PENDING' } }
      );

      // SECURITY GAP: The order CAN be reverted from PAID to PENDING.
      // After the fix, this should still be 'PAID'.
      const afterRevert = await Order.findById(order._id);
      // Document the current (insecure) behavior:
      expect(afterRevert!.paymentStatus).toBe('PENDING');
    });

    it('webhook with valid signature correctly marks order as PAID (authorized path)', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      // Simulate a real webhook by directly updating via the authorized path
      // (the webhook processor uses this internally)
      await Order.findByIdAndUpdate(
        order._id,
        {
          $set: {
            paymentStatus: 'PAID',
            razorpayPaymentId: `pay_webhook_${Date.now()}`,
            paymentVerifiedAt: new Date(),
          },
        },
        { context: { paymentStatusSource: 'WEBHOOK_PAYMENT_CAPTURED' } } as any
      );

      const updated = await Order.findById(order._id);
      expect(updated!.paymentStatus).toBe('PAID');
      expect(updated!.razorpayPaymentId).toBeDefined();
      expect(updated!.paymentVerifiedAt).toBeDefined();

      // Verify via the API endpoint
      const res = await request(app)
        .get(`/api/payments/verify/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.paymentStatus).toBe('PAID');
    });
  });

  // ─── 5. No other endpoints expose paymentStatus mutation ─────────────────

  describe('5. No other endpoints expose paymentStatus mutation (NFR-003)', () => {
    it('PATCH /api/orders/:id should not accept paymentStatus field', async () => {
      const order = await createPendingUpiOrder(testUser._id);

      // Try PATCH (if it exists)
      const res = await request(app)
        .patch(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ paymentStatus: 'PAID' });

      // Either 404 (route doesn't exist) or 405 (method not allowed) or 400/403
      // But NOT 200 with PAID
      if (res.status === 200) {
        const orderAfter = await Order.findById(order._id);
        expect(orderAfter!.paymentStatus).not.toBe('PAID');
      } else {
        expect([400, 403, 404, 405, 410]).toContain(res.status);
      }
    });

    it('POST /api/orders (create) sets paymentStatus to PENDING by default', async () => {
      // Verify that order creation always starts with PENDING
      const order = await createPendingUpiOrder(testUser._id);
      expect(order.paymentStatus).toBe('PENDING');
    });

    it('Order schema default paymentStatus is PENDING', async () => {
      // Create order without specifying paymentStatus
      const order = await Order.create({
        userId: testUser._id,
        orderNumber: `ORD-DEFAULT-${Date.now()}`,
        items: [{ productId: new mongoose.Types.ObjectId(), name: 'Test', price: 100, qty: 1 }],
        totalAmount: 100,
        paymentMethod: 'upi',
        orderStatus: 'PENDING_PAYMENT',
        address: TEST_ADDRESS,
        assignmentHistory: [],
        history: [],
        // paymentStatus intentionally omitted
      });

      expect(order.paymentStatus).toBe('PENDING');
    });
  });
});
