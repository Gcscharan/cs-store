/**
 * NotificationService Unit Tests
 * 
 * Tests CRUD operations, duplicate prevention, and message generation
 * for the notification service.
 */

import { NotificationService } from '../notificationService';
import LowStockNotification from '../../models/LowStockNotification';
import mongoose from 'mongoose';
import { Application } from 'express';

// Mock the LowStockNotification model
jest.mock('../../models/LowStockNotification');

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the socket service
jest.mock('../lowStockSocketService', () => ({
  createLowStockSocketService: jest.fn(() => ({
    broadcastLowStockAlert: jest.fn(),
    broadcastNotificationStatusUpdate: jest.fn(),
  })),
}));

describe('NotificationService', () => {
  let service: NotificationService;
  const mockObjectId = new mongoose.Types.ObjectId();
  const mockApp = {} as Application;

  beforeEach(() => {
    service = new NotificationService();
    // Initialize with mock app for Socket.io integration
    service.initialize(mockApp);
    jest.clearAllMocks();
  });

  describe('createLowStockNotification', () => {
    it('should create notification when no unread notification exists', async () => {
      const mockData = {
        productId: mockObjectId.toString(),
        productName: 'Test Product',
        currentStock: 5,
        priority: 'LOW' as const,
      };

      const mockNotification = {
        _id: mockObjectId,
        type: 'LOW_STOCK',
        ...mockData,
        productId: mockObjectId,
        message: 'Low stock: Test Product has only 5 left',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue({
          _id: mockObjectId,
          type: 'LOW_STOCK',
          ...mockData,
          productId: mockObjectId,
          message: 'Low stock: Test Product has only 5 left',
          isRead: false,
        }),
      };

      // Mock findOne to return null (no existing notification)
      (LowStockNotification.findOne as jest.Mock).mockResolvedValue(null);
      
      // Mock constructor
      (LowStockNotification as any).mockImplementation(() => mockNotification);

      const result = await service.createLowStockNotification(mockData);

      expect(result).toBeDefined();
      expect(LowStockNotification.findOne).toHaveBeenCalledWith({
        productId: expect.any(mongoose.Types.ObjectId),
        isRead: false,
      });
    });

    it('should return null when unread notification already exists (duplicate prevention)', async () => {
      const mockData = {
        productId: mockObjectId.toString(),
        productName: 'Test Product',
        currentStock: 5,
        priority: 'LOW' as const,
      };

      const existingNotification = {
        _id: mockObjectId,
        productId: mockObjectId,
        isRead: false,
      };

      // Mock findOne to return existing notification
      (LowStockNotification.findOne as jest.Mock).mockResolvedValue(existingNotification);

      const result = await service.createLowStockNotification(mockData);

      expect(result).toBeNull();
      expect(LowStockNotification.findOne).toHaveBeenCalled();
    });

    it('should generate CRITICAL message for CRITICAL priority', async () => {
      const mockData = {
        productId: mockObjectId.toString(),
        productName: 'Test Product',
        currentStock: 2,
        priority: 'CRITICAL' as const,
      };

      const mockNotification = {
        _id: mockObjectId,
        type: 'LOW_STOCK',
        ...mockData,
        productId: mockObjectId,
        message: '🚨 CRITICAL: Test Product has only 2 left',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue({
          _id: mockObjectId,
          type: 'LOW_STOCK',
          ...mockData,
          productId: mockObjectId,
          message: '🚨 CRITICAL: Test Product has only 2 left',
          isRead: false,
        }),
      };

      (LowStockNotification.findOne as jest.Mock).mockResolvedValue(null);
      (LowStockNotification as any).mockImplementation(() => mockNotification);

      const result = await service.createLowStockNotification(mockData);

      expect(result).toBeDefined();
      expect(result?.message).toBe('🚨 CRITICAL: Test Product has only 2 left');
    });
  });

  describe('getNotifications', () => {
    it('should return paginated notifications with default options', async () => {
      const mockNotifications = [
        {
          _id: mockObjectId,
          type: 'LOW_STOCK',
          productName: 'Product 1',
          currentStock: 5,
          priority: 'LOW',
          isRead: false,
        },
      ];

      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockNotifications),
      };

      (LowStockNotification.find as jest.Mock).mockReturnValue(mockQuery);
      (LowStockNotification.countDocuments as jest.Mock).mockResolvedValue(1);

      const result = await service.getNotifications({});

      expect(result.notifications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
    });

    it('should filter by isRead status', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };

      (LowStockNotification.find as jest.Mock).mockReturnValue(mockQuery);
      (LowStockNotification.countDocuments as jest.Mock).mockResolvedValue(0);

      await service.getNotifications({ isRead: false });

      expect(LowStockNotification.find).toHaveBeenCalledWith({ isRead: false });
    });

    it('should filter by priority', async () => {
      const mockQuery = {
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      };

      (LowStockNotification.find as jest.Mock).mockReturnValue(mockQuery);
      (LowStockNotification.countDocuments as jest.Mock).mockResolvedValue(0);

      await service.getNotifications({ priority: 'CRITICAL' });

      expect(LowStockNotification.find).toHaveBeenCalledWith({ priority: 'CRITICAL' });
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      const mockNotification = {
        _id: mockObjectId,
        isRead: true,
      };

      (LowStockNotification.findByIdAndUpdate as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.markAsRead(mockObjectId.toString());

      expect(result.isRead).toBe(true);
      expect(LowStockNotification.findByIdAndUpdate).toHaveBeenCalledWith(
        mockObjectId.toString(),
        { isRead: true },
        { new: true }
      );
    });

    it('should throw error if notification not found', async () => {
      (LowStockNotification.findByIdAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(service.markAsRead(mockObjectId.toString())).rejects.toThrow(
        'Notification not found'
      );
    });

    it('should throw error for invalid ObjectId', async () => {
      await expect(service.markAsRead('invalid-id')).rejects.toThrow(
        'Invalid notification ID format'
      );
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification', async () => {
      const mockNotification = {
        _id: mockObjectId,
      };

      (LowStockNotification.findByIdAndDelete as jest.Mock).mockResolvedValue(mockNotification);

      await service.deleteNotification(mockObjectId.toString());

      expect(LowStockNotification.findByIdAndDelete).toHaveBeenCalledWith(
        mockObjectId.toString()
      );
    });

    it('should throw error if notification not found', async () => {
      (LowStockNotification.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteNotification(mockObjectId.toString())).rejects.toThrow(
        'Notification not found'
      );
    });

    it('should throw error for invalid ObjectId', async () => {
      await expect(service.deleteNotification('invalid-id')).rejects.toThrow(
        'Invalid notification ID format'
      );
    });
  });

  describe('findUnreadNotificationForProduct', () => {
    it('should find unread notification for product', async () => {
      const mockNotification = {
        _id: mockObjectId,
        productId: mockObjectId,
        isRead: false,
      };

      (LowStockNotification.findOne as jest.Mock).mockResolvedValue(mockNotification);

      const result = await service.findUnreadNotificationForProduct(mockObjectId.toString());

      expect(result).toBeDefined();
      expect(LowStockNotification.findOne).toHaveBeenCalledWith({
        productId: expect.any(mongoose.Types.ObjectId),
        isRead: false,
      });
    });

    it('should return null if no unread notification exists', async () => {
      (LowStockNotification.findOne as jest.Mock).mockResolvedValue(null);

      const result = await service.findUnreadNotificationForProduct(mockObjectId.toString());

      expect(result).toBeNull();
    });

    it('should throw error for invalid ObjectId', async () => {
      await expect(
        service.findUnreadNotificationForProduct('invalid-id')
      ).rejects.toThrow('Invalid product ID format');
    });
  });
});
