"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cloudinaryController_1 = require("../controllers/cloudinaryController");
const router = express_1.default.Router();
router.post("/upload", cloudinaryController_1.uploadImage);
router.delete("/delete/:publicId", cloudinaryController_1.deleteImage);
router.get("/signature", cloudinaryController_1.getUploadSignature);
exports.default = router;
//# sourceMappingURL=cloudinary.js.map