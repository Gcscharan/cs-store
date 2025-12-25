"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const uploadController_1 = require("../controllers/uploadController");
const auth_1 = require("../../../middleware/auth");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// FIX: Multer must process multipart/form-data before controller
router.post("/cloudinary", auth_1.authenticateToken, upload.single("image"), uploadController_1.uploadToCloudinary);
exports.default = router;
