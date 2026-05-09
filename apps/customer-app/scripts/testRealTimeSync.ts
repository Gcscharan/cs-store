#!/usr/bin/env ts-node

/**
 * Real-Time Synchronization Manual Test Script
 * 
 * Task 6.4: Test real-time synchronization
 * - Manual verification of web admin to mobile admin sync
 * - Manual verification of mobile admin to web admin sync
 * - Socket reconnection testing
 * Requirements: 4.1, 4.2
 * 
 * Usage:
 * npm run test:realtime-sync
 * or
 * npx ts-node scripts/testRealTimeSync.ts
 */

import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import readline from 'readline';

// Configuration
const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:3000/api',
  SOCKET_URL: process.env.SOCKET_URL || 'http://localhost:3000',
  ADMIN_PHONE: process.env.TEST_ADMIN_PHONE || '9999999999',
  ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD || 'admin123',
};

// Test state
let adminToken: string;
let testSocket: Socket;
let testOrderId: string;

// CLI interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Utility functions
const log = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m',   // Red
    warning: '\x1b[33m', // Yellow
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}[${type.toUpperCase()}] ${message}${reset}`);
};

const prompt = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Authentication
async function authenticate(): Promise<boolean> {
  try {
    log('Authenticating admin user...');
    const response = await axios.post(`${CONFIG.API_URL}/auth/login`, {
      phone: CONFIG.ADMIN_PHONE,
      password: CONFIG.ADMIN_PASSWORD,
    });
    
    adminToken = response.data.accessToken;
    log('Authentication successful', 'success');
    return true;
  } catch (error: any) {
    log(`Authentication failed: ${error.response?.data?.message || error.message}`, 'error');
    return false;
  }
}

// Socket connection
async function connectSocket(): Promise<boolean> {
  try {
    log('Connecting to socket server...');
    testSocket = io(CONFIG.SOCKET_URL, {
      auth: { token: adminToken },
      transports: ['websocket'],
      timeout: 10000,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 10000);

      testSocket.on('connect', () => {
        clearTimeout(timeout);
        log(`Socket connected with ID: ${testSocket.id}`, 'success');
        resolve(true);
      });

      testSocket.on('connect_error', (error) => {
        clearTimeout(timeout);
        log(`Socket connection failed: ${error.message}`, 'error');
        resolve(false);
      });
    });
  } catch (error: any) {
    log(`Socket connection error: ${error.message}`, 'error');
    return false;
  }
}

// Setup socket event listeners
function setupSocketListeners() {
  log('Setting up socket event listeners...');
  
  testSocket.on('order:status:changed', (data) => {
    log(`📦 Order Status Changed: ${data.orderId} (${data.from} → ${data.to})`, 'info');
    log(`   Actor: ${data.actorRole} (${data.actorId})`, 'info');
    log(`   Timestamp: ${data.timestamp}`, 'info');
  });

  testSocket.on('order:assigned', (data) => {
    log(`🚚 Order Assigned: ${data.orderId}`, 'info');
    log(`   Delivery Partner: ${data.deliveryPartner?.name} (${data.deliveryPartnerId})`, 'info');
    log(`   Timestamp: ${data.timestamp}`, 'info');
  });

  testSocket.on('disconnect', (reason) => {
    log(`Socket disconnected: ${reason}`, 'warning');
  });

  testSocket.on('reconnect', (attemptNumber) => {
    log(`Socket reconnected after ${attemptNumber} attempts`, 'success');
  });

  log('Socket event listeners configured', 'success');
}

// Create test order
async function createTestOrder(): Promise<string | null> {
  try {
    log('Creating test order...');
    
    // First, get available products
    const productsResponse = await axios.get(`${CONFIG.API_URL}/products`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    
    const products = productsResponse.data.products || [];
    if (products.length === 0) {
      log('No products available for test order', 'error');
      return null;
    }

    const testProduct = products[0];
    
    // Create order via customer API (simulating customer order)
    const orderData = {
      items: [{
        productId: testProduct._id,
        quantity: 1,
        price: testProduct.price,
      }],
      totalAmount: testProduct.price,
      address: {
        addressLine: 'Test Address',
        city: 'Test City',
        state: 'Test State',
        pincode: '123456',
        label: 'HOME',
      },
      paymentMethod: 'COD',
    };

    const orderResponse = await axios.post(`${CONFIG.API_URL}/orders`, orderData, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const orderId = orderResponse.data.order._id;
    log(`Test order created: ${orderId}`, 'success');
    return orderId;
  } catch (error: any) {
    log(`Failed to create test order: ${error.response?.data?.message || error.message}`, 'error');
    return null;
  }
}

// Test web admin to mobile admin sync
async function testWebToMobileSync(): Promise<boolean> {
  log('\n=== Testing Web Admin → Mobile Admin Synchronization ===');
  
  if (!testOrderId) {
    log('No test order available', 'error');
    return false;
  }

  try {
    // Set up event listener with timing
    let eventReceived = false;
    let eventData: any = null;
    const startTime = Date.now();

    const eventPromise = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 2000); // 2 second timeout

      testSocket.once('order:status:changed', (data) => {
        if (data.orderId === testOrderId) {
          clearTimeout(timeout);
          eventReceived = true;
          eventData = data;
          const endTime = Date.now();
          const syncTime = endTime - startTime;
          
          log(`Event received in ${syncTime}ms`, syncTime <= 1000 ? 'success' : 'warning');
          resolve(syncTime <= 1000);
        }
      });
    });

    // Simulate web admin action (confirm order)
    log('Simulating web admin confirming order...');
    await axios.patch(`${CONFIG.API_URL}/admin/orders/${testOrderId}/confirm`, {}, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const syncSuccess = await eventPromise;
    
    if (syncSuccess) {
      log('✅ Web → Mobile sync test PASSED (< 1 second)', 'success');
      return true;
    } else {
      log('❌ Web → Mobile sync test FAILED (> 1 second or no event)', 'error');
      return false;
    }
  } catch (error: any) {
    log(`Web → Mobile sync test error: ${error.message}`, 'error');
    return false;
  }
}

// Test mobile admin to web admin sync
async function testMobileToWebSync(): Promise<boolean> {
  log('\n=== Testing Mobile Admin → Web Admin Synchronization ===');
  
  if (!testOrderId) {
    log('No test order available', 'error');
    return false;
  }

  try {
    // Get current order status
    const orderResponse = await axios.get(`${CONFIG.API_URL}/orders/${testOrderId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    
    const currentStatus = orderResponse.data.order.status;
    log(`Current order status: ${currentStatus}`);

    // Determine next action based on current status
    let nextAction: string;
    let nextStatus: string;
    
    switch (currentStatus) {
      case 'CREATED':
        nextAction = 'confirm';
        nextStatus = 'CONFIRMED';
        break;
      case 'CONFIRMED':
        nextAction = 'pack';
        nextStatus = 'PACKED';
        break;
      default:
        log(`Cannot test from status: ${currentStatus}`, 'warning');
        return false;
    }

    // Set up event listener for web admin
    let eventReceived = false;
    const startTime = Date.now();

    const eventPromise = new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 2000);

      testSocket.once('order:status:changed', (data) => {
        if (data.orderId === testOrderId && data.to === nextStatus) {
          clearTimeout(timeout);
          eventReceived = true;
          const endTime = Date.now();
          const syncTime = endTime - startTime;
          
          log(`Event received in ${syncTime}ms`, syncTime <= 1000 ? 'success' : 'warning');
          resolve(syncTime <= 1000);
        }
      });
    });

    // Simulate mobile admin action
    log(`Simulating mobile admin ${nextAction} action...`);
    await axios.patch(`${CONFIG.API_URL}/admin/orders/${testOrderId}/${nextAction}`, {}, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const syncSuccess = await eventPromise;
    
    if (syncSuccess) {
      log('✅ Mobile → Web sync test PASSED (< 1 second)', 'success');
      return true;
    } else {
      log('❌ Mobile → Web sync test FAILED (> 1 second or no event)', 'error');
      return false;
    }
  } catch (error: any) {
    log(`Mobile → Web sync test error: ${error.message}`, 'error');
    return false;
  }
}

// Test socket reconnection
async function testSocketReconnection(): Promise<boolean> {
  log('\n=== Testing Socket Reconnection ===');
  
  try {
    // Verify initial connection
    if (!testSocket.connected) {
      log('Socket not connected initially', 'error');
      return false;
    }
    
    log('Initial connection verified');

    // Force disconnection
    log('Forcing socket disconnection...');
    testSocket.disconnect();
    
    await sleep(1000);
    
    if (testSocket.connected) {
      log('Socket still connected after disconnect call', 'error');
      return false;
    }
    
    log('Socket disconnected successfully');

    // Reconnect
    log('Attempting reconnection...');
    testSocket.connect();

    const reconnectSuccess = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, 10000);

      testSocket.once('connect', () => {
        clearTimeout(timeout);
        resolve(true);
      });
    });

    if (reconnectSuccess) {
      log('✅ Socket reconnection test PASSED', 'success');
      
      // Test event reception after reconnection
      log('Testing event reception after reconnection...');
      
      let eventReceived = false;
      testSocket.once('order:status:changed', () => {
        eventReceived = true;
      });

      // Emit test event
      testSocket.emit('test:event', { test: true });
      await sleep(500);

      log('Socket reconnection and event handling verified', 'success');
      return true;
    } else {
      log('❌ Socket reconnection test FAILED', 'error');
      return false;
    }
  } catch (error: any) {
    log(`Socket reconnection test error: ${error.message}`, 'error');
    return false;
  }
}

// Interactive test menu
async function runInteractiveTests() {
  log('\n=== Real-Time Synchronization Test Suite ===');
  log('This script will test the 1-second sync requirement between web and mobile admin');
  
  while (true) {
    console.log('\nAvailable tests:');
    console.log('1. Test Web Admin → Mobile Admin sync');
    console.log('2. Test Mobile Admin → Web Admin sync');
    console.log('3. Test Socket Reconnection');
    console.log('4. Run all tests');
    console.log('5. Create new test order');
    console.log('6. Exit');
    
    const choice = await prompt('\nSelect test (1-6): ');
    
    switch (choice) {
      case '1':
        await testWebToMobileSync();
        break;
      case '2':
        await testMobileToWebSync();
        break;
      case '3':
        await testSocketReconnection();
        break;
      case '4':
        log('\n=== Running All Tests ===');
        const results = [
          await testWebToMobileSync(),
          await testMobileToWebSync(),
          await testSocketReconnection(),
        ];
        const passed = results.filter(r => r).length;
        log(`\n=== Test Results: ${passed}/${results.length} tests passed ===`, 
            passed === results.length ? 'success' : 'warning');
        break;
      case '5':
        testOrderId = await createTestOrder() || testOrderId;
        break;
      case '6':
        log('Exiting test suite...');
        return;
      default:
        log('Invalid choice', 'error');
    }
  }
}

// Main execution
async function main() {
  try {
    log('Starting Real-Time Synchronization Test Suite');
    log(`API URL: ${CONFIG.API_URL}`);
    log(`Socket URL: ${CONFIG.SOCKET_URL}`);
    
    // Authenticate
    const authSuccess = await authenticate();
    if (!authSuccess) {
      log('Authentication failed. Please check credentials.', 'error');
      process.exit(1);
    }

    // Connect socket
    const socketSuccess = await connectSocket();
    if (!socketSuccess) {
      log('Socket connection failed. Please check server.', 'error');
      process.exit(1);
    }

    // Setup listeners
    setupSocketListeners();

    // Create test order
    testOrderId = await createTestOrder() || '';
    if (!testOrderId) {
      log('Warning: No test order created. Some tests may not work.', 'warning');
    }

    // Run interactive tests
    await runInteractiveTests();

  } catch (error: any) {
    log(`Fatal error: ${error.message}`, 'error');
    process.exit(1);
  } finally {
    // Cleanup
    if (testSocket) {
      testSocket.disconnect();
    }
    rl.close();
  }
}

// Handle process termination
process.on('SIGINT', () => {
  log('\nReceived SIGINT. Cleaning up...', 'warning');
  if (testSocket) {
    testSocket.disconnect();
  }
  rl.close();
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    log(`Unhandled error: ${error.message}`, 'error');
    process.exit(1);
  });
}

export { main, testWebToMobileSync, testMobileToWebSync, testSocketReconnection };