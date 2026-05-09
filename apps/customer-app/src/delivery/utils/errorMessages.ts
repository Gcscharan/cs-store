/**
 * Driver-Friendly Error Messages
 *
 * Maps technical errors to plain-language messages with actionable guidance.
 * NO technical jargon — no HTTP codes, "sync", "queue", "API".
 *
 * Requirements: 13.1-13.7
 */

// ─── Error Message Map ────────────────────────────────────────────────────────

/**
 * Mapping from technical error codes to driver-friendly messages.
 *
 * Each message:
 * - Uses plain language (no HTTP codes, no "sync", "queue", "API")
 * - Includes actionable guidance
 * - Tells the driver what to do next
 *
 * Requirements: 13.1-13.7
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // ── Network errors (Requirement 13.2) ─────────────────────────────────────
  NETWORK_ERROR:
    'Connection issue — your action has been saved and will be sent when you reconnect.',
  NETWORK_TIMEOUT:
    'Connection is slow — your action has been saved and will be sent automatically.',
  OFFLINE:
    'You are offline — your action has been saved and will be sent when you reconnect.',

  // ── Server errors (Requirement 13.3) ──────────────────────────────────────
  SERVER_ERROR:
    'Something went wrong on our end — we will retry automatically. You can continue with other deliveries.',
  SERVICE_UNAVAILABLE:
    'Service is temporarily unavailable — we will retry automatically. You can continue with other deliveries.',

  // ── OTP errors (Requirement 13.4, 13.6) ───────────────────────────────────
  OTP_INVALID:
    'Incorrect OTP — please ask the customer for the correct code and try again.',
  OTP_EXPIRED:
    'OTP has expired — ask the customer to request a new one, then try again.',
  OTP_REQUIRED:
    'Cannot complete delivery — please enter the OTP from the customer first.',
  OTP_MAX_ATTEMPTS:
    'Too many incorrect attempts — ask the customer to request a new OTP.',

  // ── COD errors (Requirement 13.4) ─────────────────────────────────────────
  COD_REQUIRED:
    'Cannot complete delivery — please collect the cash payment from the customer first.',
  COD_ALREADY_COLLECTED:
    'Payment has already been recorded for this order.',
  COD_AMOUNT_MISMATCH:
    'Payment amount does not match — please check the order amount and try again.',

  // ── Business logic blocks (Requirement 13.4) ──────────────────────────────
  ALREADY_DELIVERED:
    'This order has already been delivered.',
  ORDER_CANCELLED:
    'This order has been cancelled — no further action needed.',
  ORDER_NOT_FOUND:
    'Order not found — pull down to refresh and try again.',
  INVALID_STATUS_TRANSITION:
    'This action is not available right now — pull down to refresh and try again.',
  PICKUP_REQUIRED:
    'Cannot start delivery — please mark the order as picked up first.',
  ARRIVAL_REQUIRED:
    'Cannot start delivery — please mark yourself as arrived at the customer location first.',
  DUPLICATE_ACTION:
    'This action was already completed — pull down to refresh to see the latest status.',

  // ── Auth / permission errors ───────────────────────────────────────────────
  UNAUTHORIZED:
    'Your session has expired — please log out and log back in to continue.',
  FORBIDDEN:
    'You do not have permission to perform this action. Contact support if this continues.',

  // ── Generic fallback ───────────────────────────────────────────────────────
  UNKNOWN:
    'Something went wrong — please try again. Contact support if this keeps happening.',
};

// ─── Utility Function ─────────────────────────────────────────────────────────

/**
 * Converts a technical error into a driver-friendly plain-language message.
 *
 * Handles:
 * - Network errors (no status code)
 * - Server errors (5xx)
 * - OTP errors
 * - COD errors
 * - Business logic blocks (4xx with error codes)
 *
 * Never returns technical jargon — always returns an actionable message.
 *
 * @param error - The error object from an API call or catch block
 * @returns A plain-language, actionable message for the driver
 *
 * Requirements: 13.1-13.7
 *
 * @example
 * ```ts
 * try {
 *   await verifyOtp(orderId, otp);
 * } catch (error) {
 *   const message = getDriverFriendlyError(error);
 *   Alert.alert('Error', message);
 * }
 * ```
 */
export const getDriverFriendlyError = (error: any): string => {
  // ── No status = network/connectivity error (Requirement 13.2) ─────────────
  if (!error?.status) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  // ── 5xx = server error (Requirement 13.3) ─────────────────────────────────
  if (typeof error.status === 'number' && error.status >= 500) {
    return ERROR_MESSAGES.SERVER_ERROR;
  }

  // ── 503 specifically ──────────────────────────────────────────────────────
  if (error.status === 503) {
    return ERROR_MESSAGES.SERVICE_UNAVAILABLE;
  }

  // ── 401 = unauthorized ────────────────────────────────────────────────────
  if (error.status === 401) {
    return ERROR_MESSAGES.UNAUTHORIZED;
  }

  // ── 403 = forbidden ───────────────────────────────────────────────────────
  if (error.status === 403) {
    return ERROR_MESSAGES.FORBIDDEN;
  }

  // ── 404 = not found ───────────────────────────────────────────────────────
  if (error.status === 404) {
    return ERROR_MESSAGES.ORDER_NOT_FOUND;
  }

  // ── 409 = conflict (duplicate action) ────────────────────────────────────
  if (error.status === 409) {
    return ERROR_MESSAGES.DUPLICATE_ACTION;
  }

  // ── Check for specific error code in response body ────────────────────────
  const code: string | undefined = error?.data?.code;
  if (code && ERROR_MESSAGES[code]) {
    return ERROR_MESSAGES[code];
  }

  // ── Check for error message in response body ──────────────────────────────
  // Only use if it doesn't contain technical jargon
  const serverMessage: string | undefined = error?.data?.error || error?.data?.message;
  if (serverMessage && isDriverFriendly(serverMessage)) {
    return serverMessage;
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  return ERROR_MESSAGES.UNKNOWN;
};

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Checks whether a server-provided message is safe to show to drivers.
 * Filters out technical jargon that would confuse drivers.
 *
 * Requirements: 13.1, 13.7
 */
const TECHNICAL_PATTERNS = [
  /\bHTTP\b/i,
  /\b\d{3}\b/,          // HTTP status codes like 500, 404
  /\bstack trace\b/i,
  /\bException\b/i,
  /\bError:\s/,
  /\bnull\b/,
  /\bundefined\b/,
  /\bsync\b/i,
  /\bqueue\b/i,
  /\bAPI\b/i,
  /\bendpoint\b/i,
  /\btimeout\b/i,
  /\bnetwork\b/i,
  /\bfetch\b/i,
  /\baxios\b/i,
  /\bpromise\b/i,
];

function isDriverFriendly(message: string): boolean {
  return !TECHNICAL_PATTERNS.some(pattern => pattern.test(message));
}
