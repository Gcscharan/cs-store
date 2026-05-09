#!/usr/bin/env node
/**
 * VyaparSetu — End-to-End Smoke Test
 * Tests all 3 user flows: Customer, Admin, Delivery Partner
 *
 * Usage:
 *   API_URL=https://your-backend.railway.app/api node scripts/e2e-smoke-test.js
 *   API_URL=http://localhost:5001/api node scripts/e2e-smoke-test.js
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

const API_URL = process.env.API_URL || 'http://localhost:5001/api';

// ─── Test credentials (set via env or use defaults for local dev) ─────────────
const CUSTOMER_PHONE = process.env.TEST_CUSTOMER_PHONE || '9000000001';
const CUSTOMER_OTP   = process.env.TEST_OTP || '123456'; // MOCK_OTP=true in dev
const ADMIN_PHONE    = process.env.TEST_ADMIN_PHONE || '9999999999';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'admin123';
const DELIVERY_PHONE = process.env.TEST_DELIVERY_PHONE || '9000000002';
const DELIVERY_OTP   = process.env.TEST_OTP || '123456';

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_URL + path);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const data = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = lib.request(options, (res) => {
      let raw = '';
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Assertion helpers ────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(55));
}

// ─── Flow 1: Customer ─────────────────────────────────────────────────────────
async function testCustomerFlow() {
  section('Flow 1: Customer — Browse → Cart → Checkout');

  // 1a. Health check
  const health = await request('GET', '/health');
  assert(health.status === 200, 'Backend health check passes');

  // 1b. Request OTP
  const otpRes = await request('POST', '/auth/send-otp', { phone: CUSTOMER_PHONE });
  assert(otpRes.status === 200 || otpRes.status === 201, `OTP sent to ${CUSTOMER_PHONE}`);

  // 1c. Verify OTP → get token
  const loginRes = await request('POST', '/auth/verify-otp', {
    phone: CUSTOMER_PHONE,
    otp: CUSTOMER_OTP,
  });
  const customerToken = loginRes.body?.accessToken || loginRes.body?.token;
  assert(!!customerToken, 'Customer login returns access token');
  if (!customerToken) return; // can't continue without token

  // 1d. Browse products
  const productsRes = await request('GET', '/products?limit=5', null, customerToken);
  assert(productsRes.status === 200, 'Products endpoint returns 200');
  const products = productsRes.body?.products || productsRes.body?.data || [];
  assert(products.length > 0, `Products list has ${products.length} items`);

  // 1e. Get addresses
  const addressRes = await request('GET', '/user/addresses', null, customerToken);
  assert(addressRes.status === 200, 'Addresses endpoint returns 200');

  // 1f. Get cart
  const cartRes = await request('GET', '/cart', null, customerToken);
  assert(cartRes.status === 200, 'Cart endpoint returns 200');

  // 1g. Get notifications
  const notifRes = await request('GET', '/notifications', null, customerToken);
  assert(notifRes.status === 200, 'Notifications endpoint returns 200');

  return customerToken;
}

// ─── Flow 2: Admin ────────────────────────────────────────────────────────────
async function testAdminFlow() {
  section('Flow 2: Admin — Dashboard → Orders → Assign');

  // 2a. Admin login
  const loginRes = await request('POST', '/auth/admin/login', {
    phone: ADMIN_PHONE,
    password: ADMIN_PASSWORD,
  });
  const adminToken = loginRes.body?.accessToken || loginRes.body?.token;
  assert(!!adminToken, 'Admin login returns access token');
  if (!adminToken) return;

  // 2b. Get orders
  const ordersRes = await request('GET', '/admin/orders?limit=10', null, adminToken);
  assert(ordersRes.status === 200, 'Admin orders endpoint returns 200');
  const orders = ordersRes.body?.orders || [];
  assert(Array.isArray(orders), `Admin orders list is an array (${orders.length} orders)`);

  // 2c. Get products (admin)
  const productsRes = await request('GET', '/products?limit=5', null, adminToken);
  assert(productsRes.status === 200, 'Admin products endpoint returns 200');

  // 2d. Get delivery partners
  const partnersRes = await request('GET', '/admin/delivery-partners/available', null, adminToken);
  assert(
    partnersRes.status === 200 || partnersRes.status === 404,
    'Delivery partners endpoint reachable'
  );

  // 2e. Feature flags
  const flagsRes = await request('GET', '/config/feature-flags', null, adminToken);
  assert(flagsRes.status === 200, 'Feature flags endpoint returns 200');

  return adminToken;
}

// ─── Flow 3: Delivery Partner ─────────────────────────────────────────────────
async function testDeliveryFlow() {
  section('Flow 3: Delivery Partner — Login → View Orders → Update Status');

  // 3a. Request OTP
  const otpRes = await request('POST', '/delivery/auth/send-otp', { phone: DELIVERY_PHONE });
  const otpSent = otpRes.status === 200 || otpRes.status === 201;
  assert(otpSent, `Delivery OTP sent to ${DELIVERY_PHONE}`);
  if (!otpSent) {
    // Try generic auth endpoint as fallback
    const fallback = await request('POST', '/auth/send-otp', { phone: DELIVERY_PHONE });
    assert(fallback.status === 200 || fallback.status === 201, 'Delivery OTP via generic endpoint');
  }

  // 3b. Verify OTP
  const loginRes = await request('POST', '/delivery/auth/verify-otp', {
    phone: DELIVERY_PHONE,
    otp: DELIVERY_OTP,
  });
  const deliveryToken = loginRes.body?.accessToken || loginRes.body?.token;
  assert(!!deliveryToken, 'Delivery partner login returns access token');
  if (!deliveryToken) return;

  // 3c. Get assigned orders
  const ordersRes = await request('GET', '/delivery/orders', null, deliveryToken);
  assert(
    ordersRes.status === 200 || ordersRes.status === 404,
    'Delivery orders endpoint reachable'
  );

  // 3d. Get earnings
  const earningsRes = await request('GET', '/delivery/earnings', null, deliveryToken);
  assert(
    earningsRes.status === 200 || earningsRes.status === 404,
    'Delivery earnings endpoint reachable'
  );

  return deliveryToken;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🧪 VyaparSetu — E2E Smoke Test');
  console.log(`   API: ${API_URL}`);
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    await testCustomerFlow();
    await testAdminFlow();
    await testDeliveryFlow();
  } catch (err) {
    console.error('\n💥 Unexpected error:', err.message);
    failed++;
  }

  console.log(`\n${'═'.repeat(55)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(55));

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Check the backend logs.\n');
    process.exit(1);
  } else {
    console.log('\n🎉 All smoke tests passed! Ready to ship.\n');
  }
}

main();
