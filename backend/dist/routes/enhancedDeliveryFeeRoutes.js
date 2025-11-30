"use strict";
/**
 * Enhanced Delivery Fee Routes
 * All endpoints for delivery fee calculation
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const enhancedDeliveryFeeController_1 = require("../controllers/enhancedDeliveryFeeController");
const router = express_1.default.Router();
/**
 * Calculate delivery fee for authenticated user's default address
 * GET /api/delivery-fee/calculate?orderAmount=1500&orderWeight=5&expressDelivery=false
 * Auth: Required
 */
router.get("/calculate", auth_1.authenticateToken, enhancedDeliveryFeeController_1.calculateDeliveryFeeForUser);
/**
 * Calculate delivery fee for a specific user address
 * POST /api/delivery-fee/calculate-for-address
 * Body: { addressId, orderAmount, orderWeight, expressDelivery }
 * Auth: Required
 */
router.post("/calculate-for-address", auth_1.authenticateToken, enhancedDeliveryFeeController_1.calculateDeliveryFeeForSpecificAddress);
/**
 * Get delivery fee configuration and tiers
 * GET /api/delivery-fee/config
 * Auth: Optional
 */
router.get("/config", enhancedDeliveryFeeController_1.getDeliveryFeeConfig);
/**
 * Estimate delivery fee for guest users (by pincode)
 * POST /api/delivery-fee/estimate
 * Body: { pincode, orderAmount, orderWeight }
 * Auth: Not required
 */
router.post("/estimate", enhancedDeliveryFeeController_1.estimateDeliveryFee);
/**
 * Clear delivery fee distance cache (admin only)
 * POST /api/delivery-fee/clear-cache
 * Auth: Required (Admin)
 */
router.post("/clear-cache", auth_1.authenticateToken, enhancedDeliveryFeeController_1.clearDeliveryFeeCache);
exports.default = router;
