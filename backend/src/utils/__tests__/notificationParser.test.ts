/**
 * Unit tests for notification parser utility
 * 
 * Tests validation logic for notification creation data
 */

import {
  parseCreateNotificationData,
  parseQueryOptions,
  isValidPriority,
  isValidCreateNotificationDTO
} from '../notificationParser';

describe('notificationParser', () => {
  describe('parseCreateNotificationData', () => {
    it('should parse valid notification data', () => {
      const validData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      const result = parseCreateNotificationData(validData);

      expect(result).toEqual({
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW'
      });
    });

    it('should trim productName whitespace', () => {
      const validData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: '  Organic Tomatoes  ',
        currentStock: 8,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      const result = parseCreateNotificationData(validData);

      expect(result.productName).toBe('Organic Tomatoes');
    });

    it('should throw error for missing type field', () => {
      const invalidData = {
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'Validation failed'
      );
      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'type must be "LOW_STOCK"'
      );
    });

    it('should throw error for invalid type field', () => {
      const invalidData = {
        type: 'INVALID_TYPE',
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'type must be "LOW_STOCK"'
      );
    });

    it('should throw error for missing productId', () => {
      const invalidData = {
        type: 'LOW_STOCK',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'productId is required'
      );
    });

    it('should throw error for invalid productId', () => {
      const invalidData = {
        type: 'LOW_STOCK',
        productId: 'invalid-id',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'productId must be a valid MongoDB ObjectId'
      );
    });

    it('should throw error for missing productName', () => {
      const invalidData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        currentStock: 8,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'productName is required'
      );
    });

    it('should throw error for empty productName', () => {
      const invalidData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: '   ',
        currentStock: 8,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'productName cannot be empty'
      );
    });

    it('should throw error for productName exceeding 200 characters', () => {
      const longName = 'A'.repeat(201);
      const invalidData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: longName,
        currentStock: 8,
        priority: 'LOW',
        message: 'Low stock'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'productName cannot exceed 200 characters'
      );
    });

    it('should throw error for missing currentStock', () => {
      const invalidData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'currentStock is required'
      );
    });

    it('should throw error for non-integer currentStock', () => {
      const invalidData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8.5,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'currentStock must be an integer'
      );
    });

    it('should throw error for negative currentStock', () => {
      const invalidData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: -1,
        priority: 'LOW',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'currentStock must be non-negative'
      );
    });

    it('should accept currentStock of 0', () => {
      const validData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 0,
        priority: 'CRITICAL',
        message: 'Low stock: Organic Tomatoes has only 0 left'
      };

      const result = parseCreateNotificationData(validData);

      expect(result.currentStock).toBe(0);
    });

    it('should throw error for missing priority', () => {
      const invalidData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'priority is required'
      );
    });

    it('should throw error for invalid priority', () => {
      const invalidData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'MEDIUM',
        message: 'Low stock: Organic Tomatoes has only 8 left'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'priority must be either "LOW" or "CRITICAL"'
      );
    });

    it('should throw error for missing message', () => {
      const invalidData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW'
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'message is required'
      );
    });

    it('should throw error for empty message', () => {
      const invalidData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW',
        message: '   '
      };

      expect(() => parseCreateNotificationData(invalidData)).toThrow(
        'message cannot be empty'
      );
    });

    it('should accept CRITICAL priority', () => {
      const validData = {
        type: 'LOW_STOCK',
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 2,
        priority: 'CRITICAL',
        message: '🚨 CRITICAL: Organic Tomatoes has only 2 left'
      };

      const result = parseCreateNotificationData(validData);

      expect(result.priority).toBe('CRITICAL');
    });
  });

  describe('parseQueryOptions', () => {
    it('should parse valid query options', () => {
      const query = {
        page: '2',
        limit: '10',
        isRead: 'true',
        priority: 'LOW',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      const result = parseQueryOptions(query);

      expect(result).toEqual({
        page: 2,
        limit: 10,
        isRead: true,
        priority: 'LOW',
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
    });

    it('should handle empty query', () => {
      const result = parseQueryOptions({});

      expect(result).toEqual({});
    });

    it('should default invalid page to 1', () => {
      const query = { page: 'invalid' };

      const result = parseQueryOptions(query);

      expect(result.page).toBe(1);
    });

    it('should default negative page to 1', () => {
      const query = { page: '-1' };

      const result = parseQueryOptions(query);

      expect(result.page).toBe(1);
    });

    it('should default invalid limit to 20', () => {
      const query = { limit: 'invalid' };

      const result = parseQueryOptions(query);

      expect(result.limit).toBe(20);
    });

    it('should cap limit at 100', () => {
      const query = { limit: '200' };

      const result = parseQueryOptions(query);

      expect(result.limit).toBe(20);
    });

    it('should parse isRead as boolean', () => {
      const query1 = { isRead: 'true' };
      const query2 = { isRead: 'false' };

      const result1 = parseQueryOptions(query1);
      const result2 = parseQueryOptions(query2);

      expect(result1.isRead).toBe(true);
      expect(result2.isRead).toBe(false);
    });

    it('should ignore invalid priority', () => {
      const query = { priority: 'INVALID' };

      const result = parseQueryOptions(query);

      expect(result.priority).toBeUndefined();
    });

    it('should accept valid priority values', () => {
      const query1 = { priority: 'LOW' };
      const query2 = { priority: 'CRITICAL' };

      const result1 = parseQueryOptions(query1);
      const result2 = parseQueryOptions(query2);

      expect(result1.priority).toBe('LOW');
      expect(result2.priority).toBe('CRITICAL');
    });

    it('should ignore invalid sortBy', () => {
      const query = { sortBy: 'invalid' };

      const result = parseQueryOptions(query);

      expect(result.sortBy).toBeUndefined();
    });

    it('should accept valid sortBy values', () => {
      const query1 = { sortBy: 'createdAt' };
      const query2 = { sortBy: 'priority' };

      const result1 = parseQueryOptions(query1);
      const result2 = parseQueryOptions(query2);

      expect(result1.sortBy).toBe('createdAt');
      expect(result2.sortBy).toBe('priority');
    });

    it('should ignore invalid sortOrder', () => {
      const query = { sortOrder: 'invalid' };

      const result = parseQueryOptions(query);

      expect(result.sortOrder).toBeUndefined();
    });

    it('should accept valid sortOrder values', () => {
      const query1 = { sortOrder: 'asc' };
      const query2 = { sortOrder: 'desc' };

      const result1 = parseQueryOptions(query1);
      const result2 = parseQueryOptions(query2);

      expect(result1.sortOrder).toBe('asc');
      expect(result2.sortOrder).toBe('desc');
    });
  });

  describe('isValidPriority', () => {
    it('should return true for LOW', () => {
      expect(isValidPriority('LOW')).toBe(true);
    });

    it('should return true for CRITICAL', () => {
      expect(isValidPriority('CRITICAL')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isValidPriority('MEDIUM')).toBe(false);
      expect(isValidPriority('HIGH')).toBe(false);
      expect(isValidPriority('')).toBe(false);
      expect(isValidPriority(null)).toBe(false);
      expect(isValidPriority(undefined)).toBe(false);
      expect(isValidPriority(123)).toBe(false);
    });
  });

  describe('isValidCreateNotificationDTO', () => {
    it('should return true for valid DTO', () => {
      const validDTO = {
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW'
      };

      expect(isValidCreateNotificationDTO(validDTO)).toBe(true);
    });

    it('should return false for invalid productId', () => {
      const invalidDTO = {
        productId: 'invalid-id',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'LOW'
      };

      expect(isValidCreateNotificationDTO(invalidDTO)).toBe(false);
    });

    it('should return false for empty productName', () => {
      const invalidDTO = {
        productId: '507f1f77bcf86cd799439011',
        productName: '   ',
        currentStock: 8,
        priority: 'LOW'
      };

      expect(isValidCreateNotificationDTO(invalidDTO)).toBe(false);
    });

    it('should return false for productName exceeding 200 characters', () => {
      const invalidDTO = {
        productId: '507f1f77bcf86cd799439011',
        productName: 'A'.repeat(201),
        currentStock: 8,
        priority: 'LOW'
      };

      expect(isValidCreateNotificationDTO(invalidDTO)).toBe(false);
    });

    it('should return false for negative currentStock', () => {
      const invalidDTO = {
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: -1,
        priority: 'LOW'
      };

      expect(isValidCreateNotificationDTO(invalidDTO)).toBe(false);
    });

    it('should return false for non-integer currentStock', () => {
      const invalidDTO = {
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8.5,
        priority: 'LOW'
      };

      expect(isValidCreateNotificationDTO(invalidDTO)).toBe(false);
    });

    it('should return false for invalid priority', () => {
      const invalidDTO = {
        productId: '507f1f77bcf86cd799439011',
        productName: 'Organic Tomatoes',
        currentStock: 8,
        priority: 'MEDIUM'
      };

      expect(isValidCreateNotificationDTO(invalidDTO)).toBe(false);
    });

    it('should return false for missing fields', () => {
      expect(isValidCreateNotificationDTO({})).toBe(false);
      expect(isValidCreateNotificationDTO(null)).toBe(false);
      expect(isValidCreateNotificationDTO(undefined)).toBe(false);
    });
  });
});
