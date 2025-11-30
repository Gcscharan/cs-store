"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mobileVerifyController_1 = require("../controllers/mobileVerifyController");
const router = express_1.default.Router();
router.post("/verify-mobile", mobileVerifyController_1.verifyMobileOTP);
exports.default = router;
