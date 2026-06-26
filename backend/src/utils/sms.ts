import { logger } from './logger';
// SMS utility functions for OTP generation and console logging

// Generate 6-digit OTP
export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Whether to use mock (console-only) OTP delivery.
// Real SMS is sent only when MOCK_OTP is explicitly NOT "true".
const isMockMode = (): boolean => process.env.MOCK_OTP === "true";

/**
 * Extract a 10-digit Indian mobile number from any supported phone format.
 * Fast2SMS expects bare 10-digit numbers (no +91 / country code).
 * Returns null if a valid 10-digit Indian number cannot be derived.
 */
const toIndian10Digit = (phone: string): string | null => {
  const digits = String(phone || "").replace(/\D/g, "");
  // Strip leading country code 91 if present (e.g. 919876543210 -> 9876543210)
  const local = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
};

/**
 * Send an OTP SMS via Fast2SMS (primary provider for India).
 *
 * Supports two delivery modes, selected via FAST2SMS_ROUTE:
 *
 *   1. "otp" (default) — Provider's pre-approved OTP route. No DLT registration
 *      needed. Delivers "<otp> is your OTP" from a shared sender ID. Best for
 *      testing / MVP. Requires Fast2SMS account "OTP Message" verification.
 *
 *   2. "dlt" — Your own DLT-registered template + sender ID. Use this for
 *      production so OTPs come from your brand header (e.g. VYAPAR) with your
 *      approved wording. Requires:
 *        - FAST2SMS_SENDER_ID         → approved 6-char header (e.g. VYAPAR)
 *        - FAST2SMS_DLT_TEMPLATE_ID   → approved DLT template/message ID
 *        - FAST2SMS_DLT_ENTITY_ID     → (optional) your DLT principal entity ID
 *      The OTP value is injected into the template's {#var#} placeholder.
 *
 * @returns true on accepted send, false on failure.
 */
const sendViaFast2SMS = async (phone: string, otp: string): Promise<boolean> => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) {
    logger.error("[SMS] FAST2SMS_API_KEY not configured — cannot send real SMS");
    return false;
  }

  const number = toIndian10Digit(phone);
  if (!number) {
    logger.error(`[SMS] Invalid Indian mobile number for Fast2SMS: ${phone}`);
    return false;
  }

  const route = (process.env.FAST2SMS_ROUTE || "otp").toLowerCase();

  let params: URLSearchParams;

  if (route === "dlt") {
    // ── Production: your own DLT-registered template + sender ID ──
    const senderId = process.env.FAST2SMS_SENDER_ID;
    const templateId = process.env.FAST2SMS_DLT_TEMPLATE_ID;
    const entityId = process.env.FAST2SMS_DLT_ENTITY_ID;

    if (!senderId || !templateId) {
      logger.error(
        "[SMS] DLT route selected but FAST2SMS_SENDER_ID / FAST2SMS_DLT_TEMPLATE_ID not configured"
      );
      return false;
    }

    params = new URLSearchParams({
      authorization: apiKey,
      route: "dlt",
      sender_id: senderId,
      message: templateId,
      // variables_values fills the {#var#} placeholders in order (just the OTP here)
      variables_values: otp,
      numbers: number,
      flash: "0",
    });
    if (entityId) params.set("entity_id", entityId);
  } else {
    // ── Testing / MVP: provider's pre-approved OTP route ──
    params = new URLSearchParams({
      authorization: apiKey,
      route: "otp",
      variables_values: otp,
      numbers: number,
      flash: "0",
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`https://www.fast2sms.com/dev/bulkV2?${params.toString()}`, {
      method: "GET",
      headers: { "cache-control": "no-cache" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = (await res.json().catch(() => ({}))) as any;
    if (res.ok && data?.return === true) {
      logger.info(`[SMS] ✅ OTP SMS sent via Fast2SMS (route=${route}) to ${number}`, {
        requestId: Array.isArray(data?.request_id) ? data.request_id[0] : data?.request_id,
      });
      return true;
    }

    logger.error(`[SMS] ❌ Fast2SMS rejected the request (route=${route})`, {
      status: res.status,
      response: data,
    });
    return false;
  } catch (err) {
    logger.error(`[SMS] ❌ Fast2SMS send failed`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
};

// Main SMS sending function.
// - MOCK_OTP=true  → log to console only (dev/testing).
// - otherwise      → send a real SMS via Fast2SMS.
export const sendSMS = async (
  phone: string,
  message: string
): Promise<boolean> => {
  // Extract OTP from message for logging / OTP-route delivery
  const otpMatch = message.match(/(\d{4,6})/);
  const otp = otpMatch ? otpMatch[1] : "N/A";

  if (isMockMode()) {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`🔢 OTP GENERATED (MOCK MODE)`);
    logger.info(`📱 Phone: ${phone}`);
    logger.info(`🔑 OTP: ${otp}`);
    logger.info(`📧 Full Message: ${message}`);
    logger.info(`${'='.repeat(60)}\n`);
    return true;
  }

  // Real delivery
  if (otp === "N/A") {
    logger.error("[SMS] No OTP code found in message — refusing to send empty OTP SMS");
    return false;
  }

  return sendViaFast2SMS(phone, otp);
};

/**
 * Validate phone number format
 * Supports:
 * - E.164 format: +919876543210, +11234567890
 * - Indian 10-digit: 9876543210
 * - International with country code: 919876543210, 11234567890
 */
export const validatePhoneNumber = (phone: string): boolean => {
  // Remove all non-digit characters except leading +
  const cleaned = phone.trim();
  
  // Check if it's already in E.164 format (starts with +)
  if (cleaned.startsWith("+")) {
    // E.164 format: + followed by 1-15 digits
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(cleaned);
  }
  
  // Extract digits only
  const digits = cleaned.replace(/\D/g, "");
  
  // Accept 10-15 digits (supports international numbers without +)
  // 10 digits = Indian numbers, 11-15 = international numbers
  if (digits.length >= 10 && digits.length <= 15) {
    // For 10-digit numbers, validate Indian format (starts with 6-9)
    if (digits.length === 10) {
      return /^[6-9]\d{9}$/.test(digits);
    }
    // For longer numbers, just check they're all digits
    return /^\d{11,15}$/.test(digits);
  }
  
  return false;
};

/**
 * Format phone number to E.164 format for consistency
 * E.164 format: +[country code][number] (max 15 digits after +)
 */
export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.trim();
  
  // If already in E.164 format, return as-is
  if (cleaned.startsWith("+")) {
    // Validate and return if valid E.164
    if (/^\+[1-9]\d{1,14}$/.test(cleaned)) {
      return cleaned;
    }
    // If invalid, try to fix it
    const digits = cleaned.replace(/\D/g, "");
    if (digits.length >= 10 && digits.length <= 15) {
      return `+${digits}`;
    }
    return cleaned; // Return as-is if can't fix
  }
  
  // Extract digits only
  const digits = cleaned.replace(/\D/g, "");
  
  // For 10-digit Indian numbers, add +91
  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) {
    return `+91${digits}`;
  }
  
  // For other numbers, just add +
  if (digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  
  // Return original if can't format
  return cleaned;
};
