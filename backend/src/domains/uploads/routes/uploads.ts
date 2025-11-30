import { Router } from "express";
import multer from "multer";
import { uploadToCloudinary } from "../controllers/uploadController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// FIX: Multer must process multipart/form-data before controller
router.post("/cloudinary", upload.single("image"), uploadToCloudinary);

export default router;
