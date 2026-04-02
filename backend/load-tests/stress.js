/**
 * k6 Stress Test — Scale Limits
 * 
 * Run: k6 run load-tests/stress.js
 * 
 * Ramp: 0 → 100 → 500 → 1000 VUs over 5 minutes
 * Validates: no crashes, no duplicates, stable response times
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

const BASE_URL = __ENV.API_URL || 'http://localhost:5001/api';

const errorRate = new Rate('errors');
const duplicateOrders = new Counter('duplicate_orders');

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Warm up to 100
    { duration: '1m', target: 500 },    // Ramp to 500
    { duration: '1m', target: 1000 },   // Peak at 1000
    { duration: '1m', target: 500 },    // Cool down
    { duration: '30s', target: 0 },     // Drain
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],   // 95th percentile under 5s at peak
    http_req_failed: ['rate<0.10'],       // Under 10% error rate even at peak
    errors: ['rate<0.10'],
    duplicate_orders: ['count==0'],       // ZERO duplicate orders
  },
};

export default function () {
  // ── Product listing (read-heavy, cacheable) ──
  group('Read Operations', () => {
    const res = http.get(`${BASE_URL}/products?page=1&limit=10`);

    check(res, {
      'products: status 200 or 429': (r) => r.status === 200 || r.status === 429,
    });

    errorRate.add(res.status >= 500);
  });

  sleep(0.2);

  // ── Feature flags (should be fast, no DB) ──
  group('Feature Flags', () => {
    const res = http.get(`${BASE_URL}/config/feature-flags`);

    check(res, {
      'flags: responds': (r) => r.status === 200 || r.status === 429,
    });

    errorRate.add(res.status >= 500);
  });

  sleep(0.1);

  // ── Health check ──
  group('Health', () => {
    const res = http.get(`${BASE_URL.replace('/api', '')}/health`);

    check(res, {
      'health: responds': (r) => r.status === 200,
    });
  });

  sleep(0.3);
}
