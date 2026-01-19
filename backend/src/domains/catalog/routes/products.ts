import express from "express";
import multer from "multer";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getSimilarProducts,
  getCategories,
} from "../controllers/productController";
import { debugProductImages } from "../controllers/debugController";
import { getSearchSuggestions } from "../controllers/searchController";
import {
  authenticateToken,
  requireRole,
  AuthRequest,
} from "../../../middleware/auth";

// Import search routes
import searchRoutes from "./search";

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

// ------------------------------------
// SEARCH ROUTES — MUST COME FIRST
// ------------------------------------
router.use("/search", searchRoutes);
router.get("/search/suggestions", getSearchSuggestions);

// ------------------------------------
// PRODUCT CRUD ROUTES
// ------------------------------------
router.get("/categories", getCategories);
router.get("/:id/similar", getSimilarProducts);
router.get("/:id", getProductById);
router.put("/:id", authenticateToken, requireRole(["admin"]), updateProduct);
router.delete("/:id", authenticateToken, requireRole(["admin"]), deleteProduct);
router.post(
  "/",
  authenticateToken,
  requireRole(["admin"]),
  upload.array("images") as any,
  createProduct
);
router.get("/", getProducts);

export default router;
