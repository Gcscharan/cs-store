/**
 * Low Stock Notification Controller
 * 
 * Handles admin API endpoints for low stock notification management.
 * Provides notification retrieval, status updates, and deletion.
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.3, 5.4, 5.5, 6.1, 6.3, 6.4, 6.5
 */

import { Request, Response } from 'express';
import { notificationService } from '../services/notificationService';
import { parseQueryOptions } from '../utils/notificationParser';
import {
  serializeNotification,
  serializePaginatedNotifications,
} from '../utils/notificationSerializer';
import { logger } from '../utils/logger';

// AuthRequest type from auth middleware
interface AuthRequest extends Request {
  user?: any;
}

/**
 * GET /admin/notifications
 * 
 * Retrieve paginated notifications with optional filtering
 * Requirements: 4.1, 4.2, 4.3, 4.4
 * 
 * Query Parameters:
 * - page (optional): Page number (default: 1)
 * - limit (optional): Items per page (default: 20)
 * - isRead (optional): Filter by read status (true/false)
 * - priority (optional): Filter by priority (LOW/CRITICAL)
 * 
 * @param req - Authenticated request
 * @param res - Response object
 */
export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    // Parse and validate query parameters
    const queryOptions = parseQueryOptions(req.query);

    // Get notifications from service
    const paginatedData = await notificationService.getNotifications(queryOptions);

    // Serialize response
    const serializedData = serializePaginatedNotifications(paginatedData);

    // Return paginated response with 200 status
    res.status(200).json(serializedData);
  } catch (error: any) {
    logger.error('[NotificationController] Failed to get notifications', {
      error: error.message,
      stack: error.stack,
      query: req.query,
    });

    res.status(500).json({
      error: 'Failed to retrieve notifications',
    });
  }
};

/**
 * PATCH /admin/notifications/:id/read
 * 
 * Mark notification as read
 * Requirements: 5.1, 5.3, 5.4, 5.5
 * 
 * @param req - Authenticated request
 * @param res - Response object
 */
export const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Validate notification ID format
    if (!id) {
      return res.status(400).json({
        error: 'Notification ID is required',
      });
    }

    // Call notification service to mark as read
    const updatedNotification = await notificationService.markAsRead(id);

    // Serialize response
    const serializedNotification = serializeNotification(updatedNotification);

    // Optional: Broadcast status update via socket service
    // This is handled by the service layer if needed

    // Return updated notification with 200 status
    res.status(200).json(serializedNotification);
  } catch (error: any) {
    // Handle 404 for non-existent notification
    if (error.message === 'Notification not found') {
      return res.status(404).json({
        error: 'Notification not found',
      });
    }

    // Handle invalid ID format
    if (error.message === 'Invalid notification ID format') {
      return res.status(400).json({
        error: 'Invalid notification ID format',
      });
    }

    logger.error('[NotificationController] Failed to mark notification as read', {
      error: error.message,
      stack: error.stack,
      notificationId: req.params.id,
    });

    res.status(500).json({
      error: 'Failed to update notification',
    });
  }
};

/**
 * DELETE /admin/notifications/:id
 * 
 * Delete notification
 * Requirements: 6.1, 6.3, 6.4, 6.5
 * 
 * @param req - Authenticated request
 * @param res - Response object
 */
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Validate notification ID format
    if (!id) {
      return res.status(400).json({
        error: 'Notification ID is required',
      });
    }

    // Call notification service to delete notification
    await notificationService.deleteNotification(id);

    // Return 204 status on success
    res.status(204).send();
  } catch (error: any) {
    // Handle 404 for non-existent notification
    if (error.message === 'Notification not found') {
      return res.status(404).json({
        error: 'Notification not found',
      });
    }

    // Handle invalid ID format
    if (error.message === 'Invalid notification ID format') {
      return res.status(400).json({
        error: 'Invalid notification ID format',
      });
    }

    logger.error('[NotificationController] Failed to delete notification', {
      error: error.message,
      stack: error.stack,
      notificationId: req.params.id,
    });

    res.status(500).json({
      error: 'Failed to delete notification',
    });
  }
};

/**
 * POST /admin/register-device
 * 
 * Register device token for push notifications (Phase 4 - Placeholder)
 * Requirements: 16.1, 16.2, 16.3, 16.8
 * 
 * Request Body:
 * - deviceToken (required): Expo push token string
 * - platform (required): Device platform ("ios" or "android")
 * 
 * @param req - Authenticated request
 * @param res - Response object
 */
export const registerDevice = async (req: AuthRequest, res: Response) => {
  try {
    const { deviceToken, platform } = req.body;

    // Validate required fields
    if (!deviceToken || typeof deviceToken !== 'string') {
      return res.status(400).json({
        error: 'Device token is required and must be a string',
      });
    }

    if (!platform || typeof platform !== 'string') {
      return res.status(400).json({
        error: 'Platform is required and must be a string',
      });
    }

    // Validate platform value (Requirement 16.8)
    if (platform !== 'ios' && platform !== 'android') {
      return res.status(400).json({
        error: "Invalid platform. Must be 'ios' or 'android'",
      });
    }

    // Extract adminId from authenticated user
    const adminId = req.user?._id || req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    // TODO: Phase 4 - Integrate with push notification service
    // await pushNotificationService.registerDeviceToken(adminId, deviceToken, platform);
    
    logger.info('[NotificationController] Device token registration (placeholder)', {
      adminId,
      platform,
      message: 'Push notification service not yet implemented - Phase 4',
    });

    // Return placeholder response with 200 status
    // Simulating the expected response structure
    const registeredToken = {
      _id: 'placeholder-id',
      adminId,
      deviceToken,
      platform,
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    res.status(200).json(registeredToken);
  } catch (error: any) {
    logger.error('[NotificationController] Failed to register device token', {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });

    res.status(500).json({
      error: 'Failed to register device token',
    });
  }
};

/**
 * DELETE /admin/unregister-device
 * 
 * Unregister device token for authenticated admin (Phase 4 - Placeholder)
 * Requirements: 18.3, 18.5
 * 
 * @param req - Authenticated request
 * @param res - Response object
 */
export const unregisterDevice = async (req: AuthRequest, res: Response) => {
  try {
    // Extract adminId from authenticated user
    const adminId = req.user?._id || req.user?.id;

    if (!adminId) {
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    // TODO: Phase 4 - Integrate with push notification service
    // await pushNotificationService.unregisterDeviceToken(adminId);
    
    logger.info('[NotificationController] Device token unregistration (placeholder)', {
      adminId,
      message: 'Push notification service not yet implemented - Phase 4',
    });

    // Return 204 status on success
    res.status(204).send();
  } catch (error: any) {
    logger.error('[NotificationController] Failed to unregister device token', {
      error: error.message,
      stack: error.stack,
      adminId: req.user?._id || req.user?.id,
    });

    res.status(500).json({
      error: 'Failed to unregister device token',
    });
  }
};
