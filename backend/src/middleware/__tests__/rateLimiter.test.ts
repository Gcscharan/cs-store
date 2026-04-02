/**
 * Rate Limiter Tests
 * 
 * Minimal tests to verify rate limiting behavior
 */

import request from 'supertest';
import express from 'express';
import { pincodeRateLimiter } from '../rateLimiter';

describe('Rate Limiter', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create test app with rate limiter
    app = express();
    app.get('/test', pincodeRateLimiter, (req, res) => {
      res.status(200).json({ success: true });
    });
  });

  it('should allow requests within limit', async () => {
    // Make 5 requests (well within 100 limit)
    for (let i = 0; i < 5; i++) {
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    }
  });

  it('should include rate limit headers', async () => {
    const response = await request(app).get('/test');

    expect(response.headers).toHaveProperty('ratelimit-limit');
    expect(response.headers).toHaveProperty('ratelimit-remaining');
    expect(response.headers).toHaveProperty('ratelimit-reset');
  });

  it('should return 429 after exceeding limit', async () => {
    // Make 101 requests to exceed limit
    for (let i = 0; i < 100; i++) {
      await request(app).get('/test');
    }

    // 101st request should be rate limited
    const response = await request(app).get('/test');

    expect(response.status).toBe(429);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Too many requests, please try again later');
  });

  it('should have correct rate limit values in headers', async () => {
    const response = await request(app).get('/test');

    expect(response.headers['ratelimit-limit']).toBe('100');
    expect(parseInt(response.headers['ratelimit-remaining'])).toBeLessThanOrEqual(100);
  });
});
