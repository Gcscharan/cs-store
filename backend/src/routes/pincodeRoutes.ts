import express from "express";
import {
  validatePincodeController,
  validateBulkPincodesController,
  getValidPincodeRangesController,
  checkPincodeController,
} from "../controllers/pincodeController";
import { pincodeRateLimiter } from "../middleware/rateLimiter";

const router = express.Router();

// Validate single pincode
router.post("/validate", validatePincodeController);

// Validate multiple pincodes
router.post("/validate-bulk", validateBulkPincodesController);

// Get valid pincode ranges
router.get("/ranges", getValidPincodeRangesController);

// Check pincode deliverability (rate limited)
router.get("/check/:pincode", pincodeRateLimiter, checkPincodeController);

export default router;
