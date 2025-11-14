import express from "express";
import {
  calculateDeliveryFeeController,
  getDeliveryFeeTiersController,
} from "../controllers/deliveryController";

const router = express.Router();

// Calculate delivery fee based on address
router.post("/calculate-fee", calculateDeliveryFeeController);

// Get delivery fee tiers
router.get("/fee-tiers", getDeliveryFeeTiersController);

export default router;
