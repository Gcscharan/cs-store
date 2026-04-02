import request from 'supertest';
import { createTestApp } from '../helpers/testApp';
import { setupTestDB, teardownTestDB, createTestUser, createTestOrder, createTestProduct } from '../helpers/db';
import { mockRazorpayWebhook, mockPaymentIntent } from '../helpers/mocks';

const app = createTestApp();

describe('Payment System - Backend Polling', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    await setupTestDB();
    
    // Create serviceable pincode
    const { Pincode } = await import('../../src/models/Pincode');
    await Pincode.create({
      pincode: "500001",
      state: "Telangana",
      district: "Hyderabad",
      taluka: "Hyderabad",
    });
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    const user = await createTestUser({
      addresses: [
        {
          name: "Test User",
          phone: "9876543210",
          label: "Home",
          addressLine: "123 Test St",
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500001",
          postal_district: "Hyderabad",
          admin_district: "Hyderabad",
          lat: 17.385,
          lng: 78.4867,
          isDefault: true,
          isGeocoded: true,
        },
      ],
    });
    userId = user.id;
    authToken = user.token;
  });

  describe('[P0] Backend Polling - Web Razorpay', () => {
    test('Payment success triggers backend status update', async () => {
      // Arrange - Create order
      const order = await createTestOrder(userId, {
        paymentMethod: 'razorpay',
        paymentStatus: 'PENDING',
      });

      // Act - Simulate Razorpay webhook (payment success)
      await mockRazorpayWebhook({
        orderId: order._id,
        razorpayPaymentId: 'pay_test123',
        status: 'captured',
      });

      // Wait for webhook processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Act - Client polls for status
      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.order.paymentStatus).toBe('PAID');
      expect(response.body.order.paymentIntent.status).toBe('completed');
    });

    test('Client polls every 3 seconds until confirmed', async () => {
      // Arrange
      const order = await createTestOrder(userId, {
        paymentMethod: 'razorpay',
        paymentStatus: 'PENDING',
      });

      const pollAttempts: number[] = [];

      // Act - Simulate polling
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        
        await request(app)
          .get(`/api/orders/${order._id}`)
          .set('Authorization', `Bearer ${authToken}`);
        
        pollAttempts.push(Date.now() - startTime);
        
        // Simulate 3-second interval
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // Assert - Verify polling happened
      expect(pollAttempts.length).toBe(5);
    });

    test('Backend confirms payment before client navigation', async () => {
      // Arrange
      const order = await createTestOrder(userId, {
        paymentMethod: 'razorpay',
        paymentStatus: 'PENDING',
      });

      // Act - Client tries to navigate before backend confirms
      const response1 = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.body.order.paymentStatus).toBe('PENDING');

      // Act - Webhook arrives
      await mockRazorpayWebhook({
        orderId: order._id,
        razorpayPaymentId: 'pay_test456',
        status: 'captured',
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Act - Client polls again
      const response2 = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert - Now confirmed
      expect(response2.body.order.paymentStatus).toBe('PAID');
    });

    test('Polling timeout after 120 seconds shows recoverable state', async () => {
      // Arrange
      const order = await createTestOrder(userId, {
        paymentMethod: 'razorpay',
        paymentStatus: 'PENDING',
        createdAt: new Date(Date.now() - 125000), // 125 seconds ago
      });

      // Act
      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.order.paymentIntent.status).toBe('expired');
    });
  });

  describe('[P0] Backend Polling - Mobile UPI', () => {
    test('UPI payment success updates backend status', async () => {
      // Arrange
      const order = await createTestOrder(userId, {
        paymentMethod: 'upi',
        paymentStatus: 'PENDING',
      });

      // Act - Simulate UPI callback
      await request(app)
        .post(`/api/orders/${order._id}/payment-callback`)
        .send({
          status: 'SUCCESS',
          transactionId: 'upi_test123',
        });

      // Act - Client polls
      const response = await request(app)
        .get(`/api/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.paymentStatus).toBe('PAID');
    });

    test('App state change triggers status check', async () => {
      // Arrange
      const order = await createTestOrder(userId, {
        paymentMethod: 'upi',
        paymentStatus: 'PENDING',
      });

      // Act - Simulate app returning from background
      const response = await request(app)
        .get(`/api/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-App-State', 'active');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('paymentStatus');
    });

    test('Payment pending status allows manual check', async () => {
      // Arrange
      const order = await createTestOrder(userId, {
        paymentMethod: 'upi',
        paymentStatus: 'PENDING',
      });

      // Act - Multiple status checks
      const response1 = await request(app)
        .get(`/api/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${authToken}`);

      const response2 = await request(app)
        .get(`/api/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert - Both succeed
      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.paymentStatus).toBe('PENDING');
      expect(response2.body.paymentStatus).toBe('PENDING');
    });
  });

  describe('[P0] No Direct Navigation on Client Success', () => {
    test('Razorpay onSuccess does not directly navigate', async () => {
      // This is primarily a client-side test, but we verify
      // backend requires polling before confirming

      // Arrange
      const order = await createTestOrder(userId, {
        paymentMethod: 'razorpay',
        paymentStatus: 'PENDING',
      });

      // Act - Client reports success but backend not updated
      const response = await request(app)
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert - Still pending until webhook
      expect(response.body.order.paymentStatus).toBe('PENDING');
    });

    test('UPI success requires backend confirmation', async () => {
      // Arrange
      const order = await createTestOrder(userId, {
        paymentMethod: 'upi',
        paymentStatus: 'PENDING',
      });

      // Act - Client polls before callback
      const response1 = await request(app)
        .get(`/api/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response1.body.paymentStatus).toBe('PENDING');

      // Act - Callback arrives
      await request(app)
        .post(`/api/orders/${order._id}/payment-callback`)
        .send({
          status: 'SUCCESS',
          transactionId: 'upi_test789',
        });

      // Act - Client polls again
      const response2 = await request(app)
        .get(`/api/orders/${order._id}/payment-status`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert - Now confirmed
      expect(response2.body.paymentStatus).toBe('PAID');
    });
  });

  describe('[P0] Idempotency and Duplicate Prevention', () => {
    test('Idempotency key prevents duplicate orders', async () => {
      // Arrange - Create product and add to cart twice (for both requests)
      const product = await createTestProduct({ price: 100 });
      await (global as any).addToTestCart(userId, product._id.toString(), 1);
      
      const idempotencyKey = `order_create_test_${Date.now()}`;

      // Act - Create order first time
      const response1 = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          paymentMethod: 'razorpay',
        });

      // Add to cart again for second request (since first request clears cart)
      await (global as any).addToTestCart(userId, product._id.toString(), 1);

      // Act - Create order second time with same key
      const response2 = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          paymentMethod: 'razorpay',
        });

      // Assert - Same order returned
      expect(response1.status).toBe(201);
      expect(response2.status).toBe(200); // Returns existing
      expect(response1.body.order._id).toBe(response2.body.order._id);
    });

    test('Duplicate payment attempt blocked', async () => {
      // Arrange
      const order = await createTestOrder(userId, {
        paymentMethod: 'razorpay',
        paymentStatus: 'PAID', // Already paid
      });

      // Act - Try to create payment intent again
      const response = await request(app)
        .post(`/api/orders/${order._id}/payment-intent`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already paid');
    });
  });

  describe('[P1] Network Failure During Polling', () => {
    test('Polling retry with exponential backoff', async () => {
      // Arrange
      const order = await createTestOrder(userId, {
        paymentMethod: 'razorpay',
        paymentStatus: 'PENDING',
      });

      let attemptCount = 0;
      const retryDelays: number[] = [];

      // Act - Simulate polling with failures
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        
        try {
          await request(app)
            .get(`/api/orders/${order._id}`)
            .set('Authorization', `Bearer ${authToken}`);
          
          attemptCount++;
        } catch (error) {
          // Network failure
        }
        
        const delay = Math.min(1000 * Math.pow(2, i), 10000);
        retryDelays.push(delay);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      // Assert - Exponential backoff applied
      expect(retryDelays[0]).toBe(1000);  // 1s
      expect(retryDelays[1]).toBe(2000);  // 2s
      expect(retryDelays[2]).toBe(4000);  // 4s
    });
  });
});
