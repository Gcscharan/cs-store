"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudinaryProvider = void 0;
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
exports.CloudinaryProvider = {
    url(publicId, options) {
        return cloudinary_1.v2.url(publicId, options || {});
    },
    async uploadBuffer(buffer, options) {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                folder: options?.folder || "products",
                resource_type: "image",
                format: options?.format || "jpg",
                public_id: options?.public_id,
            }, (error, result) => {
                if (error || !result)
                    return reject(error);
                resolve({
                    secure_url: result.secure_url || "",
                    public_id: result.public_id,
                    width: result.width,
                    height: result.height,
                });
            });
            uploadStream.end(buffer);
        });
    },
    async uploadRemote(url, options) {
        const res = await cloudinary_1.v2.uploader.upload(url, {
            folder: options?.folder || "products",
            quality: options?.quality || "auto",
            fetch_format: options?.fetch_format || "auto",
        });
        return {
            secure_url: res.secure_url || "",
            public_id: res.public_id,
            width: res.width,
            height: res.height,
        };
    },
};
