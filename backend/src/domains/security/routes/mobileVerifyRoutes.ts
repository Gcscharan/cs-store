import express from "express";
import { verifyMobileOTP } from "../controllers/mobileVerifyController";

const router = express.Router();

router.post("/verify-mobile", verifyMobileOTP);

export default router;
