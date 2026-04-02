/**
 * Error Classifier
 * 
 * Classifies errors to determine retry behavior
 * CRITICAL: Wrong classification = infinite retries or lost data
 */

export enum ErrorType {
  TRANSIENT = 'TRANSIENT',     // Retry (network, timeout)
  PERMANENT = 'PERMANENT',     // Don't retry (logic error)
  VALIDATION = 'VALIDATION',   // Don't retry (bad data)
}

/**
 * Classify error to determine if job should retry
 */
export function classifyError(error: any): ErrorType {
  const errorMessage = error?.message || '';
  const errorName = error?.name || '';

  // Validation errors - bad data, don't retry
  if (errorMessage === 'INVALID_DATA') {
    return ErrorType.VALIDATION;
  }
  if (errorMessage.includes('validation failed')) {
    return ErrorType.VALIDATION;
  }
  if (errorName === 'ValidationError') {
    return ErrorType.VALIDATION;
  }

  // Transient errors - network/timeout, retry
  if (errorName === 'MongoNetworkError') {
    return ErrorType.TRANSIENT;
  }
  if (errorName === 'MongoTimeoutError') {
    return ErrorType.TRANSIENT;
  }
  if (errorMessage.includes('ECONNREFUSED')) {
    return ErrorType.TRANSIENT;
  }
  if (errorMessage.includes('ETIMEDOUT')) {
    return ErrorType.TRANSIENT;
  }
  if (errorMessage.includes('connection')) {
    return ErrorType.TRANSIENT;
  }

  // Default: permanent (don't retry unknown errors infinitely)
  return ErrorType.PERMANENT;
}

/**
 * Check if error should trigger retry
 */
export function shouldRetry(error: any): boolean {
  const type = classifyError(error);
  return type === ErrorType.TRANSIENT;
}
