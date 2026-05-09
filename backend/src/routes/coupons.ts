import express, { Request, Response } from "express";
import { Coupon } from "../models/Coupon";
import { logger } from "../utils/logger";

const router = express.Router();

/**
 * @route   GET /api/coupons
 * @desc    Get all active coupons
 * @access  Public
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const coupons = await Coupon.find({ 
      isActive: true, 
      expiryDate: { $gte: new Date() } 
    }).sort({ createdAt: -1 });
    
    res.json(coupons);
  } catch (error) {
    logger.error("Error fetching coupons:", error);
    res.status(500).json({ message: "Server error while fetching coupons" });
  }
});

/**
 * @route   GET /api/coupons/smart
 * @desc    Get recommended coupons for a cart total
 * @access  Public
 */
router.get("/smart", async (req: Request, res: Response) => {
  try {
    const { cartTotal } = req.query;
    const total = parseFloat(cartTotal as string) || 0;

    const coupons = await Coupon.find({ 
      isActive: true, 
      expiryDate: { $gte: new Date() },
      minCartValue: { $lte: total }
    }).sort({ discountValue: -1 });
    
    res.json(coupons);
  } catch (error) {
    logger.error("Error fetching smart coupons:", error);
    res.status(500).json({ message: "Server error while fetching smart coupons" });
  }
});

/**
 * @route   POST /api/coupons/validate
 * @desc    Validate a coupon code
 * @access  Public
 */
router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { code, cartTotal } = req.body;

    if (!code) {
      return res.status(400).json({ valid: false, discount: 0, message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({ 
      code: code.toUpperCase(), 
      isActive: true,
      expiryDate: { $gte: new Date() }
    });

    if (!coupon) {
      return res.status(400).json({ valid: false, discount: 0, message: "Invalid or expired coupon code" });
    }

    if (cartTotal < coupon.minCartValue) {
      return res.status(400).json({ 
        valid: false, 
        discount: 0, 
        message: `This coupon requires a minimum cart value of ₹${coupon.minCartValue}` 
      });
    }

    let discount = 0;
    if (coupon.discountType === 'percentage') {
      discount = Math.round((cartTotal * coupon.discountValue) / 100);
    } else {
      discount = coupon.discountValue;
    }

    res.json({
      valid: true,
      discount,
      message: `Coupon applied! You saved ₹${discount}`
    });
  } catch (error) {
    logger.error("Error validating coupon:", error);
    res.status(500).json({ message: "Server error during validation" });
  }
});

export default router;
