import express from "express";
import { checkPincode } from "../controllers/pincodeController";

const router = express.Router();

// Pincode routes
router.get("/check/:pincode", checkPincode);

export default router;
