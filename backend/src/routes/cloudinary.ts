import express from "express";
import {
  uploadImage,
  uploadMultipleImages,
  deleteImage,
  getImageUrl,
  upload,
} from "../controllers/cloudinaryController";
import { authenticateToken } from "../middleware/auth";

const router = express.Router();

// Cloudinary routes
router.post("/upload", authenticateToken, upload.single("image"), uploadImage);
router.post(
  "/upload-multiple",
  authenticateToken,
  upload.array("images", 10),
  uploadMultipleImages
);
router.delete("/delete", authenticateToken, deleteImage);
router.get("/url", getImageUrl);

export default router;
