import express from "express";
import { authenticateToken } from "../middleware/auth";
import { upiVerifyRateLimit, verifyUpi } from "../domains/upi/controllers/upiVerificationController";

const router = express.Router();

router.post("/verify", authenticateToken, upiVerifyRateLimit, verifyUpi);

export default router;
