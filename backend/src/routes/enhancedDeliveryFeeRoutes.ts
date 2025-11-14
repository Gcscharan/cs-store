/**
 * Enhanced Delivery Fee Routes
 * All endpoints for delivery fee calculation
 */

import express from "express";
import { authenticateToken } from "../middleware/auth";
import {
  calculateDeliveryFeeForUser,
  calculateDeliveryFeeForSpecificAddress,
  getDeliveryFeeConfig,
  estimateDeliveryFee,
  clearDeliveryFeeCache,
} from "../controllers/enhancedDeliveryFeeController";

const router = express.Router();

/**
 * Calculate delivery fee for authenticated user's default address
 * GET /api/delivery-fee/calculate?orderAmount=1500&orderWeight=5&expressDelivery=false
 * Auth: Required
 */
router.get("/calculate", authenticateToken, calculateDeliveryFeeForUser);

/**
 * Calculate delivery fee for a specific user address
 * POST /api/delivery-fee/calculate-for-address
 * Body: { addressId, orderAmount, orderWeight, expressDelivery }
 * Auth: Required
 */
router.post("/calculate-for-address", authenticateToken, calculateDeliveryFeeForSpecificAddress);

/**
 * Get delivery fee configuration and tiers
 * GET /api/delivery-fee/config
 * Auth: Optional
 */
router.get("/config", getDeliveryFeeConfig);

/**
 * Estimate delivery fee for guest users (by pincode)
 * POST /api/delivery-fee/estimate
 * Body: { pincode, orderAmount, orderWeight }
 * Auth: Not required
 */
router.post("/estimate", estimateDeliveryFee);

/**
 * Clear delivery fee distance cache (admin only)
 * POST /api/delivery-fee/clear-cache
 * Auth: Required (Admin)
 */
router.post("/clear-cache", authenticateToken, clearDeliveryFeeCache);

export default router;
