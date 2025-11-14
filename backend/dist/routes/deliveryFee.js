"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const deliveryController_1 = require("../controllers/deliveryController");
const router = express_1.default.Router();
router.post("/calculate-fee", deliveryController_1.calculateDeliveryFeeController);
router.get("/check-availability/:pincode", deliveryController_1.checkDeliveryAvailability);
router.get("/admin-address", deliveryController_1.getAdminAddress);
exports.default = router;
//# sourceMappingURL=deliveryFee.js.map