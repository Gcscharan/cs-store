import { Router } from "express";
import multer from "multer";
import { uploadToCloudinary } from "../controllers/uploadController";
import { authenticateToken } from "../../../middleware/auth";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// FIX: Multer must process multipart/form-data before controller
router.post(
  "/cloudinary",
  authenticateToken,
  upload.single("image") as any,
  uploadToCloudinary
);

export default router;
