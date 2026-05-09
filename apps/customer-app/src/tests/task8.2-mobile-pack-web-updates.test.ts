/**
 * Task 8.2: Test mobile pack → web updates instantly
 * 
 * This test verifies that when a pack action is performed on mobile admin,
 * the web admin shows updated status within 1 second and UI buttons are updated correctly.
 * 
 * Requirements: 4.1, 7.1
 */

import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { BASE_URL } from '../api/baseApi';

const API_URL = BASE_URL;
const SOCKET_URL = API_URL.replace('/api', '');

// Test configuration
const TEST_CONFIG = {
  SOCKET_URL,
  API_URL,
  TEST_TIMEOUT: 10000,
  SYNC_TIMEOUT: 1000, // 1 second requirement
  API_TIMEOUT: 500, // API calls should be fast for 1-second total sync
};

// Test credentials (should match your test environment)
const TEST_ADMIN = {
  phone: '9999999999',
  password: 'admin123',
};

interface TestOrder {
  _id: string;
  orderNumber?: string;
  status: string;
  orderStatus: string;
  allowedActions: string[];
  totalAmount: number;
  items: any[];
  userId: any;
  createdAt: string;
}

interface OrderStatusChangedEvent {
  orderId: string;
  from: string;
  to: string;
  actorRole: 'CUSTOMER' | 'DELIVERY_PARTNER' | 'ADMIN';
  actorId: string;
  timestamp: string;
  order?: TestOrder;
}

describe('Task 8.2: Mobile Pack → Web Updates Instantly', () => {
  let adminToken: string;
  let webSocket: Socket;
  let mobileSocket: Socket;
  let testOrderId: string;

  beforeAll(async () => {
    // Authenticate as admin
    const authResponse = await axios.post(`${API_URL}/auth/admin/login`, {
      phone: TEST_ADMIN.phone,
      password: TEST_ADMIN.password,
    });

    expect(authResponse.data.accessToken).toBeDefined();
    adminToken = authResponse.data.accessToken;
  }, TEST_CONFIG.TEST_TIMEOUT);

  beforeEach(async () => {
    // Create test order in CONFIRMED status (ready to be packed)
    const orderResponse = await axios.post(
      `${API_URL}/admin/test/create-order`,
      {
        status: 'CONFIRMED',
        items: [
          {
            productId: 'test-product-1',
            quantity: 2,
            price: 100,
          },
        ],
        totalAmount: 200,
        userId: 'test-user-1',
      },
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );

    testOrderId = orderResponse.data.order._id;
    expect(testOrderId).toBeDefined();

    // Setup web admin socket (simulating web admin interface)
    webSocket = io(SOCKET_URL, {
      auth: { token: adminToken },
      transports: ['websocket'],
      timeout: 5000,
    });

    // Setup mobile admin socket (simulating mobile admin interface)
    mobileSocket = io(SOCKET_URL, {
      auth: { token: adminToken },
      transports: ['websocket'],
      timeout: 5000,
    });

    // Wait for both sockets to connect
    await Promise.all([
      new Promise<void>((resolve) => {
        webSocket.on('connect', resolve);
      }),
      new Promise<void>((resolve) => {
        mobileSocket.on('connect', resolve);
      }),
    ]);

    expect(webSocket.connected).toBe(true);
    expect(mobileSocket.connected).toBe(true);
  }, TEST_CONFIG.TEST_TIMEOUT);

  afterEach(async () => {
    // Cleanup sockets
    if (webSocket) {
      webSocket.disconnect();
    }
    if (mobileSocket) {
      mobileSocket.disconnect();
    }

    // Cleanup test order
    if (testOrderId && adminToken) {
      try {
        await axios.delete(`${API_URL}/admin/test/orders/${testOrderId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch (error) {
        console.warn('Failed to cleanup test order:', error);
      }
    }
  });

  test('Mobile pack action updates web admin within 1 second', async () => {
    const startTime = Date.now();
    let webUpdateReceived = false;
    let webUpdateTime: number;
    let receivedOrder: TestOrder | null = null;

    // Setup web admin socket listener (simulating web admin listening for updates)
    const webSocketPromise = new Promise<OrderStatusChangedEvent>((resolve) => {
      webSocket.on('order:status:changed', (data: OrderStatusChangedEvent) => {
        if (data.orderId === testOrderId) {
          webUpdateTime = Date.now();
          webUpdateReceived = true;
          receivedOrder = data.order || null;
          resolve(data);
        }
      });
    });

    // Perform pack action from mobile admin (simulating mobile admin pack button press)
    const packResponse = await axios.patch(
      `${API_URL}/admin/orders/${testOrderId}/pack`,
      {},
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        timeout: TEST_CONFIG.API_TIMEOUT,
      }
    );

    const apiResponseTime = Date.now();

    // Verify API response
    expect(packResponse.status).toBe(200);
    expect(packResponse.data.order).toBeDefined();
    expect(packResponse.data.order.status || packResponse.data.order.orderStatus).toBe('PACKED');

    // Wait for web admin socket event (with timeout)
    const socketEvent = await Promise.race([
      webSocketPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Socket event timeout')), TEST_CONFIG.SYNC_TIMEOUT);
      }),
    ]);

    const totalSyncTime = webUpdateTime! - startTime;
    const apiTime = apiResponseTime - startTime;
    const socketTime = webUpdateTime! - apiResponseTime;

    // Verify timing requirements
    expect(totalSyncTime).toBeLessThan(TEST_CONFIG.SYNC_TIMEOUT);
    expect(apiTime).toBeLessThan(TEST_CONFIG.API_TIMEOUT);
    expect(webUpdateReceived).toBe(true);

    // Verify socket event data
    expect(socketEvent.orderId).toBe(testOrderId);
    expect(socketEvent.from.toUpperCase()).toBe('CONFIRMED');
    expect(socketEvent.to.toUpperCase()).toBe('PACKED');
    expect(socketEvent.actorRole).toBe('ADMIN');
    expect(socketEvent.order).toBeDefined();

    // Verify complete order object is included
    expect(receivedOrder).toBeDefined();
    expect(receivedOrder!._id).toBe(testOrderId);
    expect(receivedOrder!.status || receivedOrder!.orderStatus).toBe('PACKED');

    // Verify allowedActions are updated correctly for PACKED status
    expect(receivedOrder!.allowedActions).toBeDefined();
    expect(receivedOrder!.allowedActions).toContain('ASSIGN');
    expect(receivedOrder!.allowedActions).not.toContain('PACK');
    expect(receivedOrder!.allowedActions).not.toContain('CONFIRM');

    console.log('✅ Task 8.2 Performance Metrics:');
    console.log(`   Total sync time: ${totalSyncTime}ms (requirement: <${TEST_CONFIG.SYNC_TIMEOUT}ms)`);
    console.log(`   API response time: ${apiTime}ms`);
    console.log(`   Socket propagation time: ${socketTime}ms`);
    console.log(`   Order status: ${socketEvent.from} → ${socketEvent.to}`);
    console.log(`   Updated allowedActions: ${receivedOrder!.allowedActions.join(', ')}`);
  }, TEST_CONFIG.TEST_TIMEOUT);

  test('Web admin UI buttons updated correctly after mobile pack', async () => {
    // Setup web admin socket listener
    const webSocketPromise = new Promise<OrderStatusChangedEvent>((resolve) => {
      webSocket.on('order:status:changed', (data: OrderStatusChangedEvent) => {
        if (data.orderId === testOrderId) {
          resolve(data);
        }
      });
    });

    // Get initial order state
    const initialOrderResponse = await axios.get(`${API_URL}/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const initialOrder = initialOrderResponse.data.order || initialOrderResponse.data;
    expect(initialOrder.status || initialOrder.orderStatus).toBe('CONFIRMED');
    expect(initialOrder.allowedActions).toContain('PACK');

    // Perform pack action from mobile admin
    await axios.patch(
      `${API_URL}/admin/orders/${testOrderId}/pack`,
      {},
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );

    // Wait for web admin socket event
    const socketEvent = await Promise.race([
      webSocketPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Socket event timeout')), TEST_CONFIG.SYNC_TIMEOUT);
      }),
    ]);

    const updatedOrder = socketEvent.order!;

    // Verify UI button state changes
    expect(updatedOrder.allowedActions).toBeDefined();

    // After packing, these buttons should be available
    expect(updatedOrder.allowedActions).toContain('ASSIGN');

    // After packing, these buttons should NOT be available
    expect(updatedOrder.allowedActions).not.toContain('PACK');
    expect(updatedOrder.allowedActions).not.toContain('CONFIRM');

    // Verify status change
    expect(updatedOrder.status || updatedOrder.orderStatus).toBe('PACKED');

    console.log('✅ Task 8.2 UI Button Verification:');
    console.log(`   Status changed: CONFIRMED → PACKED`);
    console.log(`   Buttons now available: ${updatedOrder.allowedActions.join(', ')}`);
    console.log(`   Buttons removed: PACK, CONFIRM`);
    console.log(`   Buttons added: ASSIGN`);
  }, TEST_CONFIG.TEST_TIMEOUT);

  test('Multiple rapid pack actions handled correctly', async () => {
    // Create multiple test orders in CONFIRMED status
    const orderIds: string[] = [];
    
    for (let i = 0; i < 3; i++) {
      const orderResponse = await axios.post(
        `${API_URL}/admin/test/create-order`,
        {
          status: 'CONFIRMED',
          items: [{ productId: `test-product-${i}`, quantity: 1, price: 50 }],
          totalAmount: 50,
          userId: `test-user-${i}`,
        },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      );
      orderIds.push(orderResponse.data.order._id);
    }

    const receivedEvents: OrderStatusChangedEvent[] = [];
    
    // Setup web admin socket listener for multiple events
    webSocket.on('order:status:changed', (data: OrderStatusChangedEvent) => {
      if (orderIds.includes(data.orderId)) {
        receivedEvents.push(data);
      }
    });

    const startTime = Date.now();

    // Perform rapid pack actions
    const packPromises = orderIds.map((orderId) =>
      axios.patch(
        `${API_URL}/admin/orders/${orderId}/pack`,
        {},
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      )
    );

    await Promise.all(packPromises);

    // Wait for all socket events
    await new Promise<void>((resolve) => {
      const checkEvents = () => {
        if (receivedEvents.length >= orderIds.length) {
          resolve();
        } else {
          setTimeout(checkEvents, 50);
        }
      };
      checkEvents();
    });

    const totalTime = Date.now() - startTime;

    // Verify all events received
    expect(receivedEvents.length).toBe(orderIds.length);

    // Verify all orders updated correctly
    for (const event of receivedEvents) {
      expect(event.from.toUpperCase()).toBe('CONFIRMED');
      expect(event.to.toUpperCase()).toBe('PACKED');
      expect(event.order).toBeDefined();
      expect(event.order!.allowedActions).toContain('ASSIGN');
      expect(event.order!.allowedActions).not.toContain('PACK');
    }

    // Verify performance under load
    expect(totalTime).toBeLessThan(3000); // 3 seconds for 3 rapid actions

    console.log('✅ Task 8.2 Load Test:');
    console.log(`   Processed ${orderIds.length} rapid pack actions in ${totalTime}ms`);
    console.log(`   Average time per action: ${Math.round(totalTime / orderIds.length)}ms`);

    // Cleanup test orders
    for (const orderId of orderIds) {
      try {
        await axios.delete(`${API_URL}/admin/test/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch (error) {
        console.warn('Failed to cleanup test order:', orderId, error);
      }
    }
  }, TEST_CONFIG.TEST_TIMEOUT);

  test('Socket reconnection maintains pack synchronization', async () => {
    let reconnectCount = 0;
    let eventReceived = false;

    // Setup reconnection tracking
    webSocket.on('disconnect', () => {
      console.log('Web socket disconnected');
    });

    webSocket.on('connect', () => {
      reconnectCount++;
      console.log(`Web socket connected (attempt ${reconnectCount})`);
    });

    // Setup event listener
    webSocket.on('order:status:changed', (data: OrderStatusChangedEvent) => {
      if (data.orderId === testOrderId) {
        eventReceived = true;
        expect(data.from.toUpperCase()).toBe('CONFIRMED');
        expect(data.to.toUpperCase()).toBe('PACKED');
      }
    });

    // Force disconnect and reconnect
    webSocket.disconnect();
    await new Promise(resolve => setTimeout(resolve, 100));
    webSocket.connect();

    // Wait for reconnection
    await new Promise<void>((resolve) => {
      if (webSocket.connected) {
        resolve();
      } else {
        webSocket.on('connect', resolve);
      }
    });

    // Perform pack action after reconnection
    await axios.patch(
      `${API_URL}/admin/orders/${testOrderId}/pack`,
      {},
      {
        headers: { Authorization: `Bearer ${adminToken}` },
      }
    );

    // Wait for event
    await new Promise<void>((resolve) => {
      const checkEvent = () => {
        if (eventReceived) {
          resolve();
        } else {
          setTimeout(checkEvent, 50);
        }
      };
      setTimeout(checkEvent, 100);
    });

    expect(eventReceived).toBe(true);
    expect(reconnectCount).toBeGreaterThan(1);

    console.log('✅ Task 8.2 Reconnection Test:');
    console.log(`   Socket reconnected successfully`);
    console.log(`   Pack synchronization maintained after reconnection`);
  }, TEST_CONFIG.TEST_TIMEOUT);
});