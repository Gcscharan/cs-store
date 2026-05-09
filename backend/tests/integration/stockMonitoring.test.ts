/**
 * Integration test for stock monitoring in product updates
 * Requirements: 1.1, 1.4 (Low Stock Notification System)
 */

import request from 'supertest';
import app from '../helpers/testApp';
import LowStockNotification from '../../src/models/LowStockNotification';
import { stockMonitorService } from '../../src/services/stockMonitorService';
import { createTestAdmin, getAuthHeadersForAdmin } from '../helpers/auth';
import '../types/global.d.ts';

describe('Stock Monitoring Integration', () => {
  let adminHeaders: any;

  beforeAll(async () => {
    const admin = await createTestAdmin();
    adminHeaders = getAuthHeadersForAdmin(admin);
  });

  beforeEach(async () => {
    // Clean up notifications before each test
    await LowStockNotification.deleteMany({});
  });

  describe('Product Update with Stock Monitoring', () => {
    it('should trigger stock monitoring when stock is updated to low level', async () => {
      // Create a test product
      const product = await global.createTestProduct({
        name: 'Test Product Low Stock',
        price: 100,
        stock: 50,
        category: 'groceries',
      });

      // Update product stock to low level (below threshold of 10)
      const response = await request(app)
        .put(`/api/admin/products/${product._id}`)
        .set(adminHeaders)
        .send({ stock: 8 });

      expect(response.status).toBe(200);
      expect(response.body.product.stock).toBe(8);

      // Wait for async stock monitoring to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify notification was created
      const notifications = await LowStockNotification.find({ productId: product._id });
      expect(notifications.length).toBe(1);
      expect(notifications[0].currentStock).toBe(8);
      expect(notifications[0].priority).toBe('LOW');
    });

    it('should not create notification when stock is above threshold', async () => {
      // Create a test product
      const product = await global.createTestProduct({
        name: 'Test Product High Stock',
        price: 100,
        stock: 50,
        category: 'groceries',
      });

      // Update product stock to level above threshold
      const response = await request(app)
        .put(`/api/admin/products/${product._id}`)
        .set(adminHeaders)
        .send({ stock: 15 });

      expect(response.status).toBe(200);
      expect(response.body.product.stock).toBe(15);

      // Wait for async stock monitoring to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify no notification was created
      const notifications = await LowStockNotification.find({ productId: product._id });
      expect(notifications.length).toBe(0);
    });

    it('should handle stock monitoring errors gracefully without blocking product update', async () => {
      // Create a test product
      const product = await global.createTestProduct({
        name: 'Test Product Error Handling',
        price: 100,
        stock: 50,
        category: 'groceries',
      });

      // Mock stockMonitorService to throw error
      const originalEvaluate = stockMonitorService.evaluateStockLevel;
      jest.spyOn(stockMonitorService, 'evaluateStockLevel').mockRejectedValue(
        new Error('Stock monitoring service error')
      );

      // Update product stock
      const response = await request(app)
        .put(`/api/admin/products/${product._id}`)
        .set(adminHeaders)
        .send({ stock: 8 });

      // Product update should still succeed despite stock monitoring error
      expect(response.status).toBe(200);
      expect(response.body.product.stock).toBe(8);

      // Restore original implementation
      stockMonitorService.evaluateStockLevel = originalEvaluate;
    });

    it('should not trigger stock monitoring when stock field is not updated', async () => {
      // Create a test product
      const product = await global.createTestProduct({
        name: 'Test Product No Stock Update',
        price: 100,
        stock: 50,
        category: 'groceries',
      });

      // Spy on stockMonitorService
      const evaluateSpy = jest.spyOn(stockMonitorService, 'evaluateStockLevel');

      // Update product without changing stock
      await request(app)
        .put(`/api/admin/products/${product._id}`)
        .set(adminHeaders)
        .send({ name: 'Updated Product Name' });

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify stock monitoring was not called
      expect(evaluateSpy).not.toHaveBeenCalled();

      evaluateSpy.mockRestore();
    });
  });
});
