"use strict";
// SMS utility functions for OTP generation and console logging
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatPhoneNumber = exports.validatePhoneNumber = exports.sendSMS = exports.generateOTP = void 0;
// Generate 6-digit OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.generateOTP = generateOTP;
// Main SMS sending function - simplified to console only
const sendSMS = async (phone, message) => {
    // Extract OTP from message for logging
    const otpMatch = message.match(/(\d{6})/);
    const otp = otpMatch ? otpMatch[1] : "N/A";
    console.log(`\n🔢 OTP Generated for ${phone}: ${otp}\n`);
    console.log(`📱 Message: ${message}\n`);
    return true;
};
exports.sendSMS = sendSMS;
/**
 * Validate phone number format
 * Supports:
 * - E.164 format: +919876543210, +11234567890
 * - Indian 10-digit: 9876543210
 * - International with country code: 919876543210, 11234567890
 */
const validatePhoneNumber = (phone) => {
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
exports.validatePhoneNumber = validatePhoneNumber;
/**
 * Format phone number to E.164 format for consistency
 * E.164 format: +[country code][number] (max 15 digits after +)
 */
const formatPhoneNumber = (phone) => {
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
exports.formatPhoneNumber = formatPhoneNumber;
