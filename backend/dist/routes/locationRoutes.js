"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const locationController_1 = require("../controllers/locationController");
const router = express_1.default.Router();
// Location routes
router.get("/reverse-geocode", locationController_1.reverseGeocodeController);
router.get("/current", locationController_1.getCurrentLocationController);
exports.default = router;
