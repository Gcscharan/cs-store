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

const router = express.Router();

// Get all delivery personnel
router.get("/", getDeliveryPersonnel);

// Add new delivery personnel
router.post("/", addDeliveryPersonnel);

// Update delivery personnel
router.put("/:id", updateDeliveryPersonnel);

// Delete delivery personnel
router.delete("/:id", deleteDeliveryPersonnel);

// Update delivery boy location (for real-time tracking)
router.put("/:id/location", updateDeliveryBoyLocation);

// Get delivery boy's active route
router.get("/:id/route", getDeliveryBoyRoute);

// Clear delivery boy's active route
router.delete("/:id/route", clearDeliveryBoyRoute);

export default router;
