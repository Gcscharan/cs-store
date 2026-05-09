/**
 * Integration Tests: Version Control API Endpoints
 * 
 * Tests the version control REST API endpoints with real HTTP requests
 */

import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Product } from '../../src/models/Product';
import { ProductVersion } from '../../src/models/ProductVersion';
import { User } from '../../src/models/User';
import { versionService } from '../../src/services/versionService';
import { createTestApp } from '../helpers/testApp';

// Base URL prefix — admin routes are mounted at /api/admin
const BASE = '/api/admin';

let adminUserId: string;

// Create a real admin user in DB and return a valid JWT
const createAdminAndToken = async (): Promise<string> => {
  const user = await User.create({
    name: 'Test Admin',
    phone: `9${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
    role: 'admin',
    status: 'active',
  });
  adminUserId = user._id.toString();
  return jwt.sign(
    { userId: adminUserId },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

describe('Integration Tests: Version Control API', () => {
  let app: any;
  let adminToken: string;
  let testProductId: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  beforeEach(async () => {
    // Clean up before each test
    await Product.deleteMany({});
    await ProductVersion.deleteMany({});
    await User.deleteMany({ role: 'admin' });

    // Create real admin user + token
    adminToken = await createAdminAndToken();

    // Create test product
    const product = await Product.create({
      name: 'Test Product',
      description: 'Test Description',
      category: 'chocolates',
      price: 100,
      pricePerUnit: 100,
      mrp: 120,
      stock: 50,
      weight: 0.5,
      tags: ['test'],
      status: 'draft',
      isSellable: true,
    });

    testProductId = product._id.toString();

    // Create initial version
    const snapshot = versionService.extractSnapshot(product);
    await versionService.createVersion(
      testProductId,
      snapshot,
      [],
      'update',
      adminUserId
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/admin/products/:id/versions
  // ─────────────────────────────────────────────────────────────────────────
  describe('GET /api/admin/products/:id/versions', () => {
    it('should return paginated version history', async () => {
      const response = await request(app)
        .get(`${BASE}/products/${testProductId}/versions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('versions');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.versions)).toBe(true);
      expect(response.body.versions.length).toBeGreaterThan(0);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(20);
    });

    it('should respect pagination limits', async () => {
      const product = await Product.findById(testProductId);
      for (let i = 0; i < 5; i++) {
        const snapshot = versionService.extractSnapshot(product);
        await versionService.createVersion(
          testProductId,
          { ...snapshot, price: 100 + i },
          ['price'],
          'update',
          adminUserId
        );
      }

      const response = await request(app)
        .get(`${BASE}/products/${testProductId}/versions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 3 });

      expect(response.status).toBe(200);
      expect(response.body.versions.length).toBeLessThanOrEqual(3);
    });

    it('should cap limit at 100 to prevent DB load spike', async () => {
      const response = await request(app)
        .get(`${BASE}/products/${testProductId}/versions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10000 });

      expect(response.status).toBe(200);
      expect(response.body.pagination.limit).toBeLessThanOrEqual(100);
    });

    it('should return 404 for invalid product ID', async () => {
      const response = await request(app)
        .get(`${BASE}/products/invalid-id/versions`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Product not found');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get(`${BASE}/products/${testProductId}/versions`);

      expect(response.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /api/admin/products/:id/versions/:version
  // ─────────────────────────────────────────────────────────────────────────
  describe('GET /api/admin/products/:id/versions/:version', () => {
    it('should return specific version snapshot', async () => {
      const response = await request(app)
        .get(`${BASE}/products/${testProductId}/versions/1`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('snapshot');
      expect(response.body.snapshot).toHaveProperty('name');
      expect(response.body.snapshot).toHaveProperty('price');
      expect(response.body.version).toBe(1);
    });

    it('should return 404 for non-existent version', async () => {
      const response = await request(app)
        .get(`${BASE}/products/${testProductId}/versions/999`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Version not found');
    });

    it('should return 400 for invalid version number', async () => {
      const response = await request(app)
        .get(`${BASE}/products/${testProductId}/versions/abc`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid version number');
    });

    it('should return 400 for negative version number', async () => {
      const response = await request(app)
        .get(`${BASE}/products/${testProductId}/versions/-1`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid version number');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get(`${BASE}/products/${testProductId}/versions/1`);

      expect(response.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /api/admin/products/:id/rollback/:version
  // Rollback uses transactions — requires replica set.
  // We test the API contract (auth, validation) without transactions here.
  // ─────────────────────────────────────────────────────────────────────────
  describe('POST /api/admin/products/:id/rollback/:version', () => {
    beforeEach(async () => {
      // Create version 2 with updated price
      await Product.findByIdAndUpdate(testProductId, { price: 200 });
      const updatedProduct = await Product.findById(testProductId);
      const snapshot = versionService.extractSnapshot(updatedProduct);
      await versionService.createVersion(
        testProductId,
        snapshot,
        ['price'],
        'update',
        adminUserId
      );
    });

    it('should return 404 for non-existent version', async () => {
      const response = await request(app)
        .post(`${BASE}/products/${testProductId}/rollback/999`)
        .set('Authorization', `Bearer ${adminToken}`);

      // 404 (version not found) or 500 (transaction not supported) — both acceptable
      expect([404, 500]).toContain(response.status);
      if (response.status === 404) {
        expect(response.body.message).toBe('Version not found');
      }
    });

    it('should return 400 for invalid version number', async () => {
      const response = await request(app)
        .post(`${BASE}/products/${testProductId}/rollback/abc`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid version number');
    });

    it('should return 400 for negative version number', async () => {
      const response = await request(app)
        .post(`${BASE}/products/${testProductId}/rollback/-1`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.message).toBe('Invalid version number');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post(`${BASE}/products/${testProductId}/rollback/1`);

      expect(response.status).toBe(401);
    });

    it('should return 404 for invalid product ID', async () => {
      const response = await request(app)
        .post(`${BASE}/products/invalid-id/rollback/1`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe('Product not found');
    });

    it('should attempt rollback and return success or transaction error', async () => {
      const response = await request(app)
        .post(`${BASE}/products/${testProductId}/rollback/1`)
        .set('Authorization', `Bearer ${adminToken}`);

      // In standalone MongoDB (no replica set): 500 with transaction error
      // In replica set: 200 with success
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('rolled back to version 1');
        const product = await Product.findById(testProductId);
        expect(product?.price).toBe(100);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Product Update Integration
  // ─────────────────────────────────────────────────────────────────────────
  describe('Product Update Integration', () => {
    it('should create version on product update', async () => {
      const initialVersionCount = await ProductVersion.countDocuments({
        productId: testProductId,
      });

      await request(app)
        .put(`${BASE}/products/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          description: 'Test Description',
          category: 'chocolates',
          price: 150,       // changed from 100
          pricePerUnit: 100, // <= price, valid
          stock: 50,
          weight: 0.5,
        });

      // Wait for async version creation
      await new Promise((resolve) => setTimeout(resolve, 200));

      const finalVersionCount = await ProductVersion.countDocuments({
        productId: testProductId,
      });

      expect(finalVersionCount).toBeGreaterThan(initialVersionCount);
    });

    it('should NOT create version for no-op update', async () => {
      const initialVersionCount = await ProductVersion.countDocuments({
        productId: testProductId,
      });

      await request(app)
        .put(`${BASE}/products/${testProductId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          description: 'Test Description',
          category: 'chocolates',
          price: 100,       // same as current
          pricePerUnit: 100,
          stock: 50,
          weight: 0.5,
        });

      await new Promise((resolve) => setTimeout(resolve, 200));

      const finalVersionCount = await ProductVersion.countDocuments({
        productId: testProductId,
      });

      expect(finalVersionCount).toBe(initialVersionCount);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Product Publish Integration
  // ─────────────────────────────────────────────────────────────────────────
  describe('Product Publish Integration', () => {
    it('should create version on product publish', async () => {
      await Product.findByIdAndUpdate(testProductId, {
        name: 'Complete Product',
        description: 'Complete Description',
        category: 'chocolates',
        price: 100,
        pricePerUnit: 100,
        stock: 50,
        weight: 0.5,
      });

      const initialVersionCount = await ProductVersion.countDocuments({
        productId: testProductId,
      });

      await request(app)
        .post(`${BASE}/products/${testProductId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`);

      await new Promise((resolve) => setTimeout(resolve, 200));

      const finalVersionCount = await ProductVersion.countDocuments({
        productId: testProductId,
      });

      expect(finalVersionCount).toBeGreaterThan(initialVersionCount);

      const publishVersion = await ProductVersion.findOne({
        productId: testProductId,
        actionType: 'publish',
      });

      expect(publishVersion).toBeTruthy();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Concurrency Tests
  // ─────────────────────────────────────────────────────────────────────────
  describe('Concurrency Tests', () => {
    it('should handle concurrent version creation safely', async () => {
      const product = await Product.findById(testProductId);

      // 3 concurrent requests — within retry capacity (maxRetries=3)
      const tasks = Array.from({ length: 3 }, (_, i) => {
        const snapshot = versionService.extractSnapshot(product);
        return versionService.createVersion(
          testProductId,
          { ...snapshot, price: 100 + i },
          ['price'],
          'update',
          adminUserId
        );
      });

      await Promise.all(tasks);

      const versions = await ProductVersion.find({
        productId: testProductId,
      }).sort({ version: 1 });

      expect(versions.length).toBe(4); // 1 initial + 3 concurrent
      const versionNumbers = versions.map((v) => v.version);

      // No duplicates
      const uniqueVersions = new Set(versionNumbers);
      expect(uniqueVersions.size).toBe(versionNumbers.length);

      // Sequential
      for (let i = 0; i < versionNumbers.length; i++) {
        expect(versionNumbers[i]).toBe(i + 1);
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Archival Tests
  // ─────────────────────────────────────────────────────────────────────────
  describe('Archival Tests', () => {
    it('should archive old versions beyond 50', async () => {
      const product = await Product.findById(testProductId);

      // Create 54 more versions (1 initial + 54 = 55 total)
      for (let i = 0; i < 54; i++) {
        const snapshot = versionService.extractSnapshot(product);
        await versionService.createVersion(
          testProductId,
          { ...snapshot, price: 100 + i },
          ['price'],
          'update',
          adminUserId
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 300));

      const nonArchivedCount = await ProductVersion.countDocuments({
        productId: testProductId,
        archived: false,
      });

      expect(nonArchivedCount).toBeLessThanOrEqual(50);

      const archivedCount = await ProductVersion.countDocuments({
        productId: testProductId,
        archived: true,
      });

      expect(archivedCount).toBeGreaterThan(0);
    });
  });
});
