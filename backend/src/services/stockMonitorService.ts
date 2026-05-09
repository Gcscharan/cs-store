/**
 * StockMonitorService - Monitor product stock levels and trigger notifications
 * 
 * Evaluates stock levels against thresholds and creates low stock notifications
 * with duplicate prevention logic.
 * 
 * Requirements: 1.1, 2.1, 3.1, 3.2
 */

import { Product } from '../models/Product';
import { ILowStockNotification } from '../models/LowStockNotification';
import { notificationService } from './notificationService';
import mongoose from 'mongoose';

// Threshold constants
export const STOCK_THRESHOLD = 10; // Triggers LOW priority notification
export const CRITICAL_THRESHOLD = 3; // Triggers CRITICAL priority notification

export class StockMonitorService {
  /**
   * Evaluate stock level and trigger notification if needed
   * Requirements: 1.1, 2.1, 3.1, 3.2
   * 
   * @param productId - Product to evaluate
   * @param currentStock - Current stock level
   * @returns Created notification or null if no notification needed
   */
  async evaluateStockLevel(
    productId: string,
    currentStock: number
  ): Promise<ILowStockNotification | null> {
    try {
      // Check if stock is below threshold
      if (currentStock >= STOCK_THRESHOLD) {
        // Stock is above threshold, no notification needed
        return null;
      }

      // Check for existing unread notification (duplicate prevention)
      const hasUnread = await this.hasUnreadNotification(productId);
      if (hasUnread) {
        // Skip creation - duplicate prevention
        return null;
      }

      // Determine priority based on stock level
      const priority = currentStock < CRITICAL_THRESHOLD ? 'CRITICAL' : 'LOW';

      // Fetch product details to get product name
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error(`Product not found: ${productId}`);
      }

      // Create notification via notification service
      const notification = await notificationService.createLowStockNotification({
        productId,
        productName: product.name,
        currentStock,
        priority,
      });

      return notification;
    } catch (error: any) {
      throw new Error(`Failed to evaluate stock level: ${error.message}`);
    }
  }

  /**
   * Check if product already has unread low stock notification
   * Requirements: 2.1
   * 
   * @param productId - Product to check
   * @returns true if unread notification exists
   */
  async hasUnreadNotification(productId: string): Promise<boolean> {
    try {
      // Validate ObjectId format
      if (!mongoose.isValidObjectId(productId)) {
        throw new Error('Invalid product ID format');
      }

      // Check for existing unread notification
      const existingNotification = await notificationService.findUnreadNotificationForProduct(
        productId
      );

      return existingNotification !== null;
    } catch (error: any) {
      throw new Error(`Failed to check for unread notification: ${error.message}`);
    }
  }
}

export const stockMonitorService = new StockMonitorService();
