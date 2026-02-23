import express from "express";

import { authenticateToken } from "../../../middleware/auth";
import { createPaymentIntent, verifyPaymentIntent } from "../controllers/paymentIntents.controller";

const router = express.Router();

router.post("/", authenticateToken, createPaymentIntent);

router.post("/verify", authenticateToken, verifyPaymentIntent);

export default router;
