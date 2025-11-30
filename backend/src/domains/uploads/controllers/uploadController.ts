import { Request, Response } from "express";
import { uploadImageBuffer, CloudinaryUploadResult } from "../../../services/cloudinaryService";

export const uploadToCloudinary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { image } = req.body;

    if (!image) {
      res.status(400).json({ error: "Image data is required" });
      return;
    }

    // Convert base64 to buffer
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Upload to Cloudinary
    const result: CloudinaryUploadResult = await uploadImageBuffer(buffer);

    res.json({
      full: result.full,
      thumb: result.thumb,
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    res.status(500).json({ 
      error: "Failed to upload image to Cloudinary",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
