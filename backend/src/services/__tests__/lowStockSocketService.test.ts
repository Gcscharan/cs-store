/**
 * Unit tests for Low Stock Socket Service
 * 
 * Tests Socket.io integration, error handling, and event broadcasting
 */

import { Application } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { LowStockSocketService } from '../lowStockSocketService';
import { ILowStockNotification } from '../../models/LowStockNotification';
import mongoose from 'mongoose';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('LowStockSocketService', () => {
  let mockApp: Application;
  let mockIo: Partial<SocketIOServer>;
  let socketService: LowStockSocketService;
  let mockEmit: jest.Mock;
  let mockTo: jest.Mock;

  beforeEach(() => {
    // Create mock Socket.io instance
    mockEmit = jest.fn();
    mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
    
    mockIo = {
      to: mockTo,
    };

    // Create mock Express app
    mockApp = {
      get: jest.fn().mockReturnValue(mockIo),
    } as unknown as Application;

    // Create socket service instance
    socketService = new LowStockSocketService(mockApp);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('broadcastLowStockAlert', () => {
    it('should broadcast low stock alert to admin_room with complete notification object', () => {
      // Arrange
      const mockNotification: ILowStockNotification = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'),
        type: 'LOW_STOCK',
        productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'),
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left',
        isRead: false,
        createdAt: new Date('2024-01-15T10:30:00.000Z'),
        updatedAt: new Date('2024-01-15T10:30:00.000Z'),
      } as ILowStockNotification;

      // Act
      socketService.broadcastLowStockAlert(mockNotification);

      // Assert
      expect(mockApp.get).toHaveBeenCalledWith('io');
      expect(mockTo).toHaveBeenCalledWith('admin_room');
      expect(mockEmit).toHaveBeenCalledWith('low_stock_alert', {
        notification: {
          _id: '507f1f77bcf86cd799439011',
          type: 'LOW_STOCK',
          productId: '507f1f77bcf86cd799439012',
          productName: 'Organic Tomatoes',
          currentStock: 8,
          priority: 'LOW',
          message: 'Low stock: Organic Tomatoes has only 8 left',
          isRead: false,
          createdAt: '2024-01-15T10:30:00.000Z',
        },
      });
    });

    it('should broadcast CRITICAL priority notification correctly', () => {
      // Arrange
      const mockNotification: ILowStockNotification = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'),
        type: 'LOW_STOCK',
        productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439014'),
        productName: 'Fresh Milk',
        currentStock: 2,
        priority: 'CRITICAL',
        message: '🚨 CRITICAL: Fresh Milk has only 2 left',
        isRead: false,
        createdAt: new Date('2024-01-15T11:00:00.000Z'),
        updatedAt: new Date('2024-01-15T11:00:00.000Z'),
      } as ILowStockNotification;

      // Act
      socketService.broadcastLowStockAlert(mockNotification);

      // Assert
      expect(mockEmit).toHaveBeenCalledWith('low_stock_alert', {
        notification: expect.objectContaining({
          priority: 'CRITICAL',
          message: '🚨 CRITICAL: Fresh Milk has only 2 left',
        }),
      });
    });

    it('should handle missing Socket.io instance gracefully', () => {
      // Arrange
      const mockAppNoIo = {
        get: jest.fn().mockReturnValue(null),
      } as unknown as Application;
      
      const serviceNoIo = new LowStockSocketService(mockAppNoIo);
      
      const mockNotification: ILowStockNotification = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439015'),
        type: 'LOW_STOCK',
        productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439016'),
        productName: 'Test Product',
        currentStock: 5,
        priority: 'LOW',
        message: 'Low stock: Test Product has only 5 left',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ILowStockNotification;

      // Act - should not throw
      expect(() => {
        serviceNoIo.broadcastLowStockAlert(mockNotification);
      }).not.toThrow();

      // Assert - emit should not be called
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('should handle Socket.io errors gracefully', () => {
      // Arrange
      const errorMockTo = jest.fn().mockImplementation(() => {
        throw new Error('Socket.io error');
      });
      
      const errorMockIo = {
        to: errorMockTo,
      };
      
      const errorMockApp = {
        get: jest.fn().mockReturnValue(errorMockIo),
      } as unknown as Application;
      
      const errorService = new LowStockSocketService(errorMockApp);
      
      const mockNotification: ILowStockNotification = {
        _id: new mongoose.Types.ObjectId('507f1f77bcf86cd799439017'),
        type: 'LOW_STOCK',
        productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439018'),
        productName: 'Error Product',
        currentStock: 3,
        priority: 'CRITICAL',
        message: '🚨 CRITICAL: Error Product has only 3 left',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ILowStockNotification;

      // Act - should not throw
      expect(() => {
        errorService.broadcastLowStockAlert(mockNotification);
      }).not.toThrow();
    });

    it('should serialize ObjectIds to strings in payload', () => {
      // Arrange
      const notificationId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439019');
      const productId = new mongoose.Types.ObjectId('507f1f77bcf86cd799439020');
      
      const mockNotification: ILowStockNotification = {
        _id: notificationId,
        type: 'LOW_STOCK',
        productId: productId,
        productName: 'Test Product',
        currentStock: 7,
        priority: 'LOW',
        message: 'Low stock: Test Product has only 7 left',
        isRead: false,
        createdAt: new Date('2024-01-15T12:00:00.000Z'),
        updatedAt: new Date('2024-01-15T12:00:00.000Z'),
      } as ILowStockNotification;

      // Act
      socketService.broadcastLowStockAlert(mockNotification);

      // Assert
      expect(mockEmit).toHaveBeenCalledWith('low_stock_alert', {
        notification: expect.objectContaining({
          _id: '507f1f77bcf86cd799439019',
          productId: '507f1f77bcf86cd799439020',
        }),
      });
    });

    it('should format createdAt as ISO 8601 string', () => {
      // Arrange
      const testDate = new Date('2024-01-15T14:30:45.123Z');
      
      const mockNotification: ILowStockNotification = {
        _id: new mongoose.Types.ObjectId(),
        type: 'LOW_STOCK',
        productId: new mongoose.Types.ObjectId(),
        productName: 'Date Test Product',
        currentStock: 6,
        priority: 'LOW',
        message: 'Low stock: Date Test Product has only 6 left',
        isRead: false,
        createdAt: testDate,
        updatedAt: testDate,
      } as ILowStockNotification;

      // Act
      socketService.broadcastLowStockAlert(mockNotification);

      // Assert
      expect(mockEmit).toHaveBeenCalledWith('low_stock_alert', {
        notification: expect.objectContaining({
          createdAt: '2024-01-15T14:30:45.123Z',
        }),
      });
    });
  });

  describe('broadcastNotificationStatusUpdate', () => {
    it('should broadcast status update to admin_room', () => {
      // Arrange
      const notificationId = '507f1f77bcf86cd799439021';
      const isRead = true;

      // Act
      socketService.broadcastNotificationStatusUpdate(notificationId, isRead);

      // Assert
      expect(mockTo).toHaveBeenCalledWith('admin_room');
      expect(mockEmit).toHaveBeenCalledWith('notification:status:update', {
        notificationId,
        isRead,
        updatedAt: expect.any(String),
      });
    });

    it('should broadcast unread status correctly', () => {
      // Arrange
      const notificationId = '507f1f77bcf86cd799439022';
      const isRead = false;

      // Act
      socketService.broadcastNotificationStatusUpdate(notificationId, isRead);

      // Assert
      expect(mockEmit).toHaveBeenCalledWith('notification:status:update', {
        notificationId,
        isRead: false,
        updatedAt: expect.any(String),
      });
    });

    it('should handle missing Socket.io instance gracefully', () => {
      // Arrange
      const mockAppNoIo = {
        get: jest.fn().mockReturnValue(null),
      } as unknown as Application;
      
      const serviceNoIo = new LowStockSocketService(mockAppNoIo);

      // Act - should not throw
      expect(() => {
        serviceNoIo.broadcastNotificationStatusUpdate('test-id', true);
      }).not.toThrow();

      // Assert
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('should handle Socket.io errors gracefully', () => {
      // Arrange
      const errorMockTo = jest.fn().mockImplementation(() => {
        throw new Error('Socket.io error');
      });
      
      const errorMockIo = {
        to: errorMockTo,
      };
      
      const errorMockApp = {
        get: jest.fn().mockReturnValue(errorMockIo),
      } as unknown as Application;
      
      const errorService = new LowStockSocketService(errorMockApp);

      // Act - should not throw
      expect(() => {
        errorService.broadcastNotificationStatusUpdate('test-id', true);
      }).not.toThrow();
    });

    it('should include ISO 8601 timestamp in status update', () => {
      // Arrange
      const notificationId = '507f1f77bcf86cd799439023';
      const isRead = true;
      const beforeCall = new Date().toISOString();

      // Act
      socketService.broadcastNotificationStatusUpdate(notificationId, isRead);

      // Assert
      const callArgs = mockEmit.mock.calls[0][1];
      expect(callArgs.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(callArgs.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(beforeCall).getTime());
    });
  });

  describe('Integration with Express app', () => {
    it('should access Socket.io instance via app.get("io")', () => {
      // Arrange
      const mockNotification: ILowStockNotification = {
        _id: new mongoose.Types.ObjectId(),
        type: 'LOW_STOCK',
        productId: new mongoose.Types.ObjectId(),
        productName: 'Integration Test',
        currentStock: 4,
        priority: 'LOW',
        message: 'Low stock: Integration Test has only 4 left',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ILowStockNotification;

      // Act
      socketService.broadcastLowStockAlert(mockNotification);

      // Assert
      expect(mockApp.get).toHaveBeenCalledWith('io');
    });

    it('should handle app.get throwing an error', () => {
      // Arrange
      const errorApp = {
        get: jest.fn().mockImplementation(() => {
          throw new Error('App.get error');
        }),
      } as unknown as Application;
      
      const errorService = new LowStockSocketService(errorApp);
      
      const mockNotification: ILowStockNotification = {
        _id: new mongoose.Types.ObjectId(),
        type: 'LOW_STOCK',
        productId: new mongoose.Types.ObjectId(),
        productName: 'Error Test',
        currentStock: 1,
        priority: 'CRITICAL',
        message: '🚨 CRITICAL: Error Test has only 1 left',
        isRead: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as ILowStockNotification;

      // Act - should not throw
      expect(() => {
        errorService.broadcastLowStockAlert(mockNotification);
      }).not.toThrow();
    });
  });
});
