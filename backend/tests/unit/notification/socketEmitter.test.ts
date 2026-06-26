/**
 * Unit tests for SocketEmitter service.
 * Tests all socket event emissions with mocked Socket.IO server.
 */

import { Application } from 'express';
import {
  SocketEmitter,
  createSocketEmitter,
  NotificationDTO,
  ISocketEmitter,
} from '../../../src/domains/communication/services/socketEmitter';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { logger } from '../../../src/utils/logger';

describe('SocketEmitter', () => {
  let mockApp: Partial<Application>;
  let mockIO: any;
  let mockRoom: any;
  let emitter: ISocketEmitter;

  const testUserId = 'user123';
  const testRoom = `user_${testUserId}`;

  const testNotification: NotificationDTO = {
    id: 'notif-001',
    title: 'Order Confirmed',
    body: 'Your order #1234 has been confirmed',
    category: 'order',
    priority: 'P1',
    deepLink: '/orders/1234',
    createdAt: '2024-01-15T10:30:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRoom = {
      emit: jest.fn(),
    };

    mockIO = {
      to: jest.fn().mockReturnValue(mockRoom),
    };

    mockApp = {
      get: jest.fn().mockReturnValue(mockIO),
    };

    emitter = new SocketEmitter(mockApp as Application);
  });

  describe('emitNotificationNew', () => {
    it('should emit notification:new event to the user room with full DTO', () => {
      emitter.emitNotificationNew(testUserId, testNotification);

      expect(mockIO.to).toHaveBeenCalledWith(testRoom);
      expect(mockRoom.emit).toHaveBeenCalledWith('notification:new', testNotification);
    });

    it('should emit notification:new with correct event payload shape', () => {
      emitter.emitNotificationNew(testUserId, testNotification);

      const emittedPayload = mockRoom.emit.mock.calls[0][1];
      expect(emittedPayload).toEqual({
        id: 'notif-001',
        title: 'Order Confirmed',
        body: 'Your order #1234 has been confirmed',
        category: 'order',
        priority: 'P1',
        deepLink: '/orders/1234',
        createdAt: '2024-01-15T10:30:00.000Z',
      });
    });

    it('should handle notification without deepLink', () => {
      const notifWithoutDeepLink: NotificationDTO = {
        ...testNotification,
        deepLink: undefined,
      };

      emitter.emitNotificationNew(testUserId, notifWithoutDeepLink);

      expect(mockRoom.emit).toHaveBeenCalledWith('notification:new', notifWithoutDeepLink);
    });

    it('should log info on successful emission', () => {
      emitter.emitNotificationNew(testUserId, testNotification);

      expect(logger.info).toHaveBeenCalledWith(
        '[SocketEmitter] Emitted notification:new',
        expect.objectContaining({
          userId: testUserId,
          notificationId: testNotification.id,
          room: testRoom,
        })
      );
    });

    it('should handle missing Socket.IO gracefully', () => {
      (mockApp.get as jest.Mock).mockReturnValue(null);

      emitter.emitNotificationNew(testUserId, testNotification);

      expect(mockRoom.emit).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        '[SocketEmitter] Socket.IO instance not found on app'
      );
    });

    it('should catch and log errors without throwing', () => {
      mockIO.to.mockImplementation(() => {
        throw new Error('Socket connection lost');
      });

      expect(() => {
        emitter.emitNotificationNew(testUserId, testNotification);
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        '[SocketEmitter] Failed to emit notification:new',
        expect.objectContaining({
          error: 'Socket connection lost',
          userId: testUserId,
        })
      );
    });
  });

  describe('emitNotificationRead', () => {
    const testNotificationId = 'notif-002';

    it('should emit notification:read event to the user room', () => {
      emitter.emitNotificationRead(testUserId, testNotificationId);

      expect(mockIO.to).toHaveBeenCalledWith(testRoom);
      expect(mockRoom.emit).toHaveBeenCalledWith('notification:read', {
        notificationId: testNotificationId,
      });
    });

    it('should log info on successful emission', () => {
      emitter.emitNotificationRead(testUserId, testNotificationId);

      expect(logger.info).toHaveBeenCalledWith(
        '[SocketEmitter] Emitted notification:read',
        expect.objectContaining({
          userId: testUserId,
          notificationId: testNotificationId,
          room: testRoom,
        })
      );
    });

    it('should handle missing Socket.IO gracefully', () => {
      (mockApp.get as jest.Mock).mockReturnValue(null);

      emitter.emitNotificationRead(testUserId, testNotificationId);

      expect(mockRoom.emit).not.toHaveBeenCalled();
    });

    it('should catch errors without throwing', () => {
      mockIO.to.mockImplementation(() => {
        throw new Error('Emit failed');
      });

      expect(() => {
        emitter.emitNotificationRead(testUserId, testNotificationId);
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        '[SocketEmitter] Failed to emit notification:read',
        expect.objectContaining({ error: 'Emit failed' })
      );
    });
  });

  describe('emitNotificationReadAll', () => {
    it('should emit notification:read_all event to the user room with empty payload', () => {
      emitter.emitNotificationReadAll(testUserId);

      expect(mockIO.to).toHaveBeenCalledWith(testRoom);
      expect(mockRoom.emit).toHaveBeenCalledWith('notification:read_all', {});
    });

    it('should log info on successful emission', () => {
      emitter.emitNotificationReadAll(testUserId);

      expect(logger.info).toHaveBeenCalledWith(
        '[SocketEmitter] Emitted notification:read_all',
        expect.objectContaining({
          userId: testUserId,
          room: testRoom,
        })
      );
    });

    it('should handle missing Socket.IO gracefully', () => {
      (mockApp.get as jest.Mock).mockReturnValue(null);

      emitter.emitNotificationReadAll(testUserId);

      expect(mockRoom.emit).not.toHaveBeenCalled();
    });

    it('should catch errors without throwing', () => {
      mockIO.to.mockImplementation(() => {
        throw new Error('Connection reset');
      });

      expect(() => {
        emitter.emitNotificationReadAll(testUserId);
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        '[SocketEmitter] Failed to emit notification:read_all',
        expect.objectContaining({ error: 'Connection reset' })
      );
    });
  });

  describe('emitUnreadCount', () => {
    it('should emit notification:unread_count event with count', () => {
      emitter.emitUnreadCount(testUserId, 5);

      expect(mockIO.to).toHaveBeenCalledWith(testRoom);
      expect(mockRoom.emit).toHaveBeenCalledWith('notification:unread_count', { count: 5 });
    });

    it('should emit zero count', () => {
      emitter.emitUnreadCount(testUserId, 0);

      expect(mockRoom.emit).toHaveBeenCalledWith('notification:unread_count', { count: 0 });
    });

    it('should log info on successful emission', () => {
      emitter.emitUnreadCount(testUserId, 3);

      expect(logger.info).toHaveBeenCalledWith(
        '[SocketEmitter] Emitted notification:unread_count',
        expect.objectContaining({
          userId: testUserId,
          count: 3,
          room: testRoom,
        })
      );
    });

    it('should handle missing Socket.IO gracefully', () => {
      (mockApp.get as jest.Mock).mockReturnValue(null);

      emitter.emitUnreadCount(testUserId, 10);

      expect(mockRoom.emit).not.toHaveBeenCalled();
    });

    it('should catch errors without throwing', () => {
      mockIO.to.mockImplementation(() => {
        throw new Error('Network timeout');
      });

      expect(() => {
        emitter.emitUnreadCount(testUserId, 7);
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        '[SocketEmitter] Failed to emit notification:unread_count',
        expect.objectContaining({ error: 'Network timeout' })
      );
    });
  });

  describe('emitNotificationSync', () => {
    const testNotifications: NotificationDTO[] = [
      testNotification,
      {
        id: 'notif-002',
        title: 'Payment Received',
        body: 'Payment of ₹500 received',
        category: 'payment',
        priority: 'P2',
        deepLink: '/payments/456',
        createdAt: '2024-01-15T10:35:00.000Z',
      },
    ];

    it('should emit notification:sync event with notifications and unread count', () => {
      emitter.emitNotificationSync(testUserId, testNotifications, 7);

      expect(mockIO.to).toHaveBeenCalledWith(testRoom);
      expect(mockRoom.emit).toHaveBeenCalledWith('notification:sync', {
        notifications: testNotifications,
        totalUnread: 7,
      });
    });

    it('should handle empty notifications array', () => {
      emitter.emitNotificationSync(testUserId, [], 0);

      expect(mockRoom.emit).toHaveBeenCalledWith('notification:sync', {
        notifications: [],
        totalUnread: 0,
      });
    });

    it('should log info with notification count', () => {
      emitter.emitNotificationSync(testUserId, testNotifications, 7);

      expect(logger.info).toHaveBeenCalledWith(
        '[SocketEmitter] Emitted notification:sync',
        expect.objectContaining({
          userId: testUserId,
          notificationCount: 2,
          totalUnread: 7,
          room: testRoom,
        })
      );
    });

    it('should handle missing Socket.IO gracefully', () => {
      (mockApp.get as jest.Mock).mockReturnValue(null);

      emitter.emitNotificationSync(testUserId, testNotifications, 7);

      expect(mockRoom.emit).not.toHaveBeenCalled();
    });

    it('should catch errors without throwing', () => {
      mockIO.to.mockImplementation(() => {
        throw new Error('Broadcast failed');
      });

      expect(() => {
        emitter.emitNotificationSync(testUserId, testNotifications, 7);
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        '[SocketEmitter] Failed to emit notification:sync',
        expect.objectContaining({ error: 'Broadcast failed' })
      );
    });
  });

  describe('createSocketEmitter factory', () => {
    it('should create a SocketEmitter instance', () => {
      const instance = createSocketEmitter(mockApp as Application);

      expect(instance).toBeDefined();
      expect(instance.emitNotificationNew).toBeDefined();
      expect(instance.emitNotificationRead).toBeDefined();
      expect(instance.emitNotificationReadAll).toBeDefined();
      expect(instance.emitUnreadCount).toBeDefined();
      expect(instance.emitNotificationSync).toBeDefined();
    });

    it('should return a working instance that emits events', () => {
      const instance = createSocketEmitter(mockApp as Application);

      instance.emitNotificationNew(testUserId, testNotification);

      expect(mockIO.to).toHaveBeenCalledWith(testRoom);
      expect(mockRoom.emit).toHaveBeenCalledWith('notification:new', testNotification);
    });
  });

  describe('user room format', () => {
    it('should use user_{userId} room format for all events', () => {
      const userId = 'abc-def-123';
      const expectedRoom = 'user_abc-def-123';

      emitter.emitNotificationNew(userId, testNotification);
      expect(mockIO.to).toHaveBeenCalledWith(expectedRoom);

      jest.clearAllMocks();
      emitter.emitNotificationRead(userId, 'notif-1');
      expect(mockIO.to).toHaveBeenCalledWith(expectedRoom);

      jest.clearAllMocks();
      emitter.emitNotificationReadAll(userId);
      expect(mockIO.to).toHaveBeenCalledWith(expectedRoom);

      jest.clearAllMocks();
      emitter.emitUnreadCount(userId, 5);
      expect(mockIO.to).toHaveBeenCalledWith(expectedRoom);

      jest.clearAllMocks();
      emitter.emitNotificationSync(userId, [], 0);
      expect(mockIO.to).toHaveBeenCalledWith(expectedRoom);
    });
  });

  describe('app.get("io") error scenarios', () => {
    it('should handle app.get throwing an error', () => {
      (mockApp.get as jest.Mock).mockImplementation(() => {
        throw new Error('App not initialized');
      });

      expect(() => {
        emitter.emitNotificationNew(testUserId, testNotification);
      }).not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        '[SocketEmitter] Error accessing Socket.IO instance:',
        expect.any(Error)
      );
    });

    it('should handle app.get returning undefined', () => {
      (mockApp.get as jest.Mock).mockReturnValue(undefined);

      emitter.emitNotificationNew(testUserId, testNotification);

      expect(mockRoom.emit).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
