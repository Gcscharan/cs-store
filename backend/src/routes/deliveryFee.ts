import express from "express";
import { calculateDeliveryFeeController } from "../controllers/deliveryController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Calculate delivery fee
router.post("/calculate-fee", authenticateToken, calculateDeliveryFeeController);

export default router;
