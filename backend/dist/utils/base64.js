"use strict";
/**
 * Backend Base64 Image Utilities
 *
 * These utilities are used for image processing and migration scripts.
 * Note: For production use, you might want to use a proper image processing library
 * like Sharp for better performance and quality.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bufferToBase64 = bufferToBase64;
exports.createThumbnail = createThumbnail;
exports.base64ToFile = base64ToFile;
exports.fileToThumbnailBase64 = fileToThumbnailBase64;
exports.migrateThumbnailFromBuffer = migrateThumbnailFromBuffer;
exports.urlToBase64 = urlToBase64;
exports.downloadImage = downloadImage;
exports.getImageMetadata = getImageMetadata;
const fs_1 = require("fs");
const util_1 = require("util");
const stream_1 = require("stream");
const node_fetch_1 = __importDefault(require("node-fetch"));
const pipelineAsync = (0, util_1.promisify)(stream_1.pipeline);
/**
 * Convert a file buffer to Base64 data URL
 */
function bufferToBase64(buffer, mimeType = 'image/jpeg') {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}
/**
 * Create a simple thumbnail by resizing the image
 * This is a basic implementation - for production, use Sharp or similar
 */
async function createThumbnail(buffer, maxSize = 220) {
    // This is a placeholder implementation
    // In a real production environment, you would use Sharp or another image processing library
    // For now, just return the original buffer (no actual resizing)
    // This maintains compatibility while allowing the migration script to work
    console.warn("⚠️  Using placeholder thumbnail generation. Consider implementing proper image processing with Sharp.");
    return buffer;
}
/**
 * Convert Base64 to File-like object (for migration script compatibility)
 */
function base64ToFile(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
    const bstr = Buffer.from(arr[1], 'base64');
    return bstr;
}
/**
 * Generate thumbnail from Base64 image
 */
async function fileToThumbnailBase64(buffer) {
    try {
        const thumbnailBuffer = await createThumbnail(buffer, 220);
        return bufferToBase64(thumbnailBuffer, 'image/jpeg');
    }
    catch (error) {
        console.error("Failed to generate thumbnail:", error);
        throw error;
    }
}
/**
 * Convert File-like object buffer to Base64 (for migration script compatibility)
 */
async function migrateThumbnailFromBuffer(buffer) {
    return fileToThumbnailBase64(buffer);
}
/**
 * Fetch image from URL and convert to Base64
 */
async function urlToBase64(imageUrl) {
    try {
        const response = await (0, node_fetch_1.default)(imageUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
        }
        const buffer = await response.buffer();
        const mimeType = response.headers.get('content-type') || 'image/jpeg';
        return bufferToBase64(buffer, mimeType);
    }
    catch (error) {
        console.error(`Failed to convert URL to Base64: ${imageUrl}`, error);
        throw error;
    }
}
/**
 * Download image from URL to file
 */
async function downloadImage(url, filepath) {
    try {
        const response = await (0, node_fetch_1.default)(url);
        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.statusText}`);
        }
        if (!response.body)
            throw new Error("No response body");
        await pipelineAsync(response.body, (0, fs_1.createWriteStream)(filepath));
    }
    catch (error) {
        console.error(`Failed to download image: ${url}`, error);
        throw error;
    }
}
/**
 * Get image dimensions and metadata
 */
async function getImageMetadata(buffer) {
    // This is a placeholder implementation
    // In production, you would use a proper image library to extract metadata
    return {
        width: 800, // Default assumption
        height: 600, // Default assumption
        size: buffer.length,
        format: 'jpeg'
    };
}
