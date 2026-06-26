/**
 * Socket Emitter Service - Real-time notification delivery via Socket.IO
 *
 * Emits notification events to user-specific Socket.IO rooms for real-time
 * updates in the client applications. Follows the same pattern as
 * LowStockSocketService for accessing the Socket.IO server instance.
 *
 * Socket Event Protocol:
 * - 'notification:new'          → { id, title, body, category, priority, deepLink, createdAt }
 * - 'notification:read'         → { notificationId }
 * - 'notification:read_all'     → {}
 * - 'notification:unread_count' → { count }
 * - 'notification:sync'         → { notifications: NotificationDTO[], totalUnread: number }
 */

import { Application } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { logger } from '../../../utils/logger';
import { updateLifecycleStatus } from './deliveryTracker';

export interface NotificationDTO {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  deepLink?: string;
  createdAt: string;
}

export interface ISocketEmitter {
  emitNotificationNew(userId: string, notificationDTO: NotificationDTO): void;
  emitNotificationRead(userId: string, notificationId: string): void;
  emitNotificationReadAll(userId: string): void;
  emitUnreadCount(userId: string, count: number): void;
  emitNotificationSync(userId: string, notifications: NotificationDTO[], totalUnread: number): void;
}

export class SocketEmitter implements ISocketEmitter {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  /**
   * Get Socket.IO server instance from Express app.
   * Returns null if not available (graceful degradation).
   */
  private getSocketIO(): SocketIOServer | null {
    try {
      const io = this.app.get('io') as SocketIOServer;
      if (!io) {
        logger.warn('[SocketEmitter] Socket.IO instance not found on app');
        return null;
      }
      return io;
    } catch (error) {
      logger.error('[SocketEmitter] Error accessing Socket.IO instance:', error);
      return null;
    }
  }

  /**
   * Get the user room name for a given userId.
   */
  private getUserRoom(userId: string): string {
    return `user_${userId}`;
  }

  /**
   * Emit a 'notification:new' event to the user's room.
   * Delivers the complete notification DTO for real-time UI updates.
   * Updates delivery lifecycle tracking to 'sent' on successful emission.
   */
  emitNotificationNew(userId: string, notificationDTO: NotificationDTO): void {
    try {
      const io = this.getSocketIO();
      if (!io) {
        logger.warn('[SocketEmitter] Cannot emit notification:new - Socket.IO not available', {
          userId,
          notificationId: notificationDTO.id,
        });
        return;
      }

      const room = this.getUserRoom(userId);
      io.to(room).emit('notification:new', notificationDTO);

      // Update lifecycle to 'sent' for socket channel
      if (notificationDTO.id) {
        updateLifecycleStatus(notificationDTO.id, "socket", "sent").catch(() => {
          // Non-critical — lifecycle tracking should never block
        });
      }

      logger.info('[SocketEmitter] Emitted notification:new', {
        userId,
        notificationId: notificationDTO.id,
        room,
      });
    } catch (error) {
      logger.error('[SocketEmitter] Failed to emit notification:new', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        notificationId: notificationDTO.id,
      });
    }
  }

  /**
   * Emit a 'notification:read' event to the user's room.
   * Notifies connected clients that a specific notification was marked as read.
   */
  emitNotificationRead(userId: string, notificationId: string): void {
    try {
      const io = this.getSocketIO();
      if (!io) {
        logger.warn('[SocketEmitter] Cannot emit notification:read - Socket.IO not available', {
          userId,
          notificationId,
        });
        return;
      }

      const room = this.getUserRoom(userId);
      io.to(room).emit('notification:read', { notificationId });

      logger.info('[SocketEmitter] Emitted notification:read', {
        userId,
        notificationId,
        room,
      });
    } catch (error) {
      logger.error('[SocketEmitter] Failed to emit notification:read', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        notificationId,
      });
    }
  }

  /**
   * Emit a 'notification:read_all' event to the user's room.
   * Notifies connected clients that all notifications were marked as read.
   */
  emitNotificationReadAll(userId: string): void {
    try {
      const io = this.getSocketIO();
      if (!io) {
        logger.warn('[SocketEmitter] Cannot emit notification:read_all - Socket.IO not available', {
          userId,
        });
        return;
      }

      const room = this.getUserRoom(userId);
      io.to(room).emit('notification:read_all', {});

      logger.info('[SocketEmitter] Emitted notification:read_all', {
        userId,
        room,
      });
    } catch (error) {
      logger.error('[SocketEmitter] Failed to emit notification:read_all', {
        error: error instanceof Error ? error.message : String(error),
        userId,
      });
    }
  }

  /**
   * Emit a 'notification:unread_count' event to the user's room.
   * Sends updated unread count for badge/UI updates.
   */
  emitUnreadCount(userId: string, count: number): void {
    try {
      const io = this.getSocketIO();
      if (!io) {
        logger.warn('[SocketEmitter] Cannot emit notification:unread_count - Socket.IO not available', {
          userId,
          count,
        });
        return;
      }

      const room = this.getUserRoom(userId);
      io.to(room).emit('notification:unread_count', { count });

      logger.info('[SocketEmitter] Emitted notification:unread_count', {
        userId,
        count,
        room,
      });
    } catch (error) {
      logger.error('[SocketEmitter] Failed to emit notification:unread_count', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        count,
      });
    }
  }

  /**
   * Emit a 'notification:sync' event to the user's room.
   * Used for reconnection scenarios — sends missed notifications and current unread count.
   */
  emitNotificationSync(userId: string, notifications: NotificationDTO[], totalUnread: number): void {
    try {
      const io = this.getSocketIO();
      if (!io) {
        logger.warn('[SocketEmitter] Cannot emit notification:sync - Socket.IO not available', {
          userId,
          notificationCount: notifications.length,
        });
        return;
      }

      const room = this.getUserRoom(userId);
      io.to(room).emit('notification:sync', { notifications, totalUnread });

      logger.info('[SocketEmitter] Emitted notification:sync', {
        userId,
        notificationCount: notifications.length,
        totalUnread,
        room,
      });
    } catch (error) {
      logger.error('[SocketEmitter] Failed to emit notification:sync', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        notificationCount: notifications.length,
      });
    }
  }
}

/**
 * Factory function to create a SocketEmitter instance.
 *
 * @param app - Express application instance with Socket.IO attached via app.set("io", io)
 * @returns SocketEmitter instance
 */
export function createSocketEmitter(app: Application): ISocketEmitter {
  return new SocketEmitter(app);
}
