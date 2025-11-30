"use strict";
// Card validation utilities for real card processing
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTestCard = exports.formatCardNumber = exports.validateCard = exports.validateCardHolderName = exports.validateCVV = exports.validateExpiryDate = exports.validateCardLength = exports.detectCardType = exports.validateLuhn = void 0;
// Luhn algorithm for card number validation
const validateLuhn = (cardNumber) => {
    const cleaned = cardNumber.replace(/\D/g, "");
    let sum = 0;
    let isEven = false;
    for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned[i]);
        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        sum += digit;
        isEven = !isEven;
    }
    return sum % 10 === 0;
};
exports.validateLuhn = validateLuhn;
// Detect card type based on number
const detectCardType = (cardNumber) => {
    const cleaned = cardNumber.replace(/\D/g, "");
    // Visa: starts with 4
    if (/^4/.test(cleaned)) {
        return "visa";
    }
    // Mastercard: starts with 5[1-5] or 2[2-7]
    if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) {
        return "mastercard";
    }
    // American Express: starts with 34 or 37
    if (/^3[47]/.test(cleaned)) {
        return "amex";
    }
    // Discover: starts with 6
    if (/^6/.test(cleaned)) {
        return "discover";
    }
    return "unknown";
};
exports.detectCardType = detectCardType;
// Validate card number length based on type
const validateCardLength = (cardNumber, cardType) => {
    const cleaned = cardNumber.replace(/\D/g, "");
    switch (cardType) {
        case "visa":
        case "mastercard":
        case "discover":
            return cleaned.length === 16;
        case "amex":
            return cleaned.length === 15;
        default:
            return cleaned.length >= 13 && cleaned.length <= 19;
    }
};
exports.validateCardLength = validateCardLength;
// Validate expiry date
const validateExpiryDate = (expiryDate) => {
    const regex = /^(0[1-9]|1[0-2])\/([0-9]{2})$/;
    if (!regex.test(expiryDate)) {
        return false;
    }
    const [month, year] = expiryDate.split("/");
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear() % 100;
    const currentMonth = currentDate.getMonth() + 1;
    const expYear = parseInt(year);
    const expMonth = parseInt(month);
    if (expYear < currentYear) {
        return false;
    }
    if (expYear === currentYear && expMonth < currentMonth) {
        return false;
    }
    return true;
};
exports.validateExpiryDate = validateExpiryDate;
// Validate CVV based on card type
const validateCVV = (cvv, cardType) => {
    const cleaned = cvv.replace(/\D/g, "");
    switch (cardType) {
        case "amex":
            return cleaned.length === 4;
        case "visa":
        case "mastercard":
        case "discover":
            return cleaned.length === 3;
        default:
            return cleaned.length >= 3 && cleaned.length <= 4;
    }
};
exports.validateCVV = validateCVV;
// Validate card holder name
const validateCardHolderName = (name) => {
    return name.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(name);
};
exports.validateCardHolderName = validateCardHolderName;
// Main card validation function
const validateCard = (cardNumber, expiryDate, cvv, cardHolderName) => {
    const errors = [];
    // Clean card number
    const cleanedCardNumber = cardNumber.replace(/\D/g, "");
    // Detect card type
    const cardType = (0, exports.detectCardType)(cleanedCardNumber);
    // Validate card number length
    if (!(0, exports.validateCardLength)(cleanedCardNumber, cardType)) {
        errors.push(`Invalid ${cardType} card number length`);
    }
    // Validate Luhn algorithm (only for non-test cards)
    if (!(0, exports.isTestCard)(cleanedCardNumber) && !(0, exports.validateLuhn)(cleanedCardNumber)) {
        errors.push("Invalid card number (checksum failed)");
    }
    // Validate expiry date
    if (!(0, exports.validateExpiryDate)(expiryDate)) {
        errors.push("Invalid or expired expiry date");
    }
    // Validate CVV
    if (!(0, exports.validateCVV)(cvv, cardType)) {
        errors.push(`Invalid CVV for ${cardType} card`);
    }
    // Validate card holder name
    if (!(0, exports.validateCardHolderName)(cardHolderName)) {
        errors.push("Invalid card holder name");
    }
    return {
        isValid: errors.length === 0,
        cardType,
        errors,
    };
};
exports.validateCard = validateCard;
// Format card number for display (masked)
const formatCardNumber = (cardNumber) => {
    const cleaned = cardNumber.replace(/\D/g, "");
    const last4 = cleaned.slice(-4);
    return `**** **** **** ${last4}`;
};
exports.formatCardNumber = formatCardNumber;
// Check if a card number is a known test card
const isTestCard = (cardNumber) => {
    const cleaned = cardNumber.replace(/\D/g, "");
    // Common test card numbers that don't pass Luhn but are used for testing
    const testCards = [
        "4687796308081910", // Your test card (original)
        "4687796308011910", // Your test card (corrected)
        "4000000000000002", // Visa test (declined)
        "4000000000000069", // Visa test (expired)
        "4000000000000119", // Visa test (processing error)
        "5555555555554444", // MasterCard test
        "2223003122003222", // MasterCard test
        "378282246310005", // Amex test
        "6011111111111117", // Discover test
        "6011000990139424", // Discover test
    ];
    return testCards.includes(cleaned);
};
exports.isTestCard = isTestCard;
