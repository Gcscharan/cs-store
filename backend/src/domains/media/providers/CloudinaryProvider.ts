import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export type UploadResult = {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
};

export const CloudinaryProvider = {
  url(publicId: string, options?: any): string {
    return cloudinary.url(publicId, options || {});
  },

  async uploadBuffer(buffer: Buffer, options?: any): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options?.folder || "products",
          resource_type: "image",
          format: options?.format || "jpg",
          public_id: options?.public_id,
        },
        (error, result) => {
          if (error || !result) return reject(error);
          resolve({
            secure_url: result.secure_url || "",
            public_id: result.public_id,
            width: result.width,
            height: result.height,
          });
        }
      );
      uploadStream.end(buffer);
    });
  },

  async uploadRemote(url: string, options?: any): Promise<UploadResult> {
    const res = await cloudinary.uploader.upload(url, {
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
