import express from "express";
import { getStats, exportOrders } from "../controllers/adminController";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = express.Router();

// Admin routes
router.get("/stats", authenticateToken, requireRole(["admin"]), getStats);
router.get(
  "/orders/export",
  authenticateToken,
  requireRole(["admin"]),
  exportOrders
);

export default router;
