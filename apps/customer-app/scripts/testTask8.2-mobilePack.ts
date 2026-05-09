#!/usr/bin/env ts-node

/**
 * Task 8.2: Manual Test Script - Mobile Pack → Web Updates Instantly
 * 
 * This script provides interactive testing for verifying that mobile admin pack actions
 * update web admin within 1 second with correct UI button states.
 * 
 * Requirements: 4.1, 7.1
 * 
 * Usage:
 *   npm run test:task8.2-mobile-pack
 *   or
 *   npx ts-node scripts/testTask8.2-mobilePack.ts
 */

import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import * as readline from 'readline';

// Configuration
const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:3000/api',
  SOCKET_URL: process.env.SOCKET_URL || 'http://localhost:3000',
  ADMIN_PHONE: process.env.TEST_ADMIN_PHONE || '9999999999',
  ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD || 'admin123',
  SYNC_TIMEOUT: 1000, // 1 second requirement
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

class Task82Tester {
  private adminToken: string = '';
  private webSocket: Socket | null = null;
  private mobileSocket: Socket | null = null;
  private rl: readline.Interface;
  private testOrders: string[] = [];

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async run() {
    console.log('🧪 Task 8.2: Mobile Pack → Web Updates Test');
    console.log('='.repeat(50));
    console.log();

    try {
      await this.authenticate();
      await this.setupSockets();
      await this.showMenu();
    } catch (error) {
      console.error('❌ Test failed:', error);
    } finally {
      await this.cleanup();
    }
  }

  private async authenticate() {
    console.log('🔐 Authenticating as admin...');
    
    try {
      const response = await axios.post(`${CONFIG.API_URL}/auth/admin/login`, {
        phone: CONFIG.ADMIN_PHONE,
        password: CONFIG.ADMIN_PASSWORD,
      });

      this.adminToken = response.data.accessToken;
      console.log('✅ Admin authentication successful');
      console.log();
    } catch (error: any) {
      throw new Error(`Authentication failed: ${error.response?.data?.message || error.message}`);
    }
  }

  private async setupSockets() {
    console.log('🔌 Setting up socket connections...');

    // Setup web admin socket (simulating web admin interface)
    this.webSocket = io(CONFIG.SOCKET_URL, {
      auth: { token: this.adminToken },
      transports: ['websocket'],
      timeout: 5000,
    });

    // Setup mobile admin socket (simulating mobile admin interface)
    this.mobileSocket = io(CONFIG.SOCKET_URL, {
      auth: { token: this.adminToken },
      transports: ['websocket'],
      timeout: 5000,
    });

    // Wait for connections
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        this.webSocket!.on('connect', () => {
          console.log('✅ Web admin socket connected');
          resolve();
        });
        this.webSocket!.on('connect_error', reject);
      }),
      new Promise<void>((resolve, reject) => {
        this.mobileSocket!.on('connect', () => {
          console.log('✅ Mobile admin socket connected');
          resolve();
        });
        this.mobileSocket!.on('connect_error', reject);
      }),
    ]);

    console.log();
  }

  private async showMenu() {
    while (true) {
      console.log('📋 Test Menu:');
      console.log('1. Create test order (CONFIRMED status)');
      console.log('2. Test mobile pack → web updates');
      console.log('3. Test rapid pack actions');
      console.log('4. Test socket reconnection');
      console.log('5. List test orders');
      console.log('6. Cleanup test orders');
      console.log('0. Exit');
      console.log();

      const choice = await this.prompt('Select option: ');

      switch (choice) {
        case '1':
          await this.createTestOrder();
          break;
        case '2':
          await this.testMobilePackWebUpdates();
          break;
        case '3':
          await this.testRapidPackActions();
          break;
        case '4':
          await this.testSocketReconnection();
          break;
        case '5':
          await this.listTestOrders();
          break;
        case '6':
          await this.cleanupTestOrders();
          break;
        case '0':
          return;
        default:
          console.log('❌ Invalid option');
      }

      console.log();
    }
  }

  private async createTestOrder() {
    console.log('📦 Creating test order in CONFIRMED status...');

    try {
      const response = await axios.post(
        `${CONFIG.API_URL}/admin/test/create-order`,
        {
          status: 'CONFIRMED',
          items: [
            {
              productId: `test-product-${Date.now()}`,
              quantity: 2,
              price: 100,
            },
          ],
          totalAmount: 200,
          userId: `test-user-${Date.now()}`,
        },
        {
          headers: { Authorization: `Bearer ${this.adminToken}` },
        }
      );

      const orderId = response.data.order._id;
      this.testOrders.push(orderId);

      console.log(`✅ Test order created: ${orderId}`);
      console.log(`   Status: CONFIRMED`);
      console.log(`   AllowedActions: ${response.data.order.allowedActions?.join(', ') || 'N/A'}`);
    } catch (error: any) {
      console.log(`❌ Failed to create test order: ${error.response?.data?.message || error.message}`);
    }
  }

  private async testMobilePackWebUpdates() {
    if (this.testOrders.length === 0) {
      console.log('❌ No test orders available. Create one first.');
      return;
    }

    const orderId = this.testOrders[this.testOrders.length - 1];
    console.log(`🧪 Testing mobile pack → web updates for order: ${orderId}`);

    const startTime = Date.now();
    let webUpdateReceived = false;
    let webUpdateTime: number;
    let receivedOrder: TestOrder | null = null;

    // Setup web admin socket listener
    const webSocketPromise = new Promise<OrderStatusChangedEvent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Socket event timeout'));
      }, CONFIG.SYNC_TIMEOUT);

      this.webSocket!.on('order:status:changed', (data: OrderStatusChangedEvent) => {
        if (data.orderId === orderId) {
          clearTimeout(timeout);
          webUpdateTime = Date.now();
          webUpdateReceived = true;
          receivedOrder = data.order || null;
          resolve(data);
        }
      });
    });

    console.log('📱 Performing pack action from mobile admin...');

    try {
      // Perform pack action from mobile admin
      const packResponse = await axios.patch(
        `${CONFIG.API_URL}/admin/orders/${orderId}/pack`,
        {},
        {
          headers: { Authorization: `Bearer ${this.adminToken}` },
          timeout: 500, // API should be fast
        }
      );

      const apiResponseTime = Date.now();
      console.log(`✅ Mobile pack API response received in ${apiResponseTime - startTime}ms`);
      console.log(`   New status: ${packResponse.data.order.status || packResponse.data.order.orderStatus}`);

      // Wait for web admin socket event
      console.log('🌐 Waiting for web admin socket update...');
      const socketEvent = await webSocketPromise;

      const totalSyncTime = webUpdateTime! - startTime;
      const apiTime = apiResponseTime - startTime;
      const socketTime = webUpdateTime! - apiResponseTime;

      console.log();
      console.log('📊 Performance Results:');
      console.log(`   Total sync time: ${totalSyncTime}ms (requirement: <${CONFIG.SYNC_TIMEOUT}ms)`);
      console.log(`   API response time: ${apiTime}ms`);
      console.log(`   Socket propagation time: ${socketTime}ms`);
      console.log(`   Status change: ${socketEvent.from} → ${socketEvent.to}`);

      if (totalSyncTime < CONFIG.SYNC_TIMEOUT) {
        console.log('✅ PASSED: Sync time meets requirement');
      } else {
        console.log('❌ FAILED: Sync time exceeds requirement');
      }

      console.log();
      console.log('🔘 UI Button State Verification:');
      if (receivedOrder) {
        console.log(`   Updated allowedActions: ${receivedOrder.allowedActions?.join(', ') || 'N/A'}`);
        
        const hasAssign = receivedOrder.allowedActions?.includes('ASSIGN');
        const hasPack = receivedOrder.allowedActions?.includes('PACK');
        const hasConfirm = receivedOrder.allowedActions?.includes('CONFIRM');

        console.log(`   ASSIGN button available: ${hasAssign ? '✅' : '❌'}`);
        console.log(`   PACK button removed: ${!hasPack ? '✅' : '❌'}`);
        console.log(`   CONFIRM button removed: ${!hasConfirm ? '✅' : '❌'}`);

        if (hasAssign && !hasPack && !hasConfirm) {
          console.log('✅ PASSED: UI buttons updated correctly');
        } else {
          console.log('❌ FAILED: UI buttons not updated correctly');
        }
      } else {
        console.log('❌ FAILED: No order data in socket event');
      }

    } catch (error: any) {
      console.log(`❌ Test failed: ${error.message}`);
    }
  }

  private async testRapidPackActions() {
    console.log('⚡ Testing rapid pack actions...');

    // Create 3 test orders
    const orderIds: string[] = [];
    for (let i = 0; i < 3; i++) {
      try {
        const response = await axios.post(
          `${CONFIG.API_URL}/admin/test/create-order`,
          {
            status: 'CONFIRMED',
            items: [{ productId: `rapid-test-${i}`, quantity: 1, price: 50 }],
            totalAmount: 50,
            userId: `rapid-user-${i}`,
          },
          {
            headers: { Authorization: `Bearer ${this.adminToken}` },
          }
        );
        orderIds.push(response.data.order._id);
        this.testOrders.push(response.data.order._id);
      } catch (error) {
        console.log(`❌ Failed to create rapid test order ${i}`);
        return;
      }
    }

    console.log(`✅ Created ${orderIds.length} test orders for rapid testing`);

    const receivedEvents: OrderStatusChangedEvent[] = [];
    
    // Setup web admin socket listener for multiple events
    this.webSocket!.on('order:status:changed', (data: OrderStatusChangedEvent) => {
      if (orderIds.includes(data.orderId)) {
        receivedEvents.push(data);
        console.log(`📡 Received update for order ${data.orderId}: ${data.from} → ${data.to}`);
      }
    });

    const startTime = Date.now();

    // Perform rapid pack actions
    console.log('📱 Performing rapid pack actions...');
    const packPromises = orderIds.map((orderId, index) =>
      axios.patch(
        `${CONFIG.API_URL}/admin/orders/${orderId}/pack`,
        {},
        {
          headers: { Authorization: `Bearer ${this.adminToken}` },
        }
      ).then(() => console.log(`✅ Pack action ${index + 1} completed`))
    );

    await Promise.all(packPromises);

    // Wait for all socket events
    console.log('🌐 Waiting for all web admin socket updates...');
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

    console.log();
    console.log('📊 Rapid Pack Test Results:');
    console.log(`   Processed ${orderIds.length} pack actions in ${totalTime}ms`);
    console.log(`   Average time per action: ${Math.round(totalTime / orderIds.length)}ms`);
    console.log(`   Events received: ${receivedEvents.length}/${orderIds.length}`);

    if (receivedEvents.length === orderIds.length) {
      console.log('✅ PASSED: All rapid pack actions synchronized correctly');
    } else {
      console.log('❌ FAILED: Some pack actions not synchronized');
    }
  }

  private async testSocketReconnection() {
    if (this.testOrders.length === 0) {
      console.log('❌ No test orders available. Create one first.');
      return;
    }

    const orderId = this.testOrders[this.testOrders.length - 1];
    console.log(`🔌 Testing socket reconnection with order: ${orderId}`);

    let eventReceived = false;

    // Setup event listener
    this.webSocket!.on('order:status:changed', (data: OrderStatusChangedEvent) => {
      if (data.orderId === orderId) {
        eventReceived = true;
        console.log(`📡 Event received after reconnection: ${data.from} → ${data.to}`);
      }
    });

    // Force disconnect and reconnect
    console.log('🔌 Disconnecting web socket...');
    this.webSocket!.disconnect();

    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('🔌 Reconnecting web socket...');
    this.webSocket!.connect();

    // Wait for reconnection
    await new Promise<void>((resolve) => {
      if (this.webSocket!.connected) {
        console.log('✅ Web socket reconnected');
        resolve();
      } else {
        this.webSocket!.on('connect', () => {
          console.log('✅ Web socket reconnected');
          resolve();
        });
      }
    });

    // Perform pack action after reconnection
    console.log('📱 Performing pack action after reconnection...');
    try {
      await axios.patch(
        `${CONFIG.API_URL}/admin/orders/${orderId}/pack`,
        {},
        {
          headers: { Authorization: `Bearer ${this.adminToken}` },
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

      if (eventReceived) {
        console.log('✅ PASSED: Pack synchronization maintained after reconnection');
      } else {
        console.log('❌ FAILED: Pack synchronization lost after reconnection');
      }

    } catch (error: any) {
      console.log(`❌ Pack action failed: ${error.message}`);
    }
  }

  private async listTestOrders() {
    console.log('📋 Test Orders:');
    if (this.testOrders.length === 0) {
      console.log('   No test orders created');
      return;
    }

    for (const orderId of this.testOrders) {
      try {
        const response = await axios.get(`${CONFIG.API_URL}/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${this.adminToken}` },
        });
        const order = response.data.order || response.data;
        console.log(`   ${orderId}: ${order.status || order.orderStatus} (${order.allowedActions?.join(', ') || 'N/A'})`);
      } catch (error) {
        console.log(`   ${orderId}: Error fetching order`);
      }
    }
  }

  private async cleanupTestOrders() {
    console.log('🧹 Cleaning up test orders...');
    
    for (const orderId of this.testOrders) {
      try {
        await axios.delete(`${CONFIG.API_URL}/admin/test/orders/${orderId}`, {
          headers: { Authorization: `Bearer ${this.adminToken}` },
        });
        console.log(`✅ Deleted order: ${orderId}`);
      } catch (error) {
        console.log(`❌ Failed to delete order: ${orderId}`);
      }
    }

    this.testOrders = [];
    console.log('✅ Cleanup completed');
  }

  private async cleanup() {
    console.log('🧹 Cleaning up...');
    
    if (this.webSocket) {
      this.webSocket.disconnect();
    }
    if (this.mobileSocket) {
      this.mobileSocket.disconnect();
    }
    
    await this.cleanupTestOrders();
    this.rl.close();
  }

  private prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(question, resolve);
    });
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  const tester = new Task82Tester();
  tester.run().catch(console.error);
}

export default Task82Tester;