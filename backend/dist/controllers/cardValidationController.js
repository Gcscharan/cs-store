"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCardDetails = void 0;
const cardValidation_1 = require("../utils/cardValidation");
// Validate card details (PCI compliant - no storage)
const validateCardDetails = async (req, res) => {
    try {
        const { cardNumber, expiryDate, cvv, cardHolderName } = req.body;
        // Basic validation
        if (!cardNumber || !expiryDate || !cvv || !cardHolderName) {
            return res.status(400).json({
                valid: false,
                message: "All card details are required",
            });
        }
        // Use the existing card validation utility
        const validation = (0, cardValidation_1.validateCard)(cardNumber, expiryDate, cvv, cardHolderName);
        if (validation.isValid) {
            return res.status(200).json({
                valid: true,
                cardType: validation.cardType,
                message: "Card details are valid",
            });
        }
        else {
            return res.status(400).json({
                valid: false,
                message: validation.errors[0] || "Invalid card details",
                errors: validation.errors,
            });
        }
    }
    catch (error) {
        console.error("Card validation error:", error);
        return res.status(500).json({
            valid: false,
            message: "Card validation failed",
        });
    }
};
exports.validateCardDetails = validateCardDetails;
