/**
 * @vyaparsetu/shared-utils
 * 
 * Shared business logic utilities for VyaparSetu web and mobile apps.
 * 
 * @packageDocumentation
 */

// ============================================================================
// Delivery Fee Calculator
// ============================================================================

export {
  // Types
  type DeliveryAddress,
  type DeliveryFeeResult,
  type DeliveryFeeBreakdown,
  
  // Configuration
  WAREHOUSE_ADDRESS,
  DELIVERY_CONFIG,
  
  // Functions
  calculateDistance,
  calculateDeliveryFee,
  getDeliveryFeeBreakdown,
  getWarehouseAddress,
  getAdminAddress,
  isDeliveryAvailable,
  isValidPincode,
  formatDeliveryFee,
  calculateDeliveryFeeForPincode,
} from "./delivery";

// ============================================================================
// Pincode Validation
// ============================================================================

export {
  // Types
  type PincodeData,
  type PincodeInfo,
  
  // Constants
  PINCODE_CORRECTIONS,
  ANDHRA_PRADESH_RANGES,
  TELANGANA_RANGES,
  
  // Functions
  validatePincode,
  isValidPincodeFormat,
  isPincodeDeliverable,
  getFallbackPincodeData,
  fetchPincodeFromAPI,
  getDeliveryStatusMessage,
  getPincodeInfo,
  clearPincodeCache,
  getCachedPincode,
} from "./pincode";

// ============================================================================
// Customer Order Timeline
// ============================================================================

export {
  // Types
  type TimelineStepState,
  type BackendTimelineStep,
  type CustomerTimelineStep,
  
  // Constants
  CUSTOMER_MILESTONES,
  
  // Functions
  buildCustomerOrderTimeline,
  getCurrentMilestone,
  isTerminalState as isTimelineTerminalState,
  getTimelineEta,
} from "./timeline";

// ============================================================================
// Payment State Machine
// ============================================================================

export {
  // Types
  type PaymentStatus,
  type PaymentMethod,
  type PaymentEvent,
  type PaymentState,
  type PaymentTransition,
  
  // Constants
  PAYMENT_TRANSITIONS,
  TERMINAL_STATES as PAYMENT_TERMINAL_STATES,
  SUCCESS_STATES as PAYMENT_SUCCESS_STATES,
  REFUNDABLE_STATES as PAYMENT_REFUNDABLE_STATES,
  
  // Functions
  canTransition as canPaymentTransition,
  getNextStatus as getNextPaymentStatus,
  isTerminalState as isPaymentTerminalState,
  isSuccessfulPayment,
  canRefund,
  isPending as isPaymentPending,
  getValidEvents as getValidPaymentEvents,
  createInitialPaymentState,
  applyPaymentEvent,
  getPaymentStatusText,
  getPaymentStatusColor,
} from "./payment";
