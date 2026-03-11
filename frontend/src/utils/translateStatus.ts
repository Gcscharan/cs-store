/**
 * Translate backend order/payment status strings to user's language
 */

const STATUS_KEYS: Record<string, string> = {
  // Order statuses
  'PENDING': 'status.pending',
  'CONFIRMED': 'status.confirmed',
  'PROCESSING': 'status.processing',
  'OUT_FOR_DELIVERY': 'status.outForDelivery',
  'DELIVERED': 'status.delivered',
  'CANCELLED': 'status.cancelled',
  'RETURNED': 'status.returned',
  'FAILED': 'status.failed',
  'SHIPPED': 'status.shipped',
  'IN_TRANSIT': 'status.inTransit',
  'READY_FOR_PICKUP': 'status.readyForPickup',
  
  // Payment statuses
  'PAID': 'status.paid',
  'UNPAID': 'status.unpaid',
  'REFUNDED': 'status.refunded',
  'PARTIALLY_REFUNDED': 'status.partiallyRefunded',
  'REFUND_PENDING': 'status.refundPending',
  'PAYMENT_PENDING': 'status.paymentPending',
  
  // Refund statuses
  'REQUESTED': 'status.refundRequested',
  'INITIATED': 'status.refundInitiated',
  'COMPLETED': 'status.refundCompleted',
  'PARTIAL': 'status.refundPartial',
};

/**
 * Translate a status string using the translation function
 * @param status - The status string from backend (e.g., "PENDING", "DELIVERED")
 * @param t - The translation function from useLanguage()
 * @returns Translated status string or original if no translation found
 */
export function translateStatus(status: string, t: (key: string) => string): string {
  if (!status) return status;
  const key = STATUS_KEYS[status.toUpperCase()];
  return key ? t(key) : status;
}

/**
 * Translate order status specifically
 */
export function translateOrderStatus(status: string, t: (key: string) => string): string {
  return translateStatus(status, t);
}

/**
 * Translate payment status specifically
 */
export function translatePaymentStatus(status: string, t: (key: string) => string): string {
  return translateStatus(status, t);
}

/**
 * Get status key for a status value
 */
export function getStatusKey(status: string): string | undefined {
  return STATUS_KEYS[status.toUpperCase()];
}
