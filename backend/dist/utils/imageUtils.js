"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bufferToBase64DataUrl = bufferToBase64DataUrl;
exports.createResizedBase64 = createResizedBase64;
exports.generateFullAndThumbFromBuffer = generateFullAndThumbFromBuffer;
exports.dataUrlToBuffer = dataUrlToBuffer;
// backend/src/utils/imageUtils.ts
const sharp_1 = __importDefault(require("sharp"));
async function bufferToBase64DataUrl(buffer, mime = 'image/jpeg') {
    const b64 = buffer.toString('base64');
    return `data:${mime};base64,${b64}`;
}
async function createResizedBase64(buffer, maxWidth, quality = 80) {
    const img = (0, sharp_1.default)(buffer).rotate();
    const metadata = await img.metadata();
    const resized = metadata.width && metadata.width > maxWidth ? img.resize({ width: maxWidth }) : img;
    const output = await resized.jpeg({ quality, mozjpeg: true }).toBuffer();
    return bufferToBase64DataUrl(output, 'image/jpeg');
}
async function generateFullAndThumbFromBuffer(buffer) {
    const full = await createResizedBase64(buffer, 1200, 80);
    const thumb = await createResizedBase64(buffer, 220, 70);
    return { full, thumb };
}
function dataUrlToBuffer(dataUrl) {
    const base64 = dataUrl.split(',')[1] ?? dataUrl;
    return Buffer.from(base64, 'base64');
}
