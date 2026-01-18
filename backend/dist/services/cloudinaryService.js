"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadImageBuffer = void 0;
const cloudinary_1 = require("cloudinary");
const uuid_1 = require("uuid");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const uploadImageBuffer = async (buffer) => {
    const filename = (0, uuid_1.v4)();
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            folder: "products",
            public_id: filename,
            format: "jpg",
        }, (error, result) => {
            if (error)
                return reject(error);
            resolve({
                full: result?.secure_url || "",
                thumb: result?.secure_url || "", // later we can add transform
            });
        });
        uploadStream.end(buffer);
    });
};
exports.uploadImageBuffer = uploadImageBuffer;
