"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pincodeController_1 = require("../controllers/pincodeController");
const router = express_1.default.Router();
router.post("/validate", pincodeController_1.validatePincodeController);
router.post("/validate-bulk", pincodeController_1.validateBulkPincodesController);
router.get("/ranges", pincodeController_1.getValidPincodeRangesController);
router.get("/check/:pincode", pincodeController_1.checkPincodeController);
exports.default = router;
//# sourceMappingURL=pincodeRoutes.js.map