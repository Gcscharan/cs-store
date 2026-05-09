/**
 * Notification Serializer Utility
 * 
 * This module provides serialization functions for notification data,
 * ensuring consistent API response formatting with ISO 8601 timestamps
 * and ObjectId-to-string conversion.
 * 
 * Requirements: 14.2, 14.5
 */

import { ILowStockNotification } from '../models/LowStockNotification';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Serialized notification format for API responses
 */
export interface SerializedNotification {
  _id: string;
  type: 'LOW_STOCK';
  productId: string;
  productName: string;
  currentStock: number;
  priority: 'LOW' | 'CRITICAL';
  message: string;
  isRead: boolean;
  createdAt: string; // ISO 8601 format
}

/**
 * Paginated notifications data structure
 */
export interface PaginatedNotifications {
  notifications: ILowStockNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Serialized paginated response format
 */
export interface SerializedPaginatedNotifications {
  notifications: SerializedNotification[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================================
// Serialization Functions
// ============================================================================

/**
 * Serialize notification model to API response format
 * 
 * Converts Mongoose document to JSON with:
 * - ObjectIds converted to strings
 * - createdAt formatted as ISO 8601 timestamp string
 * - All required fields included
 * 
 * Requirements: 14.2, 14.5
 * 
 * @param notification - Notification document
 * @returns Serialized notification object
 */
export function serializeNotification(
  notification: ILowStockNotification
): SerializedNotification {
  return {
    _id: notification._id.toString(),
    type: notification.type,
    productId: notification.productId.toString(),
    productName: notification.productName,
    currentStock: notification.currentStock,
    priority: notification.priority,
    message: notification.message,
    isRead: notification.isRead,
    createdAt: notification.createdAt.toISOString()
  };
}

/**
 * Serialize paginated notifications
 * 
 * Converts paginated notification data to API response format with
 * all notifications serialized using serializeNotification.
 * 
 * Requirements: 14.2, 14.5
 * 
 * @param data - Paginated notification data
 * @returns Serialized paginated response
 */
export function serializePaginatedNotifications(
  data: PaginatedNotifications
): SerializedPaginatedNotifications {
  return {
    notifications: data.notifications.map(serializeNotification),
    total: data.total,
    page: data.page,
    limit: data.limit,
    totalPages: data.totalPages
  };
}
