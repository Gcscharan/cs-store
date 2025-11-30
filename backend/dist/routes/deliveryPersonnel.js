"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const deliveryPersonnelController_1 = require("../controllers/deliveryPersonnelController");
const router = express_1.default.Router();
// Get all delivery personnel
router.get("/", deliveryPersonnelController_1.getDeliveryPersonnel);
// Add new delivery personnel
router.post("/", deliveryPersonnelController_1.addDeliveryPersonnel);
// Update delivery personnel
router.put("/:id", deliveryPersonnelController_1.updateDeliveryPersonnel);
// Delete delivery personnel
router.delete("/:id", deliveryPersonnelController_1.deleteDeliveryPersonnel);
// Update delivery boy location (for real-time tracking)
router.put("/:id/location", deliveryPersonnelController_1.updateDeliveryBoyLocation);
// Get delivery boy's active route
router.get("/:id/route", deliveryPersonnelController_1.getDeliveryBoyRoute);
// Clear delivery boy's active route
router.delete("/:id/route", deliveryPersonnelController_1.clearDeliveryBoyRoute);
exports.default = router;
