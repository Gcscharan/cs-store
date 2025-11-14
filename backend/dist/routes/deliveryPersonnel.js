"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const deliveryPersonnelController_1 = require("../controllers/deliveryPersonnelController");
const router = express_1.default.Router();
router.get("/", deliveryPersonnelController_1.getDeliveryPersonnel);
router.post("/", deliveryPersonnelController_1.addDeliveryPersonnel);
router.put("/:id", deliveryPersonnelController_1.updateDeliveryPersonnel);
router.delete("/:id", deliveryPersonnelController_1.deleteDeliveryPersonnel);
exports.default = router;
//# sourceMappingURL=deliveryPersonnel.js.map