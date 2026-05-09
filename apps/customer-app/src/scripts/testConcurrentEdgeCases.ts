#!/usr/bin/env ts-node

/**
 * Manual Test Script for Task 8.5: Concurrent Actions and Edge Cases
 * 
 * This script provides interactive testing for:
 * - Simultaneous actions from both platforms
 * - Network interruption scenarios
 * - Socket reconnection during actions
 * - Error handling verification
 * 
 * Usage: npm run test:concurrent-edge-cases
 */

import { io, Socket } from 'socket.io-client';
import axios, { AxiosError } from 'axios';
import readline from 'readline';

// Configuration
const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:3000/api',
  SOCKET_URL: process.env.SOCKET_URL || 'http://localhost:3000',
  ADMIN_PHONE: process.env.TEST_ADMIN_PHONE || '9999999999',
  ADMIN_PASSWORD: process.env.TEST_ADMIN_PASSWORD || 'admin123',
};

// Global state
let adminToken: string;
let mobileSocket: Socket;
let webSocket: Socket;
let rl: readline.Interface;

// Test order data
const createTestOrder = (id: string) => ({
  _id: id,
  orderNumber: `TEST-${id}`,
  status: 'CREATED',
  orderStatus: 'CREATED',
  allowedActions: ['CONFIRM', 'PACK'],
  userId: { name: 'Test Customer', phone: '1234567890' },
  items: [{ productId: { name: 'Test Product' }, qty: 1, price: 100 }],
  totalAmount: 100,
  createdAt: new Date().toISOString(),
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
  } catch (error) {
    log(`Authentication failed: ${error}`, 'error');
    return false;
  }
}

// Socket connections
async function setupSockets(): Promise<boolean> {
  try {
    log('Setting up socket connections...');
    
    // Mobile admin socket
    mobileSocket = io(CONFIG.SOCKET_URL, {
      auth: { token: adminToken },
      transports: ['websocket'],
      timeout: 5000,
    });

    // Web admin socket (simulated)
    webSocket = io(CONFIG.SOCKET_URL, {
      auth: { token: adminToken },
      transports: ['websocket'],
      timeout: 5000,
    });

    // Wait for connections
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Mobile socket timeout')), 5000);
        mobileSocket.on('connect', () => {
          clearTimeout(timeout);
          log('Mobile socket connected', 'success');
          resolve();
        });
        mobileSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      }),
      new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Web socket timeout')), 5000);
        webSocket.on('connect', () => {
          clearTimeout(timeout);
          log('Web socket connected', 'success');
          resolve();
        });
        webSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      }),
    ]);

    // Set up event listeners
    setupEventListeners();
    
    return true;
  } catch (error) {
    log(`Socket setup failed: ${error}`, 'error');
    return false;
  }
}

function setupEventListeners() {
  // Mobile socket events
  mobileSocket.on('order:status:changed', (data) => {
    log(`Mobile received status change: ${data.orderId} ${data.from} → ${data.to}`, 'info');
  });

  mobileSocket.on('order:assigned', (data) => {
    log(`Mobile received assignment: ${data.orderId} → ${data.deliveryPartnerId}`, 'info');
  });

  mobileSocket.on('disconnect', (reason) => {
    log(`Mobile socket disconnected: ${reason}`, 'warning');
  });

  mobileSocket.on('connect', () => {
    log('Mobile socket reconnected', 'success');
  });

  // Web socket events
  webSocket.on('order:status:changed', (data) => {
    log(`Web received status change: ${data.orderId} ${data.from} → ${data.to}`, 'info');
  });

  webSocket.on('order:assigned', (data) => {
    log(`Web received assignment: ${data.orderId} → ${data.deliveryPartnerId}`, 'info');
  });

  webSocket.on('disconnect', (reason) => {
    log(`Web socket disconnected: ${reason}`, 'warning');
  });

  webSocket.on('connect', () => {
    log('Web socket reconnected', 'success');
  });
}

// Test functions
async function testConcurrentConfirm() {
  const orderId = 'concurrent-confirm-' + Date.now();
  log(`Testing concurrent confirm actions on order: ${orderId}`);

  const startTime = Date.now();

  // Simulate concurrent confirm from both platforms
  const mobilePromise = axios.patch(
    `${CONFIG.API_URL}/admin/orders/${orderId}/confirm`,
    {},
    { 
      headers: { Authorization: `Bearer ${adminToken}` },
      timeout: 5000,
    }
  ).catch((error: AxiosError) => ({
    platform: 'mobile',
    error: error.response?.status || error.code,
    message: error.response?.data?.message || error.message,
  }));

  const webPromise = axios.patch(
    `${CONFIG.API_URL}/admin/orders/${orderId}/confirm`,
    {},
    { 
      headers: { Authorization: `Bearer ${adminToken}` },
      timeout: 5000,
    }
  ).catch((error: AxiosError) => ({
    platform: 'web',
    error: error.response?.status || error.code,
    message: error.response?.data?.message || error.message,
  }));

  const [mobileResult, webResult] = await Promise.all([mobilePromise, webPromise]);
  const endTime = Date.now();

  log(`Mobile result: ${JSON.stringify(mobileResult, null, 2)}`);
  log(`Web result: ${JSON.stringify(webResult, null, 2)}`);
  log(`Total time: ${endTime - startTime}ms`);

  // Wait for socket events
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function testConcurrentAssign() {
  const orderId = 'concurrent-assign-' + Date.now();
  const partner1 = 'partner-1-' + Date.now();
  const partner2 = 'partner-2-' + Date.now();
  
  log(`Testing concurrent assignment on order: ${orderId}`);
  log(`Partner 1: ${partner1}, Partner 2: ${partner2}`);

  const startTime = Date.now();

  const assign1Promise = axios.patch(
    `${CONFIG.API_URL}/admin/orders/${orderId}/assign`,
    { deliveryBoyId: partner1 },
    { 
      headers: { Authorization: `Bearer ${adminToken}` },
      timeout: 5000,
    }
  ).catch((error: AxiosError) => ({
    partner: partner1,
    error: error.response?.status || error.code,
    message: error.response?.data?.message || error.message,
  }));

  const assign2Promise = axios.patch(
    `${CONFIG.API_URL}/admin/orders/${orderId}/assign`,
    { deliveryBoyId: partner2 },
    { 
      headers: { Authorization: `Bearer ${adminToken}` },
      timeout: 5000,
    }
  ).catch((error: AxiosError) => ({
    partner: partner2,
    error: error.response?.status || error.code,
    message: error.response?.data?.message || error.message,
  }));

  const [result1, result2] = await Promise.all([assign1Promise, assign2Promise]);
  const endTime = Date.now();

  log(`Assignment 1 result: ${JSON.stringify(result1, null, 2)}`);
  log(`Assignment 2 result: ${JSON.stringify(result2, null, 2)}`);
  log(`Total time: ${endTime - startTime}ms`);

  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function testNetworkTimeout() {
  const orderId = 'network-timeout-' + Date.now();
  log(`Testing network timeout scenario on order: ${orderId}`);

  const startTime = Date.now();

  // Test with very short timeout
  const result = await axios.patch(
    `${CONFIG.API_URL}/admin/orders/${orderId}/confirm`,
    {},
    { 
      headers: { Authorization: `Bearer ${adminToken}` },
      timeout: 1, // 1ms timeout to force error
    }
  ).catch((error: AxiosError) => ({
    error: error.code,
    message: error.message,
    isTimeout: error.code === 'ECONNABORTED',
    status: error.response?.status,
  }));

  const endTime = Date.now();

  log(`Timeout test result: ${JSON.stringify(result, null, 2)}`);
  log(`Time taken: ${endTime - startTime}ms`);
}

async function testSocketReconnection() {
  log('Testing socket reconnection scenarios...');

  // Test mobile socket reconnection
  log('Disconnecting mobile socket...');
  mobileSocket.disconnect();
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  log('Reconnecting mobile socket...');
  mobileSocket.connect();
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test event reception after reconnection
  const testOrderId = 'reconnect-test-' + Date.now();
  log(`Testing event reception after reconnection with order: ${testOrderId}`);
  
  mobileSocket.emit('order:status:changed', {
    orderId: testOrderId,
    from: 'CREATED',
    to: 'CONFIRMED',
    actorRole: 'ADMIN',
    actorId: 'reconnect-test',
    timestamp: new Date().toISOString(),
    order: createTestOrder(testOrderId),
  });

  await new Promise(resolve => setTimeout(resolve, 500));
}

async function testErrorHandling() {
  log('Testing error handling scenarios...');

  const nonExistentOrderId = 'non-existent-' + Date.now();

  // Test 404 error
  log('Testing 404 error with non-existent order...');
  const notFoundResult = await axios.patch(
    `${CONFIG.API_URL}/admin/orders/${nonExistentOrderId}/confirm`,
    {},
    { headers: { Authorization: `Bearer ${adminToken}` } }
  ).catch((error: AxiosError) => ({
    status: error.response?.status,
    message: error.response?.data?.message || error.message,
    data: error.response?.data,
  }));

  log(`404 test result: ${JSON.stringify(notFoundResult, null, 2)}`);

  // Test 401 error
  log('Testing 401 error with invalid token...');
  const unauthorizedResult = await axios.patch(
    `${CONFIG.API_URL}/admin/orders/${nonExistentOrderId}/confirm`,
    {},
    { headers: { Authorization: 'Bearer invalid-token' } }
  ).catch((error: AxiosError) => ({
    status: error.response?.status,
    message: error.response?.data?.message || error.message,
    data: error.response?.data,
  }));

  log(`401 test result: ${JSON.stringify(unauthorizedResult, null, 2)}`);

  // Test 400 error with malformed data
  log('Testing 400 error with malformed assignment data...');
  const malformedResult = await axios.patch(
    `${CONFIG.API_URL}/admin/orders/${nonExistentOrderId}/assign`,
    {}, // Missing deliveryBoyId
    { headers: { Authorization: `Bearer ${adminToken}` } }
  ).catch((error: AxiosError) => ({
    status: error.response?.status,
    message: error.response?.data?.message || error.message,
    validation: error.response?.data?.validation,
  }));

  log(`400 test result: ${JSON.stringify(malformedResult, null, 2)}`);
}

async function testLoadStress() {
  const concurrentRequests = 20;
  log(`Testing load stress with ${concurrentRequests} concurrent requests...`);

  const startTime = Date.now();

  const requests = Array.from({ length: concurrentRequests }, (_, i) =>
    axios.patch(
      `${CONFIG.API_URL}/admin/orders/load-test-${i}-${Date.now()}/confirm`,
      {},
      { 
        headers: { Authorization: `Bearer ${adminToken}` },
        timeout: 10000,
      }
    ).catch((error: AxiosError) => ({
      index: i,
      error: error.response?.status || error.code,
      message: error.response?.data?.message || error.message,
    }))
  );

  const results = await Promise.all(requests);
  const endTime = Date.now();

  log(`Load test completed in ${endTime - startTime}ms`);
  
  // Analyze results
  const successCount = results.filter(r => !('error' in r)).length;
  const errorCount = results.length - successCount;
  const errorTypes = results
    .filter(r => 'error' in r)
    .reduce((acc, r) => {
      const error = (r as any).error;
      acc[error] = (acc[error] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

  log(`Success: ${successCount}, Errors: ${errorCount}`);
  log(`Error breakdown: ${JSON.stringify(errorTypes, null, 2)}`);
}

// Main menu
async function showMenu() {
  console.log('\n' + '='.repeat(60));
  console.log('Task 8.5: Concurrent Actions and Edge Cases Test Menu');
  console.log('='.repeat(60));
  console.log('1. Test Concurrent Confirm Actions');
  console.log('2. Test Concurrent Assignment Actions');
  console.log('3. Test Network Timeout Scenarios');
  console.log('4. Test Socket Reconnection');
  console.log('5. Test Error Handling');
  console.log('6. Test Load Stress');
  console.log('7. Run All Tests');
  console.log('8. Socket Status');
  console.log('9. Exit');
  console.log('='.repeat(60));

  const choice = await prompt('Select an option (1-9): ');

  switch (choice) {
    case '1':
      await testConcurrentConfirm();
      break;
    case '2':
      await testConcurrentAssign();
      break;
    case '3':
      await testNetworkTimeout();
      break;
    case '4':
      await testSocketReconnection();
      break;
    case '5':
      await testErrorHandling();
      break;
    case '6':
      await testLoadStress();
      break;
    case '7':
      log('Running all tests...');
      await testConcurrentConfirm();
      await testConcurrentAssign();
      await testNetworkTimeout();
      await testSocketReconnection();
      await testErrorHandling();
      await testLoadStress();
      log('All tests completed!', 'success');
      break;
    case '8':
      log(`Mobile socket connected: ${mobileSocket?.connected}`);
      log(`Web socket connected: ${webSocket?.connected}`);
      break;
    case '9':
      log('Exiting...', 'info');
      cleanup();
      return;
    default:
      log('Invalid option', 'error');
  }

  // Show menu again
  await showMenu();
}

function cleanup() {
  if (mobileSocket) mobileSocket.disconnect();
  if (webSocket) webSocket.disconnect();
  if (rl) rl.close();
}

// Main execution
async function main() {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  log('Starting Task 8.5: Concurrent Actions and Edge Cases Test Suite');
  log(`API URL: ${CONFIG.API_URL}`);
  log(`Socket URL: ${CONFIG.SOCKET_URL}`);

  // Authenticate
  const authSuccess = await authenticate();
  if (!authSuccess) {
    log('Authentication failed. Please check your credentials.', 'error');
    cleanup();
    return;
  }

  // Setup sockets
  const socketSuccess = await setupSockets();
  if (!socketSuccess) {
    log('Socket setup failed. Please check your server.', 'error');
    cleanup();
    return;
  }

  // Show menu
  await showMenu();
}

// Handle process termination
process.on('SIGINT', () => {
  log('\nReceived SIGINT. Cleaning up...', 'warning');
  cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\nReceived SIGTERM. Cleaning up...', 'warning');
  cleanup();
  process.exit(0);
});

// Run the script
if (require.main === module) {
  main().catch((error) => {
    log(`Fatal error: ${error}`, 'error');
    cleanup();
    process.exit(1);
  });
}

export { main, testConcurrentConfirm, testConcurrentAssign, testNetworkTimeout, testSocketReconnection, testErrorHandling, testLoadStress };