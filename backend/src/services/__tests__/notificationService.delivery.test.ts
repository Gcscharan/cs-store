/**
 * NotificationService Delivery Orchestration Tests
 * 
 * Tests multi-channel delivery orchestration with Promise.allSettled
 * Requirements: 15.1, 15.2, 15.3, 15.9
 */

import { NotificationService } from '../notificationService';
import LowStockNotification from '../../models/LowStockNotification';
import mongoose from 'mongoose';
import { Application } from 'express';
import { logger } from '../../utils/logger';

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
const mockBroadcastLowStockAlert = jest.fn();
jest.mock('../lowStockSocketService', () => ({
  createLowStockSocketService: jest.fn(() => ({
    broadcastLowStockAlert: mockBroadcastLowStockAlert,
    broadcastNotificationStatusUpdate: jest.fn(),
  })),
}));

describe('NotificationService - Delivery Orchestration', () => {
  let service: NotificationService;
  const mockObjectId = new mongoose.Types.ObjectId();
  const mockApp = {} as Application;

  beforeEach(() => {
    service = new NotificationService();
    service.initialize(mockApp);
    jest.clearAllMocks();
  });

  describe('Multi-channel delivery orchestration', () => {
    it('should trigger Socket.io broadcast after creating notification', async () => {
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
          createdAt: new Date(),
        }),
      };

      (LowStockNotification.findOne as jest.Mock).mockResolvedValue(null);
      (LowStockNotification as any).mockImplementation(() => mockNotification);

      const result = await service.createLowStockNotification(mockData);

      expect(result).toBeDefined();
      expect(mockBroadcastLowStockAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: mockObjectId,
          productName: 'Test Product',
          currentStock: 5,
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        '[NotificationService] Socket.io delivery succeeded',
        expect.any(Object)
      );
    });

    it('should handle Socket.io broadcast failure gracefully', async () => {
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
          createdAt: new Date(),
        }),
      };

      (LowStockNotification.findOne as jest.Mock).mockResolvedValue(null);
      (LowStockNotification as any).mockImplementation(() => mockNotification);
      
      // Mock Socket.io broadcast to throw error
      mockBroadcastLowStockAlert.mockImplementation(() => {
        throw new Error('Socket.io connection failed');
      });

      // Should not throw - graceful error handling
      const result = await service.createLowStockNotification(mockData);

      expect(result).toBeDefined();
      expect(mockBroadcastLowStockAlert).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        '[NotificationService] Socket.io delivery failed',
        expect.objectContaining({
          notificationId: mockObjectId,
        })
      );
    });

    it('should create notification even if Socket.io service is not initialized', async () => {
      // Create service without initialization
      const uninitializedService = new NotificationService();

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
          createdAt: new Date(),
        }),
      };

      (LowStockNotification.findOne as jest.Mock).mockResolvedValue(null);
      (LowStockNotification as any).mockImplementation(() => mockNotification);

      const result = await uninitializedService.createLowStockNotification(mockData);

      expect(result).toBeDefined();
      expect(mockBroadcastLowStockAlert).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        '[NotificationService] Socket service not initialized - skipping Socket.io delivery',
        expect.any(Object)
      );
    });
  });
});
