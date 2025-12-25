"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const deliveryPersonnelController_1 = require("../controllers/deliveryPersonnelController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Get all delivery personnel
router.get("/", auth_1.authenticateToken, deliveryPersonnelController_1.getDeliveryPersonnel);
// Add new delivery personnel
router.post("/", auth_1.authenticateToken, deliveryPersonnelController_1.addDeliveryPersonnel);
// Update delivery personnel
router.put("/:id", auth_1.authenticateToken, deliveryPersonnelController_1.updateDeliveryPersonnel);
// Delete delivery personnel
router.delete("/:id", auth_1.authenticateToken, deliveryPersonnelController_1.deleteDeliveryPersonnel);
// Update delivery boy location (for real-time tracking)
router.put("/:id/location", auth_1.authenticateToken, deliveryPersonnelController_1.updateDeliveryBoyLocation);
// Get delivery boy's active route
router.get("/:id/route", auth_1.authenticateToken, deliveryPersonnelController_1.getDeliveryBoyRoute);
// Clear delivery boy's active route
router.delete("/:id/route", auth_1.authenticateToken, deliveryPersonnelController_1.clearDeliveryBoyRoute);
exports.default = router;
