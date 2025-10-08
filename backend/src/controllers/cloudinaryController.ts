import { Request, Response } from "express";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { folder = "cps-store", transformation } = req.body;

    // Convert buffer to base64
    const base64String = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${base64String}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      transformation,
      quality: "auto",
      format: "auto",
    });

    res.json({
      success: true,
      data: {
        public_id: result.public_id,
        secure_url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      },
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    res.status(500).json({ error: "Failed to upload image" });
  }
};

export const uploadMultipleImages = async (req: Request, res: Response) => {
  try {
    if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
      return res.status(400).json({ error: "No files provided" });
    }

    const { folder = "cps-store", transformation } = req.body;
    const files = req.files as Express.Multer.File[];

    const uploadPromises = files.map(async (file) => {
      const base64String = file.buffer.toString("base64");
      const dataUri = `data:${file.mimetype};base64,${base64String}`;

      return cloudinary.uploader.upload(dataUri, {
        folder,
        transformation,
        quality: "auto",
        format: "auto",
      });
    });

    const results = await Promise.all(uploadPromises);

    res.json({
      success: true,
      data: results.map((result) => ({
        public_id: result.public_id,
        secure_url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      })),
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    res.status(500).json({ error: "Failed to upload images" });
  }
};

export const deleteImage = async (req: Request, res: Response) => {
  try {
    const { publicId } = req.body;

    if (!publicId) {
      return res.status(400).json({ error: "Public ID is required" });
    }

    const result = await cloudinary.uploader.destroy(publicId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    res.status(500).json({ error: "Failed to delete image" });
  }
};

export const getImageUrl = async (req: Request, res: Response) => {
  try {
    const { publicId, width, height, crop, quality, format } = req.query;

    if (!publicId) {
      return res.status(400).json({ error: "Public ID is required" });
    }

    const options: any = {};
    if (width) options.width = parseInt(width as string);
    if (height) options.height = parseInt(height as string);
    if (crop) options.crop = crop;
    if (quality) options.quality = quality;
    if (format) options.format = format;

    const url = cloudinary.url(publicId as string, options);

    res.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    console.error("Cloudinary URL generation error:", error);
    res.status(500).json({ error: "Failed to generate image URL" });
  }
};

// Export multer middleware
export { upload };
