"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const userController_1 = require("../controllers/userController");
const router = express_1.default.Router();
router.get("/addresses", auth_1.authenticateToken, userController_1.getUserAddresses);
router.post("/addresses", auth_1.authenticateToken, userController_1.addUserAddress);
router.put("/addresses/:addressId", auth_1.authenticateToken, userController_1.updateUserAddress);
router.delete("/addresses/:addressId", auth_1.authenticateToken, userController_1.deleteUserAddress);
router.patch("/addresses/:addressId/default", auth_1.authenticateToken, userController_1.setDefaultAddress);
exports.default = router;
//# sourceMappingURL=user.js.map