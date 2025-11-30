import express from "express";
import { searchProducts, getSearchSuggestions } from "../controllers/searchController";

const router = express.Router();

// Main search endpoint
router.get("/", searchProducts);

// Suggestions endpoint (backward compatibility)
router.get("/suggestions", getSearchSuggestions);

export default router;
