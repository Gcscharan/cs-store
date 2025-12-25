"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadToCloudinary = void 0;
const MediaImageService_1 = require("../../media/services/MediaImageService");
const uploadToCloudinary = async (req, res) => {
    try {
        const { image } = req.body;
        if (!image) {
            res.status(400).json({ error: "Image data is required" });
            return;
        }
        // Convert base64 to buffer
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        // Upload via Media domain service (preserve response shape)
        const media = new MediaImageService_1.MediaImageService();
        const result = await media.uploadBufferBasic(buffer);
        res.json({
            full: result.full,
            thumb: result.thumb,
        });
    }
    catch (error) {
        console.error("Cloudinary upload error:", error);
        res.status(500).json({
            error: "Failed to upload image to Cloudinary",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.uploadToCloudinary = uploadToCloudinary;
