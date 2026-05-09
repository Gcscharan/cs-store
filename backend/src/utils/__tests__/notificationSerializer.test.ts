/**
 * Unit tests for Notification Serializer
 * 
 * Tests serialization of notification documents to API response format
 * with ISO 8601 timestamps and ObjectId-to-string conversion.
 */

import mongoose from 'mongoose';
import {
  serializeNotification,
  serializePaginatedNotifications,
  SerializedNotification,
  PaginatedNotifications
} from '../notificationSerializer';
import { ILowStockNotification } from '../../models/LowStockNotification';

describe('Notification Serializer', () => {
  describe('serializeNotification', () => {
    it('should serialize notification with all required fields', () => {
      // Arrange
      const mockNotification = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        type: 'LOW_STOCK' as const,
        productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW' as const,
        message: 'Low stock: Organic Tomatoes has only 8 left',
        isRead: false,
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
        updatedAt: new Date('2024-01-15T10:30:00.000Z')
      } as ILowStockNotification;

      // Act
      const result = serializeNotification(mockNotification);

      // Assert
      expect(result).toEqual({
        _id: '507f1f77bcf86cd799439011',
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439012',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left',
        isRead: false,
        createdAt: '2024-01-15T10:30:00.000Z'
      });
    });

    it('should convert ObjectIds to strings', () => {
      // Arrange
      const mockNotification = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        type: 'LOW_STOCK' as const,
        productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
        productName: 'Test Product',
        currentStock: 5,
        priority: 'LOW' as const,
        message: 'Test message',
        isRead: false,
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
        updatedAt: new Date('2024-01-15T10:30:00.000Z')
      } as ILowStockNotification;

      // Act
      const result = serializeNotification(mockNotification);

      // Assert
      expect(typeof result._id).toBe('string');
      expect(typeof result.productId).toBe('string');
      expect(result._id).toBe('507f1f77bcf86cd799439011');
      expect(result.productId).toBe('507f1f77bcf86cd799439012');
    });

    it('should format createdAt as ISO 8601 timestamp string', () => {
      // Arrange
      const testDate = new Date('2024-01-15T10:30:00.000Z');
      const mockNotification = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        type: 'LOW_STOCK' as const,
        productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
        productName: 'Test Product',
        currentStock: 5,
        priority: 'LOW' as const,
        message: 'Test message',
        isRead: false,
        createdAt: testDate,
        updatedAt: testDate
      } as ILowStockNotification;

      // Act
      const result = serializeNotification(mockNotification);

      // Assert
      expect(typeof result.createdAt).toBe('string');
      expect(result.createdAt).toBe('2024-01-15T10:30:00.000Z');
      // Verify it's valid ISO 8601 format
      expect(new Date(result.createdAt).toISOString()).toBe(result.createdAt);
    });

    it('should serialize CRITICAL priority notification', () => {
      // Arrange
      const mockNotification = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        type: 'LOW_STOCK' as const,
        productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
        productName: 'Critical Product',
        currentStock: 2,
        priority: 'CRITICAL' as const,
        message: '🚨 CRITICAL: Critical Product has only 2 left',
        isRead: false,
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
        updatedAt: new Date('2024-01-15T10:30:00.000Z')
      } as ILowStockNotification;

      // Act
      const result = serializeNotification(mockNotification);

      // Assert
      expect(result.priority).toBe('CRITICAL');
      expect(result.currentStock).toBe(2);
    });

    it('should serialize read notification', () => {
      // Arrange
      const mockNotification = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        type: 'LOW_STOCK' as const,
        productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
        productName: 'Test Product',
        currentStock: 5,
        priority: 'LOW' as const,
        message: 'Test message',
        isRead: true,
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
        updatedAt: new Date('2024-01-15T10:30:00.000Z')
      } as ILowStockNotification;

      // Act
      const result = serializeNotification(mockNotification);

      // Assert
      expect(result.isRead).toBe(true);
    });
  });

  describe('serializePaginatedNotifications', () => {
    it('should serialize paginated notifications with all fields', () => {
      // Arrange
      const mockNotifications = [
        {
          _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
          type: 'LOW_STOCK' as const,
          productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
          productName: 'Product 1',
          currentStock: 8,
          priority: 'LOW' as const,
          message: 'Low stock: Product 1 has only 8 left',
          isRead: false,
          createdAt: new Date('2024-01-15T10:30:00.000Z'),
          updatedAt: new Date('2024-01-15T10:30:00.000Z')
        },
        {
          _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'),
          type: 'LOW_STOCK' as const,
          productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
          productName: 'Product 2',
          currentStock: 2,
          priority: 'CRITICAL' as const,
          message: '🚨 CRITICAL: Product 2 has only 2 left',
          isRead: false,
          createdAt: new Date('2024-01-15T11:00:00.000Z'),
          updatedAt: new Date('2024-01-15T11:00:00.000Z')
        }
      ] as ILowStockNotification[];

      const paginatedData: PaginatedNotifications = {
        notifications: mockNotifications,
        total: 45,
        page: 1,
        limit: 20,
        totalPages: 3
      };

      // Act
      const result = serializePaginatedNotifications(paginatedData);

      // Assert
      expect(result.notifications).toHaveLength(2);
      expect(result.total).toBe(45);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(3);
    });

    it('should serialize all notifications in the array', () => {
      // Arrange
      const mockNotifications = [
        {
          _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
          type: 'LOW_STOCK' as const,
          productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
          productName: 'Product 1',
          currentStock: 8,
          priority: 'LOW' as const,
          message: 'Low stock: Product 1 has only 8 left',
          isRead: false,
          createdAt: new Date('2024-01-15T10:30:00.000Z'),
          updatedAt: new Date('2024-01-15T10:30:00.000Z')
        },
        {
          _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'),
          type: 'LOW_STOCK' as const,
          productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
          productName: 'Product 2',
          currentStock: 2,
          priority: 'CRITICAL' as const,
          message: '🚨 CRITICAL: Product 2 has only 2 left',
          isRead: false,
          createdAt: new Date('2024-01-15T11:00:00.000Z'),
          updatedAt: new Date('2024-01-15T11:00:00.000Z')
        }
      ] as ILowStockNotification[];

      const paginatedData: PaginatedNotifications = {
        notifications: mockNotifications,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      // Act
      const result = serializePaginatedNotifications(paginatedData);

      // Assert
      expect(result.notifications[0]._id).toBe('507f1f77bcf86cd799439011');
      expect(result.notifications[0].productId).toBe('507f1f77bcf86cd799439012');
      expect(result.notifications[0].createdAt).toBe('2024-01-15T10:30:00.000Z');
      
      expect(result.notifications[1]._id).toBe('507f1f77bcf86cd799439013');
      expect(result.notifications[1].productId).toBe('507f1f77bcf86cd799439014');
      expect(result.notifications[1].createdAt).toBe('2024-01-15T11:00:00.000Z');
    });

    it('should handle empty notifications array', () => {
      // Arrange
      const paginatedData: PaginatedNotifications = {
        notifications: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      };

      // Act
      const result = serializePaginatedNotifications(paginatedData);

      // Assert
      expect(result.notifications).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(0);
    });

    it('should preserve pagination metadata', () => {
      // Arrange
      const mockNotifications = [
        {
          _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
          type: 'LOW_STOCK' as const,
          productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
          productName: 'Product 1',
          currentStock: 8,
          priority: 'LOW' as const,
          message: 'Low stock: Product 1 has only 8 left',
          isRead: false,
          createdAt: new Date('2024-01-15T10:30:00.000Z'),
          updatedAt: new Date('2024-01-15T10:30:00.000Z')
        }
      ] as ILowStockNotification[];

      const paginatedData: PaginatedNotifications = {
        notifications: mockNotifications,
        total: 100,
        page: 3,
        limit: 10,
        totalPages: 10
      };

      // Act
      const result = serializePaginatedNotifications(paginatedData);

      // Assert
      expect(result.total).toBe(100);
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(10);
    });
  });
});
