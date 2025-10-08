"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pincodeController_1 = require("../controllers/pincodeController");
const router = express_1.default.Router();
router.get("/check/:pincode", pincodeController_1.checkPincode);
exports.default = router;
//# sourceMappingURL=pincode.js.map