import express from "express";
import { calculateDeliveryFeeController } from "../controllers/deliveryController";

const router = express.Router();

// Calculate delivery fee
router.post("/calculate-fee", calculateDeliveryFeeController);

export default router;
