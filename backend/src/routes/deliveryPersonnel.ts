import express from "express";
import {
  getDeliveryPersonnel,
  addDeliveryPersonnel,
  updateDeliveryPersonnel,
  deleteDeliveryPersonnel,
  updateDeliveryBoyLocation,
  getDeliveryBoyRoute,
  clearDeliveryBoyRoute,
} from "../controllers/deliveryPersonnelController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Get all delivery personnel
router.get("/", authenticateToken, getDeliveryPersonnel);

// Add new delivery personnel
router.post("/", authenticateToken, addDeliveryPersonnel);

// Update delivery personnel
router.put("/:id", authenticateToken, updateDeliveryPersonnel);

// Delete delivery personnel
router.delete("/:id", authenticateToken, deleteDeliveryPersonnel);

// Update delivery boy location (for real-time tracking)
router.put("/:id/location", authenticateToken, updateDeliveryBoyLocation);

// Get delivery boy's active route
router.get("/:id/route", authenticateToken, getDeliveryBoyRoute);

// Clear delivery boy's active route
router.delete("/:id/route", authenticateToken, clearDeliveryBoyRoute);

export default router;
