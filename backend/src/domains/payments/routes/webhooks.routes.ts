import express from "express";

import { razorpayWebhook } from "../controllers/webhooks.controller";

const router = express.Router();

router.post("/razorpay", razorpayWebhook);

export default router;
