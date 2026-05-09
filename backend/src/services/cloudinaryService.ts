import { v2 as cloudinary } from "cloudinary";
import { v4 as uuidv4 } from "uuid";

export interface CloudinaryUploadResult {
  full: string;
  thumb: string;
}

export interface CloudinaryVideoUploadResult {
  url: string;
  publicId: string;
  thumbnail: string;
  duration: number;
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadImageBuffer = async (buffer: Buffer): Promise<CloudinaryUploadResult> => {
  const filename = uuidv4();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({
      folder: "products",
      public_id: filename,
      format: "jpg",
    }, (error, result) => {
      if (error) return reject(error);
      resolve({
        full: result?.secure_url || "",
        thumb: result?.secure_url || "",
      });
    });

    uploadStream.end(buffer);
  });
};

export const cloudinaryService = {
  async uploadVideo(buffer: Buffer): Promise<CloudinaryVideoUploadResult> {
    const filename = uuidv4();
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream({
        folder: "products/videos",
        public_id: filename,
        resource_type: "video",
      }, (error, result) => {
        if (error || !result) return reject(error);
        resolve({
          url: result.secure_url || "",
          publicId: result.public_id,
          thumbnail: cloudinary.url(result.public_id, { resource_type: "video", format: "jpg", transformation: [{ start_offset: "0" }] }),
          duration: (result as any).duration || 0,
        });
      });
      uploadStream.end(buffer);
    });
  },

  async deleteVideo(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: "video" });
  },
};
