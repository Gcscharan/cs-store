import express from "express";
import {
  reverseGeocodeController,
  getCurrentLocationController,
} from "../controllers/locationController";

const router = express.Router();

// Location routes
router.get("/reverse-geocode", reverseGeocodeController);
router.get("/current", getCurrentLocationController);

export default router;
