import express from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getSimilarProducts,
  getSearchSuggestions,
} from "../controllers/productController";
import {
  authenticateToken,
  requireRole,
  AuthRequest,
} from "../../../middleware/auth";

const router = express.Router();

// Product routes
router.get("/", getProducts);
router.get("/search", getSearchSuggestions); // Search suggestions endpoint
router.get("/:id/similar", getSimilarProducts);
router.get("/:id", getProductById);
router.post("/", authenticateToken, requireRole(["admin"]), createProduct);
router.put("/:id", authenticateToken, requireRole(["admin"]), updateProduct);
router.delete("/:id", authenticateToken, requireRole(["admin"]), deleteProduct);

export default router;
