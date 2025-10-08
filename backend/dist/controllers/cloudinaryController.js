"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = exports.getImageUrl = exports.deleteImage = exports.uploadMultipleImages = exports.uploadImage = void 0;
const cloudinary_1 = require("cloudinary");
const multer_1 = __importDefault(require("multer"));
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        }
        else {
            cb(new Error("Only image files are allowed"));
        }
    },
});
exports.upload = upload;
const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file provided" });
        }
        const { folder = "cps-store", transformation } = req.body;
        const base64String = req.file.buffer.toString("base64");
        const dataUri = `data:${req.file.mimetype};base64,${base64String}`;
        const result = await cloudinary_1.v2.uploader.upload(dataUri, {
            folder,
            transformation,
            quality: "auto",
            format: "auto",
        });
        res.json({
            success: true,
            data: {
                public_id: result.public_id,
                secure_url: result.secure_url,
                width: result.width,
                height: result.height,
                format: result.format,
                bytes: result.bytes,
            },
        });
    }
    catch (error) {
        console.error("Cloudinary upload error:", error);
        res.status(500).json({ error: "Failed to upload image" });
    }
};
exports.uploadImage = uploadImage;
const uploadMultipleImages = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No files provided" });
        }
        const { folder = "cps-store", transformation } = req.body;
        const files = req.files;
        const uploadPromises = files.map(async (file) => {
            const base64String = file.buffer.toString("base64");
            const dataUri = `data:${file.mimetype};base64,${base64String}`;
            return cloudinary_1.v2.uploader.upload(dataUri, {
                folder,
                transformation,
                quality: "auto",
                format: "auto",
            });
        });
        const results = await Promise.all(uploadPromises);
        res.json({
            success: true,
            data: results.map((result) => ({
                public_id: result.public_id,
                secure_url: result.secure_url,
                width: result.width,
                height: result.height,
                format: result.format,
                bytes: result.bytes,
            })),
        });
    }
    catch (error) {
        console.error("Cloudinary upload error:", error);
        res.status(500).json({ error: "Failed to upload images" });
    }
};
exports.uploadMultipleImages = uploadMultipleImages;
const deleteImage = async (req, res) => {
    try {
        const { publicId } = req.body;
        if (!publicId) {
            return res.status(400).json({ error: "Public ID is required" });
        }
        const result = await cloudinary_1.v2.uploader.destroy(publicId);
        res.json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        console.error("Cloudinary delete error:", error);
        res.status(500).json({ error: "Failed to delete image" });
    }
};
exports.deleteImage = deleteImage;
const getImageUrl = async (req, res) => {
    try {
        const { publicId, width, height, crop, quality, format } = req.query;
        if (!publicId) {
            return res.status(400).json({ error: "Public ID is required" });
        }
        const options = {};
        if (width)
            options.width = parseInt(width);
        if (height)
            options.height = parseInt(height);
        if (crop)
            options.crop = crop;
        if (quality)
            options.quality = quality;
        if (format)
            options.format = format;
        const url = cloudinary_1.v2.url(publicId, options);
        res.json({
            success: true,
            data: { url },
        });
    }
    catch (error) {
        console.error("Cloudinary URL generation error:", error);
        res.status(500).json({ error: "Failed to generate image URL" });
    }
};
exports.getImageUrl = getImageUrl;
//# sourceMappingURL=cloudinaryController.js.map