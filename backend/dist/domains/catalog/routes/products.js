"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const productController_1 = require("../controllers/productController");
const debugController_1 = require("../controllers/debugController");
const searchController_1 = require("../controllers/searchController");
const auth_1 = require("../../../middleware/auth");
// Import search routes
const search_1 = __importDefault(require("./search"));
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const router = express_1.default.Router();
// ------------------------------------
// SEARCH ROUTES — MUST COME FIRST
// ------------------------------------
router.use("/search", search_1.default);
router.get("/search/suggestions", searchController_1.getSearchSuggestions);
// ------------------------------------
// PRODUCT CRUD ROUTES
// ------------------------------------
router.get("/:id", productController_1.getProductById);
router.put("/:id", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), productController_1.updateProduct);
router.delete("/:id", auth_1.authenticateToken, (0, auth_1.requireRole)(["admin"]), productController_1.deleteProduct);
router.post("/", 
// authenticateToken,
// requireRole(["admin"]),
upload.array("images"), productController_1.createProduct);
router.get("/", productController_1.getProducts);
router.get("/categories", productController_1.getCategories);
router.get("/:id/similar", productController_1.getSimilarProducts);
router.get("/debug/product-images/:id", debugController_1.debugProductImages);
exports.default = router;
