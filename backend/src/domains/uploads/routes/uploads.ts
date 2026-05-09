import { Router } from "express";
import multer from "multer";
import { uploadToCloudinary } from "../controllers/uploadController";
import { authenticateToken } from "../../../middleware/auth";
import { v2 as cloudinary } from "cloudinary";
import { validateAndProcessProductImage, PRODUCT_IMAGE_STANDARDS } from "../../../utils/productImageValidation";
import { logger } from "../../../utils/logger";

const router = Router();

// Multer limit: 10 MB raw — server-side validator enforces the real 500 KB limit
// after reading dimensions. We allow a generous raw limit so Sharp can inspect
// the file before rejecting it with a meaningful error message.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// FIX: Multer must process multipart/form-data before controller
router.post(
  "/cloudinary",
  authenticateToken,
  upload.single("image") as any,
  uploadToCloudinary
);

// Mobile image upload endpoint — enforces product image standards
router.post(
  "/images",
  authenticateToken,
  upload.array("images", 10) as any,
  async (req: any, res: any) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No images provided" });
      }

      // ── Validate every file against product image standards ──────────────
      const validationResults = await Promise.all(
        files.map((file) =>
          validateAndProcessProductImage(file.buffer, file.mimetype),
        ),
      );

      const rejections: { file: string; errors: string[] }[] = [];
      validationResults.forEach((result, i) => {
        if (!result.valid) {
          rejections.push({ file: files[i].originalname, errors: result.errors });
        }
      });

      if (rejections.length > 0) {
        logger.warn("🚫 [UploadImages] Product image validation failed:", rejections);
        return res.status(422).json({
          message: "One or more images do not meet product image standards.",
          standards: {
            format: "JPEG or WebP only",
            aspectRatio: "1:1 (square)",
            minResolution: `${PRODUCT_IMAGE_STANDARDS.MIN_DIMENSION}×${PRODUCT_IMAGE_STANDARDS.MIN_DIMENSION} px`,
            maxResolution: `${PRODUCT_IMAGE_STANDARDS.MAX_DIMENSION}×${PRODUCT_IMAGE_STANDARDS.MAX_DIMENSION} px`,
            maxFileSize: "500 KB",
          },
          rejections,
        });
      }

      // ── Upload processed (possibly resized) buffers to Cloudinary ────────
      const uploaded = await Promise.all(
        validationResults.map((result, i) =>
          new Promise<{ url: string; publicId: string; width: number; height: number }>(
            (resolve, reject) => {
              const stream = cloudinary.uploader.upload_stream(
                { folder: "products", resource_type: "image" },
                (err, cloudResult) => {
                  if (err || !cloudResult) return reject(err);
                  resolve({
                    url: cloudResult.secure_url,
                    publicId: cloudResult.public_id,
                    width: result.width ?? cloudResult.width,
                    height: result.height ?? cloudResult.height,
                  });
                },
              );
              stream.end(result.processedBuffer ?? files[i].buffer);
            },
          ),
        ),
      );

      // Log compression savings
      validationResults.forEach((result, i) => {
        const originalKb = Math.round(files[i].buffer.length / 1024);
        const finalKb = Math.round((result.finalSizeBytes ?? 0) / 1024);
        logger.info(
          `🗜️  [UploadImages] "${files[i].originalname}": ${originalKb} KB → ${finalKb} KB ` +
          `(${result.width}×${result.height})`,
        );
      });

      logger.info(`✅ [UploadImages] ${uploaded.length} product image(s) uploaded successfully`);
      res.json({ images: uploaded });
    } catch (err: any) {
      logger.error("❌ [UploadImages] Error:", err);
      res.status(500).json({ message: err.message });
    }
  },
);

// Mobile video upload endpoint
router.post(
  "/video",
  authenticateToken,
  upload.single("video") as any,
  async (req: any, res: any) => {
    try {
      const file = req.file as Express.Multer.File;
      if (!file) {
        return res.status(400).json({ message: "No video provided" });
      }

      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "products/videos", resource_type: "video" },
          (err, result) => {
            if (err || !result) return reject(err);
            resolve(result);
          }
        );
        stream.end(file.buffer);
      });

      res.json({
        url: result.secure_url,
        publicId: result.public_id,
        thumbnail: cloudinary.url(result.public_id, {
          resource_type: "video",
          format: "jpg",
          transformation: [{ start_offset: "0" }],
        }),
        duration: result.duration || 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

export default router;
