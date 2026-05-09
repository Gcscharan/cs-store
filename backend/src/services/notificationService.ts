/**
 * NotificationService - Core service layer for low stock notification management
 * 
 * Provides CRUD operations, duplicate prevention logic, and multi-channel delivery
 * orchestration for the low stock notification system.
 * 
 * Requirements: 2.1, 2.4, 2.6, 3.4, 4.2, 5.2, 6.2, 15.1, 15.2, 15.3, 15.9
 */

import LowStockNotification, { ILowStockNotification } from '../models/LowStockNotification';
import {
  CreateLowStockNotificationDTO,
  NotificationQueryOptions,
} from '../utils/notificationParser';
import mongoose from 'mongoose';
import { Application } from 'express';
import { ISocketService, createLowStockSocketService } from './lowStockSocketService';
import { logger } from '../utils/logger';

export interface PaginatedNotifications {
  notifications: ILowStockNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class NotificationService {
  private socketService: ISocketService | null = null;

  /**
   * Initialize notification service with Express app for Socket.io integration
   * Requirements: 15.1, 15.2
   * 
   * @param app - Express application instance
   */
  initialize(app: Application): void {
    this.socketService = createLowStockSocketService(app);
    logger.info('[NotificationService] Initialized with Socket.io integration');
  }

  /**
   * Create low stock notification with duplicate prevention and multi-channel delivery
   * Requirements: 2.1, 2.4, 2.6, 3.4, 15.1, 15.2, 15.3, 15.9
   * 
   * @param data - Notification creation data
   * @returns Created notification or null if duplicate exists
   */
  async createLowStockNotification(
    data: CreateLowStockNotificationDTO
  ): Promise<ILowStockNotification | null> {
    try {
      // Check for existing unread notification (duplicate prevention)
      const existingNotification = await this.findUnreadNotificationForProduct(data.productId);
      
      if (existingNotification) {
        // Skip creation - duplicate prevention
        return null;
      }

      // Generate message based on priority
      const message = this.generateMessage(data.productName, data.currentStock, data.priority);

      // Create notification in database
      const notification = new LowStockNotification({
        type: 'LOW_STOCK',
        productId: new mongoose.Types.ObjectId(data.productId),
        productName: data.productName,
        currentStock: data.currentStock,
        priority: data.priority,
        message,
        isRead: false,
      });

      const savedNotification = await notification.save();

      // Orchestrate multi-channel delivery (non-blocking)
      // Requirements: 15.1, 15.2, 15.3, 15.9
      await this.deliverNotification(savedNotification);

      return savedNotification;
    } catch (error: any) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }
  }

  /**
   * Orchestrate multi-channel notification delivery
   * Requirements: 15.1, 15.2, 15.3, 15.9
   * 
   * Uses Promise.allSettled for graceful error handling - delivery failures
   * do not block notification creation. Logs errors but continues execution.
   * 
   * @param notification - Notification to deliver
   */
  private async deliverNotification(notification: ILowStockNotification): Promise<void> {
    // Parallel delivery with graceful error handling
    const deliveryPromises: Promise<void>[] = [];

    // Socket.io delivery (web dashboard)
    if (this.socketService) {
      deliveryPromises.push(
        Promise.resolve().then(() => this.socketService!.broadcastLowStockAlert(notification))
      );
    } else {
      logger.warn(
        '[NotificationService] Socket service not initialized - skipping Socket.io delivery',
        { notificationId: notification._id }
      );
    }

    // Push notification delivery (mobile) - Phase 4, skipped for now
    // deliveryPromises.push(
    //   pushNotificationService.sendLowStockAlert(notification)
    // );

    // Execute all deliveries in parallel with graceful error handling
    const results = await Promise.allSettled(deliveryPromises);

    // Log delivery results
    results.forEach((result, index) => {
      const channel = index === 0 ? 'Socket.io' : 'Push Notification';
      
      if (result.status === 'rejected') {
        logger.error(
          `[NotificationService] ${channel} delivery failed`,
          {
            notificationId: notification._id,
            productId: notification.productId,
            error: result.reason,
          }
        );
      } else {
        logger.info(
          `[NotificationService] ${channel} delivery succeeded`,
          {
            notificationId: notification._id,
            productId: notification.productId,
          }
        );
      }
    });
  }

  /**
   * Get notifications with pagination and filtering
   * Requirements: 4.2
   * 
   * @param options - Query options (pagination, filters, sorting)
   * @returns Paginated notifications
   */
  async getNotifications(
    options: NotificationQueryOptions
  ): Promise<PaginatedNotifications> {
    const {
      page = 1,
      limit = 20,
      isRead,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    const offset = (page - 1) * limit;

    // Build filter query
    const filter: any = {};
    if (isRead !== undefined) {
      filter.isRead = isRead;
    }
    if (priority) {
      filter.priority = priority;
    }

    // Build sort query
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Get notifications with filtering and sorting
    const notifications = await LowStockNotification.find(filter)
      .sort(sort)
      .skip(offset)
      .limit(limit)
      .lean();

    // Get total count for pagination
    const total = await LowStockNotification.countDocuments(filter);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return {
      notifications: notifications as unknown as ILowStockNotification[],
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * Mark notification as read
   * Requirements: 5.2
   * 
   * @param notificationId - Notification to mark as read
   * @returns Updated notification
   * @throws Error if notification not found
   */
  async markAsRead(notificationId: string): Promise<ILowStockNotification> {
    // Validate ObjectId format
    if (!mongoose.isValidObjectId(notificationId)) {
      throw new Error('Invalid notification ID format');
    }

    // Find and update notification
    const notification = await LowStockNotification.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  }

  /**
   * Delete notification
   * Requirements: 6.2
   * 
   * @param notificationId - Notification to delete
   * @throws Error if notification not found
   */
  async deleteNotification(notificationId: string): Promise<void> {
    // Validate ObjectId format
    if (!mongoose.isValidObjectId(notificationId)) {
      throw new Error('Invalid notification ID format');
    }

    // Find and delete notification
    const result = await LowStockNotification.findByIdAndDelete(notificationId);

    if (!result) {
      throw new Error('Notification not found');
    }
  }

  /**
   * Find unread notification for product (duplicate detection helper)
   * Requirements: 2.6
   * 
   * @param productId - Product to check
   * @returns Existing unread notification or null
   */
  async findUnreadNotificationForProduct(
    productId: string
  ): Promise<ILowStockNotification | null> {
    // Validate ObjectId format
    if (!mongoose.isValidObjectId(productId)) {
      throw new Error('Invalid product ID format');
    }

    const notification = await LowStockNotification.findOne({
      productId: new mongoose.Types.ObjectId(productId),
      isRead: false,
    });

    return notification;
  }

  /**
   * Generate notification message based on priority
   * Requirements: 2.4, 3.4
   * 
   * @param productName - Product name
   * @param currentStock - Current stock level
   * @param priority - Notification priority
   * @returns Formatted message
   */
  private generateMessage(
    productName: string,
    currentStock: number,
    priority: 'LOW' | 'CRITICAL'
  ): string {
    if (priority === 'CRITICAL') {
      return `🚨 CRITICAL: ${productName} has only ${currentStock} left`;
    }
    return `Low stock: ${productName} has only ${currentStock} left`;
  }
}

export const notificationService = new NotificationService();
