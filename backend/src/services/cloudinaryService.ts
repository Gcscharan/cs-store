import { v2 as cloudinary } from "cloudinary";
import { v4 as uuidv4 } from "uuid";

export interface CloudinaryUploadResult {
  full: string;
  thumb: string;
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
        thumb: result?.secure_url || "", // later we can add transform
      });
    });

    uploadStream.end(buffer);
  });
};
