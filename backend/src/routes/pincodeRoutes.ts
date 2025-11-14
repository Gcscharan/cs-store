import express from "express";
import {
  validatePincodeController,
  validateBulkPincodesController,
  getValidPincodeRangesController,
  checkPincodeController,
} from "../controllers/pincodeController";

const router = express.Router();

// Validate single pincode
router.post("/validate", validatePincodeController);

// Validate multiple pincodes
router.post("/validate-bulk", validateBulkPincodesController);

// Get valid pincode ranges
router.get("/ranges", getValidPincodeRangesController);

// Check pincode deliverability
router.get("/check/:pincode", checkPincodeController);

export default router;
