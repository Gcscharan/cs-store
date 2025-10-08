import express from "express";
import { uploadImage, deleteImage, getUploadSignature } from "../controllers/cloudinaryController";

const router = express.Router();

// Cloudinary routes
router.post("/upload", uploadImage);
router.delete("/delete/:publicId", deleteImage);
router.get("/signature", getUploadSignature);

export default router;