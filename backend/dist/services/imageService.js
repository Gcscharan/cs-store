"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateImageVariantsFromPublicId = generateImageVariantsFromPublicId;
exports.generateModernFormatsFromPublicId = generateModernFormatsFromPublicId;
exports.uploadImageWithVariants = uploadImageWithVariants;
exports.importRemoteImageAndGenerate = importRemoteImageAndGenerate;
const cloudinary_1 = __importDefault(require("cloudinary"));
cloudinary_1.default.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// Helper to build transformation-based URLs given public_id
function buildUrl(publicId, transform) {
    // cloudinary base pattern: https://res.cloudinary.com/<cloud>/image/upload/<transform>/<publicId>
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${transform}/${publicId}`;
}
function generateImageVariantsFromPublicId(publicId) {
    return {
        micro: buildUrl(publicId, 'c_fill,w_16,h_16,q_auto,f_auto'),
        thumb: buildUrl(publicId, 'c_fill,w_150,h_150,q_auto,f_auto'),
        small: buildUrl(publicId, 'c_fill,w_300,h_300,q_auto,f_auto'),
        medium: buildUrl(publicId, 'c_fill,w_600,h_600,q_auto,f_auto'),
        large: buildUrl(publicId, 'c_fill,w_1200,h_1200,q_auto,f_auto'),
        original: buildUrl(publicId, 'q_auto,f_auto'), // original transformed for reliability
    };
}
function generateModernFormatsFromPublicId(publicId) {
    // cloudinary supports format auto via f_auto — but explicit urls help
    return {
        avif: buildUrl(publicId, 'f_avif,q_auto'),
        webp: buildUrl(publicId, 'f_webp,q_auto'),
        jpg: buildUrl(publicId, 'f_jpg,q_auto'),
    };
}
// Upload and return structured ProductImage
async function uploadImageWithVariants(filePathOrBuffer, options) {
    const uploadOptions = {
        folder: (options && options.folder) || 'products',
        quality: 'auto',
        fetch_format: 'auto',
        transformation: [{ width: 2000, crop: 'limit' }], // limit size
    };
    const res = await cloudinary_1.default.v2.uploader.upload(typeof filePathOrBuffer === 'string'
        ? filePathOrBuffer
        : filePathOrBuffer, {
        ...uploadOptions,
        // if Buffer, use 'upload_stream' path — but many engines will pass a path. 
        // For Buffer support you'd implement streaming here (omitted for brevity but leave hooks)
    });
    const publicId = res.public_id;
    const variants = generateImageVariantsFromPublicId(publicId);
    const formats = generateModernFormatsFromPublicId(publicId);
    const metadata = {
        width: res.width,
        height: res.height,
        aspectRatio: res.width && res.height ? res.width / res.height : undefined,
    };
    return {
        publicId,
        variants,
        formats,
        metadata,
    };
}
// If you only have an existing full URL (not public_id), attempt to derive a public id:
// fallback: upload remote image to our account (fetch) and generate variants
async function importRemoteImageAndGenerate(remoteUrl) {
    const res = await cloudinary_1.default.v2.uploader.upload(remoteUrl, {
        folder: 'products',
        quality: 'auto',
        fetch_format: 'auto',
    });
    const publicId = res.public_id;
    const variants = generateImageVariantsFromPublicId(publicId);
    const formats = generateModernFormatsFromPublicId(publicId);
    const metadata = { width: res.width, height: res.height, aspectRatio: res.width && res.height ? res.width / res.height : undefined };
    return { publicId, variants, formats, metadata };
}
