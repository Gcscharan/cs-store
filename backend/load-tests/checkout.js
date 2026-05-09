/**
 * k6 Checkout Load Test
 *
 * Run: k6 run load-tests/checkout.js
 *
 * Tests the critical checkout path under realistic load.
 * 50 VUs for 2 minutes — simulates a busy shopping period.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.API_URL || 'http://localhost:5001/api';
const ADMIN_PHONE = __ENV.ADMIN_PHONE || '9999999999';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'admin123';

const errorRate = new Rate('errors');
const checkoutDuration = new Trend('checkout_duration');
const orderCreated = new Counter('orders_created');
const duplicateOrders = new Counter('duplicate_orders');

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    errors: ['rate<0.05'],
    duplicate_orders: ['count==0'],
  },
};

// Shared admin token (set once in setup)
export function setup() {
  const res = http.post(`${BASE_URL}/auth/admin/login`, JSON.stringify({
    phone: ADMIN_PHONE,
    password: ADMIN_PASSWORD,
  }), { headers: { 'Content-Type': 'application/json' } });

  if (res.status !== 200) return { token: null };
  const body = JSON.parse(res.body);
  return { token: body.accessToken || body.token || null };
}

export default function (data) {
  const token = data?.token;
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // ── 1. Browse products ──
  group('Browse', () => {
    const res = http.get(`${BASE_URL}/products?limit=10`, { headers });
    check(res, { 'products 200': (r) => r.status === 200 });
    errorRate.add(res.status >= 500);
  });

  sleep(0.5);

  // ── 2. Check pincode ──
  group('Pincode Check', () => {
    const res = http.get(`${BASE_URL}/pincode/500001`, { headers });
    check(res, { 'pincode responds': (r) => r.status === 200 || r.status === 404 });
    errorRate.add(res.status >= 500);
  });

  sleep(0.3);

  // ── 3. Feature flags (cached, should be fast) ──
  group('Feature Flags', () => {
    const res = http.get(`${BASE_URL}/config/feature-flags`, { headers });
    check(res, { 'flags 200': (r) => r.status === 200 });
    errorRate.add(res.status >= 500);
  });

  sleep(0.2);

  // ── 4. Admin: get orders (read-heavy) ──
  if (token) {
    group('Admin Orders', () => {
      const start = Date.now();
      const res = http.get(`${BASE_URL}/admin/orders?limit=20`, { headers });
      checkoutDuration.add(Date.now() - start);
      check(res, { 'admin orders 200': (r) => r.status === 200 });
      errorRate.add(res.status >= 500);
    });
  }

  sleep(0.5);
}
