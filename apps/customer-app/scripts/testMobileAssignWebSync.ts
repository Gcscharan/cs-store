#!/usr/bin/env ts-node

/**
 * Task 8.3: Manual Test Script - Mobile Assign → Web Updates Instantly
 * 
 * Interactive test script to verify mobile admin assignment actions
 * update web admin within 1 second.
 * 
 * Usage: npm run test:mobile-assign-web-sync
 * 
 * Requirements: 4.1, 7.1
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
};

// Test state
let adminToken: string;
let mobileSocket: Socket;
let webSocket: Socket;
let rl: readline.Interface;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  log(`✅ ${message}`, 'green');
}

function logError(message: string) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, 'yellow');
}

function logTiming(message: string, timeMs: number) {
  const color = timeMs < 1000 ? 'green' : timeMs < 2000 ? 'yellow' : 'red';
  log(`⏱️  ${message}: ${timeMs}ms`, color);
}

async function authenticate(): Promise<void> {
  try {
    logInfo('Authenticating as admin...');
    
    const response = await axios.post(`${CONFIG.API_URL}/auth/admin/login`, {
      phone: CONFIG.ADMIN_PHONE,
      password: CONFIG.ADMIN_PASSWORD,
    });

    adminToken = response.data.accessToken;
    
    if (!adminToken) {
      throw new Error('No access token received');
    }

    logSuccess('Admin authentication successful');
  } catch (error: any) {
    logError(`Admin authentication failed: ${error.message}`);
    throw error;
  }
}

async function setupSockets(): Promise<void> {
  return new Promise((resolve, reject) => {
    let mobileConnected = false;
    let webConnected = false;

    logInfo('Setting up socket connections...');

    // Setup mobile admin socket
    mobileSocket = io(CONFIG.SOCKET_URL, {
      auth: { token: adminToken },
      transports: ['websocket'],
    });

    // Setup web admin socket
    webSocket = io(CONFIG.SOCKET_URL, {
      auth: { token: adminToken },
      transports: ['websocket'],
    });

    mobileSocket.on('connect', () => {
      logSuccess('Mobile admin socket connected');
      mobileConnected = true;
      if (webConnected) resolve();
    });

    webSocket.on('connect', () => {
      logSuccess('Web admin socket connected');
      webConnected = true;
      if (mobileConnected) resolve();
    });

    mobileSocket.on('connect_error', (error) => {
      logError(`Mobile socket connection error: ${error.message}`);
      reject(error);
    });

    webSocket.on('connect_error', (error) => {
      logError(`Web socket connection error: ${error.message}`);
      reject(error);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!mobileConnected || !webConnected) {
        reject(new Error('Socket connection timeout'));
      }
    }, 10000);
  });
}

async function getAvailableOrders(): Promise<any[]> {
  try {
    logInfo('Fetching available orders...');
    
    const response = await axios.get(`${CONFIG.API_URL}/admin/orders`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const orders = response.data.orders || response.data;
    const assignableOrders = orders.filter((order: any) => 
      order.allowedActions?.includes('ASSIGN') || order.status === 'PACKED'
    );

    logInfo(`Found ${assignableOrders.length} assignable orders`);
    return assignableOrders;
  } catch (error: any) {
    logError(`Failed to fetch orders: ${error.message}`);
    throw error;
  }
}

async function getAvailableDeliveryPartners(): Promise<any[]> {
  try {
    logInfo('Fetching available delivery partners...');
    
    const response = await axios.get(`${CONFIG.API_URL}/admin/delivery-partners/available`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const partners = response.data.deliveryPartners || response.data;
    logInfo(`Found ${partners.length} available delivery partners`);
    return partners;
  } catch (error: any) {
    logError(`Failed to fetch delivery partners: ${error.message}`);
    throw error;
  }
}

async function testAssignmentSync(orderId: string, partnerId: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    let webAdminReceived = false;
    let assignmentData: any = null;

    logInfo(`Testing assignment sync for order ${orderId} with partner ${partnerId}`);

    // Setup web admin listener
    webSocket.on('order:assigned', (data) => {
      const receiveTime = Date.now();
      const syncTime = receiveTime - startTime;
      
      if (data.orderId === orderId) {
        webAdminReceived = true;
        assignmentData = data;
        
        logTiming('Web admin received assignment event', syncTime);
        
        if (syncTime < 1000) {
          logSuccess('✅ Sync time requirement met (< 1 second)');
        } else {
          logWarning('⚠️ Sync time requirement NOT met (>= 1 second)');
        }

        // Verify data structure
        if (data.deliveryPartner && data.order) {
          logSuccess('Assignment data structure is complete');
        } else {
          logWarning('Assignment data structure is incomplete');
        }

        resolve();
      }
    });

    try {
      // Perform mobile admin assignment
      logInfo('Performing mobile admin assignment...');
      
      const apiStartTime = Date.now();
      const response = await axios.patch(
        `${CONFIG.API_URL}/admin/orders/${orderId}/assign`,
        { deliveryBoyId: partnerId },
        {
          headers: { Authorization: `Bearer ${adminToken}` },
          timeout: 5000,
        }
      );

      const apiTime = Date.now() - apiStartTime;
      logTiming('API call completed', apiTime);

      if (response.status === 200) {
        logSuccess('Assignment API call successful');
        
        if (response.data.order) {
          logSuccess('API response includes complete order object');
        } else {
          logWarning('API response missing complete order object');
        }
      } else {
        logError(`Assignment API call failed with status ${response.status}`);
        reject(new Error(`API call failed: ${response.status}`));
        return;
      }

      // Wait for web admin to receive socket event
      setTimeout(() => {
        if (!webAdminReceived) {
          logError('Web admin did not receive assignment event within timeout');
          reject(new Error('Socket event not received'));
        }
      }, 2000);

    } catch (error: any) {
      logError(`Assignment API call failed: ${error.message}`);
      reject(error);
    }
  });
}

async function runInteractiveTest(): Promise<void> {
  try {
    // Setup
    await authenticate();
    await setupSockets();

    const orders = await getAvailableOrders();
    const partners = await getAvailableDeliveryPartners();

    if (orders.length === 0) {
      logError('No assignable orders found. Please create orders with PACKED status.');
      return;
    }

    if (partners.length === 0) {
      logError('No delivery partners available. Please ensure delivery partners are registered.');
      return;
    }

    // Interactive menu
    while (true) {
      console.log('\n' + '='.repeat(60));
      log('📱 Mobile Assign → Web Sync Test Menu', 'cyan');
      console.log('='.repeat(60));
      
      console.log('1. Test assignment synchronization');
      console.log('2. Test rapid assignments (load test)');
      console.log('3. Test socket reconnection');
      console.log('4. View available orders');
      console.log('5. View available delivery partners');
      console.log('6. Exit');
      
      const choice = await askQuestion('\nSelect an option (1-6): ');

      switch (choice.trim()) {
        case '1':
          await testSingleAssignment(orders, partners);
          break;
        case '2':
          await testRapidAssignments(orders, partners);
          break;
        case '3':
          await testSocketReconnection(orders, partners);
          break;
        case '4':
          displayOrders(orders);
          break;
        case '5':
          displayDeliveryPartners(partners);
          break;
        case '6':
          logInfo('Exiting test suite...');
          return;
        default:
          logWarning('Invalid option. Please select 1-6.');
      }
    }
  } catch (error: any) {
    logError(`Test suite failed: ${error.message}`);
    throw error;
  }
}

async function testSingleAssignment(orders: any[], partners: any[]): Promise<void> {
  console.log('\n📋 Available Orders:');
  orders.forEach((order, index) => {
    console.log(`${index + 1}. Order #${order.orderNumber || order._id.slice(-6)} (${order.status})`);
  });

  const orderChoice = await askQuestion('Select order number: ');
  const orderIndex = parseInt(orderChoice) - 1;

  if (orderIndex < 0 || orderIndex >= orders.length) {
    logError('Invalid order selection');
    return;
  }

  console.log('\n🚚 Available Delivery Partners:');
  partners.forEach((partner, index) => {
    console.log(`${index + 1}. ${partner.name} (${partner.vehicleType || 'Unknown vehicle'})`);
  });

  const partnerChoice = await askQuestion('Select delivery partner number: ');
  const partnerIndex = parseInt(partnerChoice) - 1;

  if (partnerIndex < 0 || partnerIndex >= partners.length) {
    logError('Invalid delivery partner selection');
    return;
  }

  const selectedOrder = orders[orderIndex];
  const selectedPartner = partners[partnerIndex];

  logInfo(`Testing assignment: Order ${selectedOrder._id} → Partner ${selectedPartner.name}`);

  try {
    await testAssignmentSync(selectedOrder._id, selectedPartner._id);
    logSuccess('Single assignment test completed successfully');
  } catch (error: any) {
    logError(`Single assignment test failed: ${error.message}`);
  }
}

async function testRapidAssignments(orders: any[], partners: any[]): Promise<void> {
  const numTests = Math.min(3, orders.length);
  logInfo(`Testing ${numTests} rapid assignments...`);

  const startTime = Date.now();
  const promises: Promise<void>[] = [];

  for (let i = 0; i < numTests; i++) {
    const order = orders[i];
    const partner = partners[i % partners.length];
    promises.push(testAssignmentSync(order._id, partner._id));
  }

  try {
    await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    logTiming('All rapid assignments completed', totalTime);
    logSuccess('Rapid assignments test completed successfully');
  } catch (error: any) {
    logError(`Rapid assignments test failed: ${error.message}`);
  }
}

async function testSocketReconnection(orders: any[], partners: any[]): Promise<void> {
  if (orders.length === 0 || partners.length === 0) {
    logError('Need at least one order and one partner for reconnection test');
    return;
  }

  logInfo('Testing socket reconnection scenario...');

  // Disconnect web socket
  logInfo('Disconnecting web admin socket...');
  webSocket.disconnect();

  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Reconnect
  logInfo('Reconnecting web admin socket...');
  webSocket.connect();

  // Wait for reconnection
  await new Promise((resolve) => {
    webSocket.on('connect', () => {
      logSuccess('Web admin socket reconnected');
      resolve(true);
    });
  });

  // Test assignment after reconnection
  const order = orders[0];
  const partner = partners[0];

  try {
    await testAssignmentSync(order._id, partner._id);
    logSuccess('Socket reconnection test completed successfully');
  } catch (error: any) {
    logError(`Socket reconnection test failed: ${error.message}`);
  }
}

function displayOrders(orders: any[]): void {
  console.log('\n📋 Available Orders:');
  console.log('-'.repeat(80));
  orders.forEach((order, index) => {
    console.log(`${index + 1}. Order #${order.orderNumber || order._id.slice(-6)}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Customer: ${order.userId?.name || order.user?.name || 'Unknown'}`);
    console.log(`   Total: ₹${order.totalAmount || 0}`);
    console.log(`   Allowed Actions: ${order.allowedActions?.join(', ') || 'None'}`);
    console.log('-'.repeat(80));
  });
}

function displayDeliveryPartners(partners: any[]): void {
  console.log('\n🚚 Available Delivery Partners:');
  console.log('-'.repeat(80));
  partners.forEach((partner, index) => {
    console.log(`${index + 1}. ${partner.name}`);
    console.log(`   Phone: ${partner.phone || 'N/A'}`);
    console.log(`   Vehicle: ${partner.vehicleType || 'Unknown'}`);
    console.log(`   Current Load: ${partner.currentLoad || 0} orders`);
    console.log(`   Available: ${partner.isAvailable !== false ? 'Yes' : 'No'}`);
    console.log('-'.repeat(80));
  });
}

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function cleanup(): Promise<void> {
  logInfo('Cleaning up...');
  
  if (mobileSocket) {
    mobileSocket.removeAllListeners();
    mobileSocket.disconnect();
  }
  
  if (webSocket) {
    webSocket.removeAllListeners();
    webSocket.disconnect();
  }
  
  if (rl) {
    rl.close();
  }
}

// Main execution
async function main(): Promise<void> {
  // Setup readline interface
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    log('🧪 Mobile Assign → Web Sync Test Suite', 'bright');
    log('Testing Requirements: 4.1, 7.1', 'cyan');
    console.log('='.repeat(60));

    await runInteractiveTest();
  } catch (error: any) {
    logError(`Test suite failed: ${error.message}`);
    process.exit(1);
  } finally {
    await cleanup();
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log('\n');
  logInfo('Received SIGINT, cleaning up...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logInfo('Received SIGTERM, cleaning up...');
  await cleanup();
  process.exit(0);
});

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    logError(`Fatal error: ${error.message}`);
    process.exit(1);
  });
}

export { main as testMobileAssignWebSync };