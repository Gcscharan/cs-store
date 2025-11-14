import { Request, Response } from "express";
import { validateCard } from "../utils/cardValidation";

// Validate card details (PCI compliant - no storage)
export const validateCardDetails = async (req: Request, res: Response) => {
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
    const validation = validateCard(
      cardNumber,
      expiryDate,
      cvv,
      cardHolderName
    );

    if (validation.isValid) {
      return res.status(200).json({
        valid: true,
        cardType: validation.cardType,
        message: "Card details are valid",
      });
    } else {
      return res.status(400).json({
        valid: false,
        message: validation.errors[0] || "Invalid card details",
        errors: validation.errors,
      });
    }
  } catch (error) {
    console.error("Card validation error:", error);
    return res.status(500).json({
      valid: false,
      message: "Card validation failed",
    });
  }
};
