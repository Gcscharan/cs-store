"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugProductImages = exports.getSimilarProducts = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProductById = exports.getProducts = exports.getCategories = void 0;
exports.normalizeProductImages = normalizeProductImages;
const logger_1 = require("../../../utils/logger");
const Product_1 = require("../../../models/Product");
const MediaImageService_1 = require("../../media/services/MediaImageService");
const cache_1 = require("../../../middleware/cache");
const productReadCache_1 = require("../../../utils/productReadCache");
const autoTranslateService_1 = require("../../../services/autoTranslateService");
const mediaService = new MediaImageService_1.MediaImageService();
const SELLABLE_PRODUCT_FILTER = {
    deletedAt: null,
    isSellable: { $ne: false },
};
// Valid product categories from schema
const VALID_CATEGORIES = [
    "chocolates",
    "biscuits",
    "ladoos",
    "cakes",
    "hot_snacks",
    "groceries",
    "vegetables",
    "fruits",
    "dairy",
    "meat",
    "beverages",
    "snacks",
    "household",
    "personal_care",
    "medicines",
    "electronics",
    "clothing",
    "other",
];
// Helper to normalize legacy images to ProductImage
async function normalizeProductImages(product) {
    return await mediaService.normalizeProductImages(product);
}
const getCategories = async (req, res) => {
    try {
        const cacheKey = (0, productReadCache_1.buildCategoriesCacheKey)();
        const cached = await (0, productReadCache_1.cacheGetJson)(cacheKey);
        if (cached && cached.categories) {
            return res.json(cached);
        }
        // Get product counts by category
        const categoryCounts = await Product_1.Product.aggregate([
            { $match: SELLABLE_PRODUCT_FILTER },
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);
        const categories = VALID_CATEGORIES.map(category => {
            const categoryData = categoryCounts.find(c => c._id === category);
            return {
                name: category,
                count: categoryData ? categoryData.count : 0,
            };
        });
        const responseData = { categories };
        void (0, productReadCache_1.cacheSetJson)(cacheKey, responseData, 60);
        return res.json(responseData);
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch categories" });
    }
};
exports.getCategories = getCategories;
const getProducts = async (req, res) => {
    try {
        const { limit = 10, page = 1, category, minPrice, maxPrice, sortBy, sortOrder, search, tags, } = req.query;
        logger_1.logger.info('🔍 [GetProducts] Request received:', {
            limit,
            page,
            category,
            minPrice,
            maxPrice,
            sortBy,
            sortOrder,
            search,
            tags
        });
        // Parse and validate pagination
        const parsedLimit = Math.min(Number(limit) || 10, 50);
        const parsedPage = Math.max(Number(page) || 1, 1);
        const skip = (parsedPage - 1) * parsedLimit;
        const hasSearch = typeof search === "string" && String(search).trim().length > 0;
        // Build filter
        const filter = { ...SELLABLE_PRODUCT_FILTER };
        if (category)
            filter.category = category;
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice)
                filter.price.$gte = Number(minPrice);
            if (maxPrice)
                filter.price.$lte = Number(maxPrice);
        }
        if (search) {
            filter.name = { $regex: search, $options: "i" };
        }
        if (tags && typeof tags === "string") {
            const tagArray = tags.split(",").map((tag) => tag.trim());
            filter.tags = { $in: tagArray };
        }
        // Build sort
        const sort = { createdAt: -1 }; // default sort
        if (sortBy) {
            sort[sortBy] = sortOrder === "asc" ? 1 : -1;
        }
        const lifecycleOk = filter?.deletedAt === null &&
            filter?.isSellable &&
            typeof filter.isSellable === "object" &&
            filter.isSellable.$ne === false;
        const cacheEligible = !hasSearch && lifecycleOk;
        const cacheKey = cacheEligible
            ? (0, productReadCache_1.buildProductsListCacheKey)({
                page: parsedPage,
                limit: parsedLimit,
                category,
                minPrice,
                maxPrice,
                sortBy,
                sortOrder,
                tags,
            })
            : "";
        if (cacheEligible) {
            const cached = await (0, productReadCache_1.cacheGetJson)(cacheKey);
            if (cached && cached.products && cached.pagination) {
                return res.json(cached);
            }
        }
        logger_1.logger.info('📊 [GetProducts] Query built:', { filter, sort });
        // Execute query
        const products = await Product_1.Product.find(filter)
            .sort(sort)
            .skip(skip)
            .limit(parsedLimit);
        const total = await Product_1.Product.countDocuments(filter);
        const normalized = [];
        for (const p of products) {
            const clean = p.toObject ? p.toObject() : p;
            const norm = await normalizeProductImages(clean);
            normalized.push({
                ...norm,
                id: norm._id
            });
        }
        const safeProducts = normalized;
        const responseData = {
            products: safeProducts,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                total,
                pages: Math.ceil(total / parsedLimit),
            },
        };
        if (cacheEligible) {
            void (0, productReadCache_1.cacheSetJson)(cacheKey, responseData, 30);
        }
        return res.json(responseData);
    }
    catch (error) {
        logger_1.logger.error("❌ [GetProducts] Error:", error);
        const err = error;
        res.status(500).json({ message: "Server error", error: err?.message || String(err) });
    }
};
exports.getProducts = getProducts;
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        const cacheKey = (0, productReadCache_1.buildProductDetailCacheKey)(id);
        const cached = await (0, productReadCache_1.cacheGetJson)(cacheKey);
        if (cached && cached._id) {
            return res.json(cached);
        }
        logger_1.logger.info('🔍 [GetProductById] Request received:', { id });
        // Validate ID using mongoose.isValidObjectId
        const mongoose = require("mongoose");
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Fetch from MongoDB
        const product = await Product_1.Product.findOne({ _id: id, ...SELLABLE_PRODUCT_FILTER });
        if (!product) {
            logger_1.logger.info('❌ [GetProductById] Product not found in DB:', id);
            return res.status(404).json({ message: "Product not found" });
        }
        // Analyze image structure
        const images = product.images || [];
        logger_1.logger.info('🖼️ [GetProductById] Product images analysis:', {
            productId: id,
            productName: product.name,
            imagesCount: images.length,
            imageTypes: images.map(img => typeof img),
            firstImageStructure: images[0]
        });
        // Normalize images using the same function as debug endpoint
        const clean = product.toObject ? product.toObject() : product;
        const normalizedProduct = await normalizeProductImages(clean);
        void (0, productReadCache_1.cacheSetJson)(cacheKey, normalizedProduct, 120);
        logger_1.logger.info('✅ [GetProductById] Response prepared:', {
            productId: id,
            normalizedImagesCount: normalizedProduct.images.length,
            firstImage: normalizedProduct.images[0] || null
        });
        res.json(normalizedProduct);
    }
    catch (error) {
        logger_1.logger.error("❌ [GetProductById] Error:", error);
        res.status(500).json({ message: "Failed to fetch product" });
    }
};
exports.getProductById = getProductById;
// CREATE PRODUCT — FIXED WITH CLOUDINARY UPLOAD + VARIANTS + METADATA
const createProduct = async (req, res) => {
    try {
        const files = req.files || [];
        logger_1.logger.info('🔥 Incoming headers:', req.headers);
        logger_1.logger.info('🔥 Incoming body:', req.body);
        logger_1.logger.info('🔥 Incoming files count:', files.length);
        const parseNumberField = (value) => {
            if (value === undefined || value === null)
                return undefined;
            if (typeof value === "string" && value.trim() === "")
                return undefined;
            const n = Number(value);
            return Number.isFinite(n) ? n : NaN;
        };
        // Basic validation
        const filtered = files.filter(f => f && (f.size ?? 0) > 0 && /^image\/(jpeg|png|webp|avif)$/.test((f.mimetype ?? '')));
        logger_1.logger.info('🔥 Valid files after filter (size>0 & image mimetype):', filtered.map(f => ({ name: f.originalname, size: f.size, mime: f.mimetype })));
        if (filtered.length === 0) {
            return res.status(400).json({ message: 'No valid images uploaded (empty or invalid mimetype)' });
        }
        const { name, description, category, price, mrp, stock, weight, tags, } = req.body;
        const parsedPrice = parseNumberField(price);
        if (parsedPrice === undefined) {
            return res.status(400).json({ message: "Price is required" });
        }
        if (Number.isNaN(parsedPrice)) {
            return res.status(400).json({ message: "Invalid price" });
        }
        const parsedStock = parseNumberField(stock);
        if (parsedStock === undefined) {
            return res.status(400).json({ message: "Stock quantity is required" });
        }
        if (Number.isNaN(parsedStock)) {
            return res.status(400).json({ message: "Invalid stock quantity" });
        }
        const parsedMrp = parseNumberField(mrp);
        if (parsedMrp !== undefined && Number.isNaN(parsedMrp)) {
            return res.status(400).json({ message: "Invalid MRP" });
        }
        const parsedWeight = parseNumberField(weight);
        if (parsedWeight === undefined) {
            return res.status(400).json({ message: "Weight is required" });
        }
        if (Number.isNaN(parsedWeight)) {
            return res.status(400).json({ message: "Invalid weight" });
        }
        // Upload via MediaImageService (production) / bypass in tests
        const buffers = filtered
            .filter((f) => f.buffer && f.buffer.length > 0)
            .map((f) => f.buffer);
        if (buffers.length === 0) {
            return res.status(400).json({ message: 'No images could be uploaded' });
        }
        let imageDocs = [];
        if (process.env.NODE_ENV === "test") {
            // In test environment, avoid depending on Cloudinary/Sharp pipeline.
            // Keep the same API surface by storing a minimal image doc.
            imageDocs = filtered.slice(0, 1).map((f) => ({
                publicId: `test-${Date.now()}`,
                variants: {
                    original: `https://example.com/${encodeURIComponent(f.originalname || "test-image")}`,
                },
            }));
        }
        else {
            let uploadedImages = [];
            try {
                uploadedImages = await mediaService.uploadBuffersWithVariants(buffers, { folder: 'products' });
            }
            catch (err) {
                logger_1.logger.error('❌ Media upload failed:', err);
                return res.status(500).json({ message: 'Cloudinary upload failed', error: err?.message ?? String(err) });
            }
            imageDocs = uploadedImages.map((img) => ({
                publicId: img.publicId,
                variants: img.variants,
                formats: img.formats,
                metadata: img.metadata,
            }));
        }
        const product = new Product_1.Product({
            name,
            description,
            category,
            price: parsedPrice,
            mrp: parsedMrp,
            stock: parsedStock,
            weight: parsedWeight,
            tags,
            images: imageDocs,
        });
        const saved = await product.save();
        // Auto-translate product name and description to all languages
        try {
            const { nameTranslations, descriptionTranslations } = await (0, autoTranslateService_1.translateProduct)(name, description);
            saved.nameTranslations = nameTranslations;
            saved.descriptionTranslations = descriptionTranslations;
            await saved.save();
            logger_1.logger.info('✅ Product translations saved:', { productId: saved._id });
        }
        catch (translateError) {
            // Log but don't fail - translations can be added later
            logger_1.logger.warn('⚠️ Product translation failed (non-blocking):', translateError);
        }
        await cache_1.invalidateCache.products();
        // Normalize before sending to frontend
        const clean = saved.toObject ? saved.toObject() : saved;
        const normalized = await normalizeProductImages(clean);
        return res.status(201).json({
            success: true,
            product: normalized,
        });
    }
    catch (error) {
        logger_1.logger.error("CREATE PRODUCT ERROR:", error);
        if (error?.name === "ValidationError" && error?.errors) {
            const fieldErrors = {};
            for (const [field, err] of Object.entries(error.errors)) {
                const msg = err?.message;
                if (msg)
                    fieldErrors[field] = msg;
            }
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: fieldErrors,
            });
        }
        return res.status(500).json({
            success: false,
            message: "Server error while creating product",
        });
    }
};
exports.createProduct = createProduct;
const updateProduct = async (req, res) => {
    try {
        const { id } = req.params;
        const { images, name, description, ...updateData } = req.body;
        logger_1.logger.info('🔍 [UpdateProduct] Request received:', {
            productId: id,
            imagesCount: (images || []).length,
            hasImages: !!(images && images.length > 0)
        });
        // Validate ID using mongoose.isValidObjectId
        const mongoose = require("mongoose");
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Prepare update data
        const updateFields = { ...updateData };
        if (name !== undefined)
            updateFields.name = name;
        if (description !== undefined)
            updateFields.description = description;
        if (images !== undefined) {
            updateFields.images = images;
        }
        // Convert numeric fields
        if (updateFields.price)
            updateFields.price = Number(updateFields.price);
        if (updateFields.stock)
            updateFields.stock = Number(updateFields.stock);
        if (updateFields.mrp)
            updateFields.mrp = Number(updateFields.mrp);
        if (updateFields.weight)
            updateFields.weight = Number(updateFields.weight);
        const product = await Product_1.Product.findOneAndUpdate({ _id: id, ...SELLABLE_PRODUCT_FILTER }, updateFields, {
            new: true,
            runValidators: true,
        });
        if (!product) {
            logger_1.logger.info('❌ [UpdateProduct] Product not found:', id);
            return res.status(404).json({ message: "Product not found" });
        }
        // Re-translate if name or description changed
        if (name !== undefined || description !== undefined) {
            try {
                const { nameTranslations, descriptionTranslations } = await (0, autoTranslateService_1.translateProduct)(product.name, product.description);
                product.nameTranslations = nameTranslations;
                product.descriptionTranslations = descriptionTranslations;
                await product.save();
                logger_1.logger.info('✅ [UpdateProduct] Product translations updated:', { productId: id });
            }
            catch (translateError) {
                logger_1.logger.warn('⚠️ [UpdateProduct] Translation failed (non-blocking):', translateError);
            }
        }
        logger_1.logger.info('✅ [UpdateProduct] Product updated successfully:', {
            productId: id,
            imagesCount: (product.images || []).length
        });
        // Search indexing disabled (Algolia not configured)
        logger_1.logger.info('📝 [UpdateProduct] Search indexing disabled');
        await cache_1.invalidateCache.product(id);
        res.json({
            message: "Product updated successfully",
            product
        });
    }
    catch (error) {
        logger_1.logger.error("❌ [UpdateProduct] Error:", error);
        const err = error;
        res.status(500).json({ message: "Server error", error: err?.message || String(err) });
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        logger_1.logger.info('🔍 [DeleteProduct] Request received:', { productId: id });
        // Validate ID using mongoose.isValidObjectId
        const mongoose = require("mongoose");
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ message: "Product not found" });
        }
        const product = await Product_1.Product.findOneAndUpdate({ _id: id, ...SELLABLE_PRODUCT_FILTER }, { $set: { isSellable: false, isActive: false, deletedAt: new Date() } }, { new: true });
        if (!product) {
            logger_1.logger.info('❌ [DeleteProduct] Product not found:', id);
            return res.status(404).json({ message: "Product not found" });
        }
        logger_1.logger.info('✅ [DeleteProduct] Product deleted successfully:', {
            productId: id,
            productName: product.name
        });
        // Search indexing disabled (Algolia not configured)
        logger_1.logger.info('🗑️ [DeleteProduct] Search indexing disabled');
        await cache_1.invalidateCache.product(id);
        res.json({
            message: "Product deleted successfully",
            productId: id
        });
    }
    catch (error) {
        logger_1.logger.error("❌ [DeleteProduct] Error:", error);
        const err = error;
        res.status(500).json({ message: "Server error", error: err?.message || String(err) });
    }
};
exports.deleteProduct = deleteProduct;
// Helper function to escape regex special characters
const escapeRegex = (str) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};
const getSimilarProducts = async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = 4 } = req.query;
        // Validate ID using mongoose.isValidObjectId
        const mongoose = require("mongoose");
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Check if it's a fallback product ID (starts with "fallback-")
        if (id.startsWith("fallback-")) {
            return res.json({
                products: [],
                total: 0,
                message: "Product not found - fallback product",
            });
        }
        // First, get the current product to find similar ones
        const currentProduct = await Product_1.Product.findOne({ _id: id, ...SELLABLE_PRODUCT_FILTER });
        if (!currentProduct) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Find similar products based on category, excluding the current product
        const similarProducts = await Product_1.Product.find({
            ...SELLABLE_PRODUCT_FILTER,
            _id: { $ne: id }, // Exclude current product
            category: currentProduct.category,
        })
            .limit(Number(limit))
            .select("_id name price images category weight stock tags")
            .lean();
        // If no similar products found in same category, try to find any products
        let fallbackProducts = [];
        if (similarProducts.length === 0) {
            fallbackProducts = await Product_1.Product.find({
                ...SELLABLE_PRODUCT_FILTER,
                _id: { $ne: id },
            })
                .limit(Number(limit))
                .select("_id name price images category weight stock tags")
                .lean();
        }
        const products = similarProducts.length > 0 ? similarProducts : fallbackProducts;
        // Normalize all products using the same function as other endpoints
        const normalizedProducts = await Promise.all(products.map(async (product) => {
            const clean = product.toObject ? product.toObject() : product;
            const normalized = await normalizeProductImages(clean);
            return {
                _id: normalized._id,
                id: normalized._id,
                name: normalized.name || "Unknown Product",
                price: normalized.price || 0,
                images: normalized.images || [],
                category: normalized.category || "other",
                weight: normalized.weight || 0,
                stock: normalized.stock || 0,
                rating: 4.0, // Default rating since we don't have rating system yet
                tags: normalized.tags || [],
            };
        }));
        const safeProducts = normalizedProducts;
        const responseData = {
            products: safeProducts,
            total: safeProducts.length,
        };
        res.json(responseData);
    }
    catch (error) {
        // Return empty array instead of 500 error
        res.json({
            products: [],
            total: 0,
            message: "Failed to load similar products",
        });
    }
};
exports.getSimilarProducts = getSimilarProducts;
const debugProductImages = async (req, res) => {
    try {
        const { id } = req.params;
        logger_1.logger.info('🔍 [Debug] Checking product images for:', id);
        const product = await Product_1.Product.findOne({ _id: id, ...SELLABLE_PRODUCT_FILTER });
        if (!product) {
            logger_1.logger.info('❌ [Debug] Product not found:', id);
            return res.status(404).json({ message: "Product not found" });
        }
        const images = product.images || [];
        logger_1.logger.info('📊 [Debug] Product image analysis:', {
            productId: id,
            imagesCount: images.length,
            rawImages: images
        });
        const analysis = {
            rawImages: images,
            imageAnalysis: images.map((img, index) => ({
                index,
                type: typeof img,
                isString: typeof img === 'string',
                isObject: typeof img === 'object' && img !== null,
                isNull: img === null,
                isUndefined: img === undefined,
                hasPublicId: img && typeof img === 'object' ? !!img.publicId : false,
                hasVariants: img && typeof img === 'object' ? !!img.variants : false,
                hasFormats: img && typeof img === 'object' ? !!img.formats : false,
                hasMetadata: img && typeof img === 'object' ? !!img.metadata : false,
                publicId: img && typeof img === 'object' ? img.publicId : null,
                variantKeys: img && typeof img === 'object' && img.variants ? Object.keys(img.variants) : [],
                formatKeys: img && typeof img === 'object' && img.formats ? Object.keys(img.formats) : [],
                metadataKeys: img && typeof img === 'object' && img.metadata ? Object.keys(img.metadata) : [],
                stringValue: typeof img === 'string' ? img : null
            })),
            summary: {
                totalCount: images.length,
                stringCount: images.filter(img => typeof img === 'string').length,
                objectCount: images.filter(img => typeof img === 'object' && img !== null).length,
                validObjectCount: images.filter(img => typeof img === 'object' && img !== null && img.variants && img.formats && img.metadata).length,
                invalidCount: images.filter(img => img === null || img === undefined ||
                    (typeof img === 'object' && (!img.variants || !img.formats || !img.metadata))).length
            }
        };
        logger_1.logger.info('✅ [Debug] Analysis complete:', analysis.summary);
        res.json({
            productId: id,
            productName: product.name,
            ...analysis
        });
    }
    catch (error) {
        logger_1.logger.error("❌ [Debug] Error:", error);
        const err = error;
        res.status(500).json({ message: "Debug error", error: err?.message || String(err) });
    }
};
exports.debugProductImages = debugProductImages;
