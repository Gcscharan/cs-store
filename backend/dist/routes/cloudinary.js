"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cloudinaryController_1 = require("../controllers/cloudinaryController");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.post("/upload", auth_1.authenticateToken, cloudinaryController_1.upload.single("image"), cloudinaryController_1.uploadImage);
router.post("/upload-multiple", auth_1.authenticateToken, cloudinaryController_1.upload.array("images", 10), cloudinaryController_1.uploadMultipleImages);
router.delete("/delete", auth_1.authenticateToken, cloudinaryController_1.deleteImage);
router.get("/url", cloudinaryController_1.getImageUrl);
exports.default = router;
//# sourceMappingURL=cloudinary.js.map