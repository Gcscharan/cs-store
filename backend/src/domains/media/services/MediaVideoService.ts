import { CloudinaryProvider } from "../providers/CloudinaryProvider";

export type VideoUploadResult = {
  url: string;
  thumbnail?: string;
  duration?: number;
  publicId: string;
};

export class MediaVideoService {
  /**
   * Upload video buffer to Cloudinary
   * Returns secure URL, thumbnail, and duration
   */
  async uploadBuffer(
    buffer: Buffer,
    options?: { folder?: string }
  ): Promise<VideoUploadResult> {
    const result = await CloudinaryProvider.uploadBuffer(buffer, {
      folder: options?.folder || 'products/videos',
      resource_type: 'video',
    });

    return {
      url: result.secure_url,
      thumbnail: undefined,
      duration: undefined,
      publicId: result.public_id,
    };
  }
}
