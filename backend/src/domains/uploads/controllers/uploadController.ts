import { logger } from '../../../utils/logger';
import { Request, Response } from "express";
import { MediaImageService } from "../../media/services/MediaImageService";
import { validateAndProcessProductImage, PRODUCT_IMAGE_STANDARDS } from "../../../utils/productImageValidation";

export const uploadToCloudinary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // Support both multipart (req.file) and base64 JSON body (req.body.image)
    let buffer: Buffer;
    let mimeType: string;

    if ((req as any).file) {
      // Multipart upload via multer
      const file = (req as any).file as Express.Multer.File;
      buffer = file.buffer;
      mimeType = file.mimetype;
    } else if (req.body?.image) {
      // Legacy base64 JSON upload
      const base64Data = (req.body.image as string).replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
      // Detect MIME from data URL prefix
      const mimeMatch = (req.body.image as string).match(/^data:(image\/[a-z]+);base64,/);
      mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    } else {
      res.status(400).json({ error: "Image data is required" });
      return;
    }

    // ── Validate against product image standards ──────────────────────────
    const validation = await validateAndProcessProductImage(buffer, mimeType);

    if (!validation.valid) {
      logger.warn("🚫 [UploadToCloudinary] Product image validation failed:", validation.errors);
      res.status(422).json({
        error: "Image does not meet product image standards.",
        standards: {
          format: "JPEG or WebP only",
          aspectRatio: "1:1 (square)",
          minResolution: `${PRODUCT_IMAGE_STANDARDS.MIN_DIMENSION}×${PRODUCT_IMAGE_STANDARDS.MIN_DIMENSION} px`,
          maxResolution: `${PRODUCT_IMAGE_STANDARDS.MAX_DIMENSION}×${PRODUCT_IMAGE_STANDARDS.MAX_DIMENSION} px`,
          maxFileSize: "500 KB",
        },
        errors: validation.errors,
      });
      return;
    }

    // ── Upload processed buffer via Media domain service ──────────────────
    const media = new MediaImageService();
    const result = await media.uploadBufferBasic(validation.processedBuffer ?? buffer);

    logger.info("✅ [UploadToCloudinary] Product image uploaded successfully");
    logger.info(
      `🗜️  [UploadToCloudinary] Compressed: ${Math.round(buffer.length / 1024)} KB → ` +
      `${Math.round((validation.finalSizeBytes ?? 0) / 1024)} KB ` +
      `(${validation.width}×${validation.height})`,
    );

    res.json({
      full: result.full,
      thumb: result.thumb,
    });
  } catch (error) {
    logger.error("Cloudinary upload error:", error);
    res.status(500).json({ 
      error: "Failed to upload image to Cloudinary",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
