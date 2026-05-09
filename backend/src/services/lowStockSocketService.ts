/**
 * Low Stock Socket Service - Real-time broadcasting for low stock notifications
 * 
 * Provides Socket.io integration for broadcasting low stock alerts to admin clients
 * in real-time. Handles graceful error handling and uses the existing Socket.io
 * instance from the Express app.
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { Application } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { ILowStockNotification } from '../models/LowStockNotification';
import { logger } from '../utils/logger';

export interface ISocketService {
  /**
   * Broadcast low stock alert to admin_room
   * Requirements: 7.1, 7.2, 7.4, 7.5
   * 
   * @param notification - Notification to broadcast
   */
  broadcastLowStockAlert(notification: ILowStockNotification): void;

  /**
   * Broadcast notification status update (optional)
   * 
   * @param notificationId - Updated notification ID
   * @param isRead - New read status
   */
  broadcastNotificationStatusUpdate(
    notificationId: string,
    isRead: boolean
  ): void;
}

export class LowStockSocketService implements ISocketService {
  private app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  /**
   * Get Socket.io instance from Express app
   * Requirements: 7.3
   * 
   * @returns Socket.io server instance or null if not available
   */
  private getSocketIO(): SocketIOServer | null {
    try {
      const io = this.app.get('io') as SocketIOServer;
      if (!io) {
        logger.warn('[LowStockSocketService] Socket.io instance not found on app');
        return null;
      }
      return io;
    } catch (error) {
      logger.error('[LowStockSocketService] Error accessing Socket.io instance:', error);
      return null;
    }
  }

  /**
   * Broadcast low stock alert to admin_room
   * Requirements: 7.1, 7.2, 7.4, 7.5
   * 
   * Emits "low_stock_alert" event to all connected admin clients in the admin_room.
   * Includes complete notification object in the payload.
   * Handles Socket.io errors gracefully by logging and continuing.
   * 
   * @param notification - Complete notification object to broadcast
   */
  broadcastLowStockAlert(notification: ILowStockNotification): void {
    try {
      const io = this.getSocketIO();
      
      if (!io) {
        // Log warning but don't throw - graceful degradation
        logger.warn(
          '[LowStockSocketService] Cannot broadcast low stock alert - Socket.io not available',
          { notificationId: notification._id, productId: notification.productId }
        );
        return;
      }

      // Broadcast to admin_room with complete notification object
      io.to('admin_room').emit('low_stock_alert', {
        notification: {
          _id: notification._id.toString(),
          type: notification.type,
          productId: notification.productId.toString(),
          productName: notification.productName,
          currentStock: notification.currentStock,
          priority: notification.priority,
          message: notification.message,
          isRead: notification.isRead,
          createdAt: notification.createdAt.toISOString(),
        },
      });

      logger.info(
        '[LowStockSocketService] Low stock alert broadcasted to admin_room',
        {
          notificationId: notification._id,
          productId: notification.productId,
          productName: notification.productName,
          priority: notification.priority,
        }
      );
    } catch (error) {
      // Graceful error handling - log and continue
      logger.error(
        '[LowStockSocketService] Failed to broadcast low stock alert',
        {
          error: error instanceof Error ? error.message : String(error),
          notificationId: notification._id,
          productId: notification.productId,
        }
      );
      // Don't throw - allow notification creation to succeed even if broadcast fails
    }
  }

  /**
   * Broadcast notification status update (optional)
   * 
   * Emits "notification:status:update" event when a notification's read status changes.
   * This allows admin clients to update their UI in real-time when notifications
   * are marked as read.
   * 
   * @param notificationId - ID of the updated notification
   * @param isRead - New read status
   */
  broadcastNotificationStatusUpdate(
    notificationId: string,
    isRead: boolean
  ): void {
    try {
      const io = this.getSocketIO();
      
      if (!io) {
        logger.warn(
          '[LowStockSocketService] Cannot broadcast status update - Socket.io not available',
          { notificationId, isRead }
        );
        return;
      }

      // Broadcast status update to admin_room
      io.to('admin_room').emit('notification:status:update', {
        notificationId,
        isRead,
        updatedAt: new Date().toISOString(),
      });

      logger.info(
        '[LowStockSocketService] Notification status update broadcasted',
        { notificationId, isRead }
      );
    } catch (error) {
      // Graceful error handling - log and continue
      logger.error(
        '[LowStockSocketService] Failed to broadcast status update',
        {
          error: error instanceof Error ? error.message : String(error),
          notificationId,
          isRead,
        }
      );
    }
  }
}

/**
 * Factory function to create socket service instance
 * 
 * @param app - Express application instance
 * @returns Socket service instance
 */
export function createLowStockSocketService(app: Application): ISocketService {
  return new LowStockSocketService(app);
}
