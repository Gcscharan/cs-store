"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isTestCard = exports.formatCardNumber = exports.validateCard = exports.validateCardHolderName = exports.validateCVV = exports.validateExpiryDate = exports.validateCardLength = exports.detectCardType = exports.validateLuhn = void 0;
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
const detectCardType = (cardNumber) => {
    const cleaned = cardNumber.replace(/\D/g, "");
    if (/^4/.test(cleaned)) {
        return "visa";
    }
    if (/^5[1-5]/.test(cleaned) || /^2[2-7]/.test(cleaned)) {
        return "mastercard";
    }
    if (/^3[47]/.test(cleaned)) {
        return "amex";
    }
    if (/^6/.test(cleaned)) {
        return "discover";
    }
    return "unknown";
};
exports.detectCardType = detectCardType;
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
const validateCardHolderName = (name) => {
    return name.trim().length >= 2 && /^[a-zA-Z\s]+$/.test(name);
};
exports.validateCardHolderName = validateCardHolderName;
const validateCard = (cardNumber, expiryDate, cvv, cardHolderName) => {
    const errors = [];
    const cleanedCardNumber = cardNumber.replace(/\D/g, "");
    const cardType = (0, exports.detectCardType)(cleanedCardNumber);
    if (!(0, exports.validateCardLength)(cleanedCardNumber, cardType)) {
        errors.push(`Invalid ${cardType} card number length`);
    }
    if (!(0, exports.isTestCard)(cleanedCardNumber) && !(0, exports.validateLuhn)(cleanedCardNumber)) {
        errors.push("Invalid card number (checksum failed)");
    }
    if (!(0, exports.validateExpiryDate)(expiryDate)) {
        errors.push("Invalid or expired expiry date");
    }
    if (!(0, exports.validateCVV)(cvv, cardType)) {
        errors.push(`Invalid CVV for ${cardType} card`);
    }
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
const formatCardNumber = (cardNumber) => {
    const cleaned = cardNumber.replace(/\D/g, "");
    const last4 = cleaned.slice(-4);
    return `**** **** **** ${last4}`;
};
exports.formatCardNumber = formatCardNumber;
const isTestCard = (cardNumber) => {
    const cleaned = cardNumber.replace(/\D/g, "");
    const testCards = [
        "4687796308081910",
        "4687796308011910",
        "4000000000000002",
        "4000000000000069",
        "4000000000000119",
        "5555555555554444",
        "2223003122003222",
        "378282246310005",
        "6011111111111117",
        "6011000990139424",
    ];
    return testCards.includes(cleaned);
};
exports.isTestCard = isTestCard;
//# sourceMappingURL=cardValidation.js.map