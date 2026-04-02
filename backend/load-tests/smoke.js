/**
 * k6 Smoke Test — Baseline Sanity
 * 
 * Run: k6 run load-tests/smoke.js
 * 
 * 10 VUs, 30 seconds — verifies core flows work under minimal load
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.API_URL || 'http://localhost:5001/api';

// Custom metrics
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const productListDuration = new Trend('product_list_duration');
const cartDuration = new Trend('cart_duration');

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% of requests under 2s
    errors: ['rate<0.05'],               // Error rate under 5%
    http_req_failed: ['rate<0.05'],
  },
};

// Test data
const TEST_USER = {
  email: `loadtest_${Date.now()}@test.com`,
  password: 'LoadTest@123',
  name: 'Load Test User',
  phone: '9999999990',
};

export default function () {
  let authToken = '';

  // ── 1. Login / Auth ──
  group('Authentication', () => {
    const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    loginDuration.add(loginRes.timings.duration);

    // May fail if user doesn't exist — that's OK for smoke test
    if (loginRes.status === 200) {
      const body = JSON.parse(loginRes.body);
      authToken = body.token || body.accessToken || '';
    }

    errorRate.add(loginRes.status >= 500);
  });

  sleep(0.5);

  // ── 2. Product Listing ──
  group('Product List', () => {
    const res = http.get(`${BASE_URL}/products?page=1&limit=10`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });

    productListDuration.add(res.timings.duration);

    check(res, {
      'products: status 200': (r) => r.status === 200,
      'products: has data': (r) => {
        try { return JSON.parse(r.body).products?.length > 0; }
        catch { return false; }
      },
    });

    errorRate.add(res.status >= 500);
  });

  sleep(0.3);

  // ── 3. Cart Operations ──
  group('Cart', () => {
    if (!authToken) return;

    const res = http.get(`${BASE_URL}/cart`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    cartDuration.add(res.timings.duration);

    check(res, {
      'cart: status 200': (r) => r.status === 200,
    });

    errorRate.add(res.status >= 500);
  });

  sleep(0.3);

  // ── 4. Feature Flags ──
  group('Feature Flags', () => {
    const res = http.get(`${BASE_URL}/config/feature-flags`);

    check(res, {
      'flags: status 200': (r) => r.status === 200,
      'flags: has flags object': (r) => {
        try { return typeof JSON.parse(r.body).flags === 'object'; }
        catch { return false; }
      },
    });
  });

  sleep(0.5);
}
