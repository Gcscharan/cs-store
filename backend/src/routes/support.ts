import express from "express";
import { authenticateToken } from "../middleware/auth";
import { createSupportRequest } from "../controllers/supportRequestController";

const router = express.Router();

// Any authenticated user (customer or delivery partner) can raise a support request.
router.post("/requests", authenticateToken, createSupportRequest);

export default router;
