import express from "express";

import { authenticateToken } from "../../../middleware/auth";
import { createPaymentIntent } from "../controllers/paymentIntents.controller";

const router = express.Router();

router.post("/", authenticateToken, createPaymentIntent);

export default router;
