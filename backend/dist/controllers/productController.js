"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSimilarProducts = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProductById = exports.getProducts = void 0;
const Product_1 = require("../models/Product");
const cloudinary_1 = __importDefault(require("../config/cloudinary"));
const getProducts = async (req, res) => {
    try {
        const { page = 1, limit = 20, category, minPrice, maxPrice, search, sortBy = "createdAt", sortOrder = "desc", } = req.query;
        const query = {};
        if (category)
            query.category = category;
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice)
                query.price.$gte = Number(minPrice);
            if (maxPrice)
                query.price.$lte = Number(maxPrice);
        }
        if (search) {
            query.$text = { $search: search };
        }
        const skip = (Number(page) - 1) * Number(limit);
        const sort = {};
        sort[sortBy] = sortOrder === "desc" ? -1 : 1;
        const products = await Product_1.Product.find(query)
            .sort(sort)
            .skip(skip)
            .limit(Number(limit));
        const total = await Product_1.Product.countDocuments(query);
        res.json({
            products,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch products" });
    }
};
exports.getProducts = getProducts;
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Backend - Fetching product with ID:", id);
        if (id.startsWith("fallback-")) {
            console.log("Backend - Fallback product detected, returning 404");
            return res.status(404).json({ error: "Product not found" });
        }
        const product = await Product_1.Product.findById(id);
        console.log("Backend - Product found:", product ? "Yes" : "No");
        if (!product) {
            console.log("Backend - Product not found in database");
            return res.status(404).json({ error: "Product not found" });
        }
        console.log("Backend - Returning product:", product.name);
        res.json(product);
    }
    catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ error: "Failed to fetch product" });
    }
};
exports.getProductById = getProductById;
const createProduct = async (req, res) => {
    try {
        const productData = req.body;
        if (productData.images && Array.isArray(productData.images)) {
            const uploadedImages = [];
            for (const image of productData.images) {
                if (typeof image === "string" && image.startsWith("data:image/")) {
                    const result = await cloudinary_1.default.uploader.upload(image, {
                        folder: "cps-store/products",
                        resource_type: "image",
                        transformation: [
                            { width: 800, height: 600, crop: "limit" },
                            { quality: "auto" },
                            { format: "auto" },
                        ],
                    });
                    uploadedImages.push(result.secure_url);
                }
                else {
                    uploadedImages.push(image);
                }
            }
            productData.images = uploadedImages;
        }
        const product = new Product_1.Product(productData);
        await product.save();
        res.status(201).json({
            message: "Product created successfully",
            product,
        });
    }
    catch (error) {
        console.error("Create product error:", error);
        res.status(500).json({ error: "Failed to create product" });
        return;
    }
};
exports.createProduct = createProduct;
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        const product = await Product_1.Product.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
        });
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json({
            message: "Product updated successfully",
            product,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update product" });
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const product = await Product_1.Product.findByIdAndDelete(id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        res.json({
            message: "Product deleted successfully",
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to delete product" });
    }
};
exports.deleteProduct = deleteProduct;
const getSimilarProducts = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 4 } = req.query;
        if (id.startsWith("fallback-")) {
            return res.json({
                products: [],
                total: 0,
                message: "Product not found - fallback product",
            });
        }
        const currentProduct = await Product_1.Product.findById(id);
        if (!currentProduct) {
            return res.status(404).json({ error: "Product not found" });
        }
        const similarProducts = await Product_1.Product.find({
            _id: { $ne: id },
            category: currentProduct.category,
        })
            .limit(Number(limit))
            .select("_id name price images category weight stock tags")
            .lean();
        let fallbackProducts = [];
        if (similarProducts.length === 0) {
            fallbackProducts = await Product_1.Product.find({
                _id: { $ne: id },
            })
                .limit(Number(limit))
                .select("_id name price images category weight stock tags")
                .lean();
        }
        const products = similarProducts.length > 0 ? similarProducts : fallbackProducts;
        const safeProducts = products.map((product) => ({
            _id: product._id,
            id: product._id,
            name: product.name || "Unknown Product",
            price: product.price || 0,
            image: product.images && product.images.length > 0
                ? product.images[0]
                : "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop&crop=center",
            category: product.category || "other",
            weight: product.weight || 0,
            stock: product.stock || 0,
            rating: 4.0,
            tags: product.tags || [],
        }));
        res.json({
            products: safeProducts,
            total: safeProducts.length,
        });
    }
    catch (error) {
        console.error("Error fetching similar products:", error);
        res.json({
            products: [],
            total: 0,
            error: "Failed to load similar products",
        });
    }
};
exports.getSimilarProducts = getSimilarProducts;
//# sourceMappingURL=productController.js.map