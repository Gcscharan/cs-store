import express from "express";
import {
  validatePincodeController,
  validateBulkPincodesController,
  getValidPincodeRangesController,
  checkPincodeController,
} from "../controllers/pincodeController";

const router = express.Router();

// Pincode routes
router.post("/validate", validatePincodeController);
router.post("/validate-bulk", validateBulkPincodesController);
router.get("/ranges", getValidPincodeRangesController);
router.get("/check/:pincode", checkPincodeController);

export default router;
