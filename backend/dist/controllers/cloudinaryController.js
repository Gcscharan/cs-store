"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUploadSignature = exports.deleteImage = exports.uploadImage = void 0;
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const uploadImage = async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            return res.status(400).json({ error: "Image data is required" });
        }
        const result = await cloudinary_1.default.uploader.upload(image, {
            folder: "cps-store/products",
            resource_type: "image",
            transformation: [
                { width: 800, height: 600, crop: "limit" },
                { quality: "auto" },
                { format: "auto" },
            ],
        });
        res.json({
            success: true,
            imageUrl: result.secure_url,
            publicId: result.public_id,
        });
    }
    catch (error) {
        console.error("Cloudinary upload error:", error);
        res.status(500).json({ error: "Failed to upload image" });
    }
};
exports.uploadImage = uploadImage;
const deleteImage = async (req, res) => {
    try {
        const { publicId } = req.params;
        if (!publicId) {
            return res.status(400).json({ error: "Public ID is required" });
        }
        const result = await cloudinary_1.default.uploader.destroy(publicId);
        if (result.result === "ok") {
            res.json({ success: true, message: "Image deleted successfully" });
        }
        else {
            res.status(400).json({ error: "Failed to delete image" });
        }
    }
    catch (error) {
        console.error("Cloudinary delete error:", error);
        res.status(500).json({ error: "Failed to delete image" });
    }
};
exports.deleteImage = deleteImage;
const getUploadSignature = async (req, res) => {
    try {
        const timestamp = Math.round(new Date().getTime() / 1000);
        const params = {
            timestamp,
            folder: "cps-store/products",
            transformation: "w_800,h_600,c_limit,q_auto,f_auto",
        };
        const signature = cloudinary_1.default.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET || "");
        res.json({
            signature,
            timestamp,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME,
            apiKey: process.env.CLOUDINARY_API_KEY,
        });
    }
    catch (error) {
        console.error("Signature generation error:", error);
        res.status(500).json({ error: "Failed to generate upload signature" });
    }
};
exports.getUploadSignature = getUploadSignature;
//# sourceMappingURL=cloudinaryController.js.map