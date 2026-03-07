import express from "express";

import { authenticateToken } from "../../../middleware/auth";
import { paymentVerificationRateLimit } from "../../../middleware/security";
import { createPaymentIntent, verifyPaymentIntent } from "../controllers/paymentIntents.controller";

const router = express.Router();

router.post("/", authenticateToken, paymentVerificationRateLimit, createPaymentIntent);

router.post("/verify", authenticateToken, paymentVerificationRateLimit, verifyPaymentIntent);

export default router;
