"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaImageService = void 0;
const CloudinaryProvider_1 = require("../providers/CloudinaryProvider");
function buildTransformUrl(publicId, transform) {
    return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${transform}/${publicId}`;
}
class MediaImageService {
    generateImageVariantsFromPublicId(publicId) {
        return {
            micro: buildTransformUrl(publicId, 'c_fill,w_16,h_16,q_auto,f_auto'),
            thumb: buildTransformUrl(publicId, 'c_fill,w_150,h_150,q_auto,f_auto'),
            small: buildTransformUrl(publicId, 'c_fill,w_300,h_300,q_auto,f_auto'),
            medium: buildTransformUrl(publicId, 'c_fill,w_600,h_600,q_auto,f_auto'),
            large: buildTransformUrl(publicId, 'c_fill,w_1200,h_1200,q_auto,f_auto'),
            original: buildTransformUrl(publicId, 'q_auto,f_auto'),
        };
    }
    generateModernFormatsFromPublicId(publicId) {
        return {
            avif: buildTransformUrl(publicId, 'f_avif,q_auto'),
            webp: buildTransformUrl(publicId, 'f_webp,q_auto'),
            jpg: buildTransformUrl(publicId, 'f_jpg,q_auto'),
        };
    }
    async uploadImageWithVariants(filePathOrBuffer, options) {
        // For Buffer, use provider upload; for path string, provider can handle as remote
        let result;
        if (typeof filePathOrBuffer === 'string') {
            result = await CloudinaryProvider_1.CloudinaryProvider.uploadRemote(filePathOrBuffer, { folder: options?.folder || 'products' });
        }
        else {
            result = await CloudinaryProvider_1.CloudinaryProvider.uploadBuffer(filePathOrBuffer, { folder: options?.folder || 'products' });
        }
        const publicId = result.public_id;
        const variants = this.generateImageVariantsFromPublicId(publicId);
        const formats = this.generateModernFormatsFromPublicId(publicId);
        const metadata = {
            width: result.width,
            height: result.height,
            aspectRatio: result.width && result.height ? result.width / result.height : undefined,
        };
        return { publicId, variants, formats, metadata };
    }
    async uploadBuffersWithVariants(buffers, options) {
        const out = [];
        for (const buf of buffers) {
            const img = await this.uploadImageWithVariants(buf, options);
            out.push(img);
        }
        return out;
    }
    // Preserve legacy uploads response: { full, thumb }
    async uploadBufferBasic(buffer, options) {
        const res = await CloudinaryProvider_1.CloudinaryProvider.uploadBuffer(buffer, { folder: options?.folder || 'products' });
        // Legacy behaviour returned the same secure_url for both fields
        return { full: res.secure_url || '', thumb: res.secure_url || '' };
    }
    async uploadBasic(input, options) {
        let buffer;
        if (typeof input === 'string') {
            const base64Data = input.includes('base64,') ? input.split('base64,')[1] : input;
            buffer = Buffer.from(base64Data, 'base64');
        }
        else {
            buffer = input;
        }
        return this.uploadBufferBasic(buffer, options);
    }
    async importRemoteImageAndGenerate(remoteUrl) {
        const result = await CloudinaryProvider_1.CloudinaryProvider.uploadRemote(remoteUrl, { folder: 'products' });
        const publicId = result.public_id;
        const variants = this.generateImageVariantsFromPublicId(publicId);
        const formats = this.generateModernFormatsFromPublicId(publicId);
        const metadata = {
            width: result.width,
            height: result.height,
            aspectRatio: result.width && result.height ? result.width / result.height : undefined,
        };
        return { publicId, variants, formats, metadata };
    }
    async normalizeProductImages(product) {
        if (!product?.images || product.images.length === 0) {
            return product;
        }
        const normalizedProduct = JSON.parse(JSON.stringify(product));
        const first = normalizedProduct.images[0];
        // Already structured
        if (first && first.variants && first.variants.thumb) {
            return normalizedProduct;
        }
        // Corrupted image with only _id
        if (first && typeof first === 'object' && Object.keys(first).length === 1 && first._id) {
            const basePublicId = 'sample';
            normalizedProduct.images[0] = {
                publicId: basePublicId,
                variants: this.generateImageVariantsFromPublicId(basePublicId),
                formats: this.generateModernFormatsFromPublicId(basePublicId),
                metadata: { width: 800, height: 600, aspectRatio: 800 / 600 }
            };
            return normalizedProduct;
        }
        // Legacy object { full, thumb }
        if (first && first.full) {
            try {
                if (first.full.includes('cloudinary.com/demo/')) {
                    const basePublicId = 'sample';
                    normalizedProduct.images[0] = {
                        publicId: basePublicId,
                        variants: this.generateImageVariantsFromPublicId(basePublicId),
                        formats: this.generateModernFormatsFromPublicId(basePublicId),
                        metadata: { width: 800, height: 600, aspectRatio: 800 / 600 }
                    };
                }
                else {
                    const r = /upload\/(?:v\d+\/)?(.+)\.(jpg|jpeg|png|webp|gif|avif)$/;
                    const m = String(first.full).match(r);
                    if (m && m[1]) {
                        const publicId = m[1];
                        normalizedProduct.images[0] = {
                            publicId,
                            variants: this.generateImageVariantsFromPublicId(publicId),
                            formats: this.generateModernFormatsFromPublicId(publicId),
                            metadata: { width: 800, height: 600, aspectRatio: 800 / 600 }
                        };
                    }
                    else {
                        const newImage = await this.importRemoteImageAndGenerate(first.full);
                        normalizedProduct.images[0] = newImage;
                    }
                }
            }
            catch (err) {
                // Keep original on failure
            }
        }
        // Plain string URL
        if (typeof first === 'string') {
            try {
                const newImage = await this.importRemoteImageAndGenerate(first);
                normalizedProduct.images[0] = newImage;
            }
            catch (err) {
                // Keep original on failure
            }
        }
        return normalizedProduct;
    }
}
exports.MediaImageService = MediaImageService;
