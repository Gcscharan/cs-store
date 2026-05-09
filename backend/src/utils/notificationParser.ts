/**
 * Notification Parser Utility
 * 
 * This module provides validation and parsing functions for notification data,
 * ensuring data integrity across API boundaries.
 * 
 * Requirements: 14.1, 14.3, 14.4
 */

import mongoose from 'mongoose';

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface CreateLowStockNotificationDTO {
  productId: string;
  productName: string;
  currentStock: number;
  priority: 'LOW' | 'CRITICAL';
}

export interface NotificationQueryOptions {
  page?: number;
  limit?: number;
  isRead?: boolean;
  priority?: 'LOW' | 'CRITICAL';
  sortBy?: 'createdAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates that a field is present and not empty
 * 
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns ValidationResult
 */
function validateRequired(value: any, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (value === null || value === undefined) {
    errors.push({
      field: fieldName,
      message: `${fieldName} is required`,
      value
    });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates that a value is a valid MongoDB ObjectId
 * 
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns ValidationResult
 */
function validateObjectId(value: any, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!value) {
    errors.push({
      field: fieldName,
      message: `${fieldName} is required`,
      value
    });
    return { isValid: false, errors };
  }

  if (typeof value !== 'string') {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a string`,
      value
    });
    return { isValid: false, errors };
  }

  if (!mongoose.isValidObjectId(value)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a valid MongoDB ObjectId`,
      value
    });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates that a string is non-empty and within max length
 * 
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @param maxLength - Maximum allowed length
 * @returns ValidationResult
 */
function validateString(
  value: any,
  fieldName: string,
  maxLength?: number
): ValidationResult {
  const errors: ValidationError[] = [];

  if (value === null || value === undefined) {
    errors.push({
      field: fieldName,
      message: `${fieldName} is required`,
      value
    });
    return { isValid: false, errors };
  }

  if (typeof value !== 'string') {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a string`,
      value
    });
    return { isValid: false, errors };
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    errors.push({
      field: fieldName,
      message: `${fieldName} cannot be empty`,
      value
    });
  }

  if (maxLength && trimmed.length > maxLength) {
    errors.push({
      field: fieldName,
      message: `${fieldName} cannot exceed ${maxLength} characters`,
      value
    });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates that a value is a non-negative integer
 * 
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns ValidationResult
 */
function validateNonNegativeInteger(
  value: any,
  fieldName: string
): ValidationResult {
  const errors: ValidationError[] = [];

  if (value === null || value === undefined) {
    errors.push({
      field: fieldName,
      message: `${fieldName} is required`,
      value
    });
    return { isValid: false, errors };
  }

  if (typeof value !== 'number') {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a number`,
      value
    });
    return { isValid: false, errors };
  }

  if (!Number.isInteger(value)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be an integer`,
      value
    });
    return { isValid: false, errors };
  }

  if (value < 0) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be non-negative`,
      value
    });
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * Validates that a value is a valid priority level
 * 
 * @param value - The value to validate
 * @param fieldName - Name of the field for error messages
 * @returns ValidationResult
 */
function validatePriority(value: any, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (value === null || value === undefined) {
    errors.push({
      field: fieldName,
      message: `${fieldName} is required`,
      value
    });
    return { isValid: false, errors };
  }

  if (typeof value !== 'string') {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be a string`,
      value
    });
    return { isValid: false, errors };
  }

  if (value !== 'LOW' && value !== 'CRITICAL') {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be either "LOW" or "CRITICAL"`,
      value
    });
  }

  return { isValid: errors.length === 0, errors };
}

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Parse and validate notification creation data
 * 
 * Requirements: 14.1, 14.3, 14.4
 * 
 * @param data - Raw notification data
 * @returns Validated notification DTO
 * @throws Error if required fields missing or invalid
 */
export function parseCreateNotificationData(
  data: any
): CreateLowStockNotificationDTO {
  const errors: ValidationError[] = [];

  // Validate type field (must be "LOW_STOCK")
  if (data.type !== 'LOW_STOCK') {
    errors.push({
      field: 'type',
      message: 'type must be "LOW_STOCK"',
      value: data.type
    });
  }

  // Validate productId
  const productIdValidation = validateObjectId(data.productId, 'productId');
  if (!productIdValidation.isValid) {
    errors.push(...productIdValidation.errors);
  }

  // Validate productName (max 200 characters)
  const productNameValidation = validateString(
    data.productName,
    'productName',
    200
  );
  if (!productNameValidation.isValid) {
    errors.push(...productNameValidation.errors);
  }

  // Validate currentStock (non-negative integer)
  const currentStockValidation = validateNonNegativeInteger(
    data.currentStock,
    'currentStock'
  );
  if (!currentStockValidation.isValid) {
    errors.push(...currentStockValidation.errors);
  }

  // Validate priority
  const priorityValidation = validatePriority(data.priority, 'priority');
  if (!priorityValidation.isValid) {
    errors.push(...priorityValidation.errors);
  }

  // Validate message (required, non-empty string)
  const messageValidation = validateString(data.message, 'message');
  if (!messageValidation.isValid) {
    errors.push(...messageValidation.errors);
  }

  // If there are validation errors, throw an error with details
  if (errors.length > 0) {
    const errorMessages = errors.map(e => `${e.field}: ${e.message}`).join('; ');
    throw new Error(`Validation failed: ${errorMessages}`);
  }

  // Return validated DTO
  return {
    productId: data.productId,
    productName: data.productName.trim(),
    currentStock: data.currentStock,
    priority: data.priority
  };
}

/**
 * Parse notification query parameters
 * 
 * Requirements: 14.1
 * 
 * @param query - Raw query parameters
 * @returns Validated query options
 */
export function parseQueryOptions(query: any): NotificationQueryOptions {
  const options: NotificationQueryOptions = {};

  // Parse page (default: 1)
  if (query.page !== undefined) {
    const page = parseInt(query.page, 10);
    if (!isNaN(page) && page > 0) {
      options.page = page;
    } else {
      options.page = 1;
    }
  }

  // Parse limit (default: 20)
  if (query.limit !== undefined) {
    const limit = parseInt(query.limit, 10);
    if (!isNaN(limit) && limit > 0 && limit <= 100) {
      options.limit = limit;
    } else {
      options.limit = 20;
    }
  }

  // Parse isRead (boolean)
  if (query.isRead !== undefined) {
    if (query.isRead === 'true' || query.isRead === true) {
      options.isRead = true;
    } else if (query.isRead === 'false' || query.isRead === false) {
      options.isRead = false;
    }
  }

  // Parse priority
  if (query.priority !== undefined) {
    if (query.priority === 'LOW' || query.priority === 'CRITICAL') {
      options.priority = query.priority;
    }
  }

  // Parse sortBy (default: 'createdAt')
  if (query.sortBy !== undefined) {
    if (query.sortBy === 'createdAt' || query.sortBy === 'priority') {
      options.sortBy = query.sortBy;
    }
  }

  // Parse sortOrder (default: 'desc')
  if (query.sortOrder !== undefined) {
    if (query.sortOrder === 'asc' || query.sortOrder === 'desc') {
      options.sortOrder = query.sortOrder;
    }
  }

  return options;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid priority
 * 
 * @param value - The value to check
 * @returns boolean indicating if the value is a valid priority
 */
export function isValidPriority(value: any): value is 'LOW' | 'CRITICAL' {
  return value === 'LOW' || value === 'CRITICAL';
}

/**
 * Type guard to check if a value is a valid CreateLowStockNotificationDTO
 * 
 * @param value - The value to check
 * @returns boolean indicating if the value is valid
 */
export function isValidCreateNotificationDTO(
  value: any
): value is CreateLowStockNotificationDTO {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    typeof value.productId === 'string' &&
    mongoose.isValidObjectId(value.productId) &&
    typeof value.productName === 'string' &&
    value.productName.trim().length > 0 &&
    value.productName.length <= 200 &&
    typeof value.currentStock === 'number' &&
    Number.isInteger(value.currentStock) &&
    value.currentStock >= 0 &&
    isValidPriority(value.priority)
  );
}
