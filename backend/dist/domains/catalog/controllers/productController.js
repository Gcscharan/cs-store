"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugProductImages = exports.getSimilarProducts = exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProductById = exports.getProducts = exports.getCategories = void 0;
exports.normalizeProductImages = normalizeProductImages;
const Product_1 = require("../../../models/Product");
const imageService_1 = require("../../../services/imageService");
const cloudinary_1 = require("cloudinary");
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
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
    console.log('🖼️ [Normalize] Input images:', JSON.stringify(product.images, null, 2));
    if (!product.images || product.images.length === 0) {
        console.log('🖼️ [Normalize] No images found, returning product as-is');
        return product;
    }
    // Create a deep copy to avoid modifying the original
    const normalizedProduct = JSON.parse(JSON.stringify(product));
    // If first item is an object with variants -> already new schema
    const first = normalizedProduct.images[0];
    if (first && first.variants && first.variants.thumb) {
        console.log('🖼️ [Normalize] Already new schema, returning as-is');
        return normalizedProduct;
    }
    // GUARD: If first is corrupted object with only _id -> restore with fallback
    if (first && Object.keys(first).length === 1 && first._id) {
        console.log('🖼️ [Normalize] Detected corrupted image (only _id), restoring with fallback');
        const basePublicId = 'sample';
        const variants = (0, imageService_1.generateImageVariantsFromPublicId)(basePublicId);
        const formats = (0, imageService_1.generateModernFormatsFromPublicId)(basePublicId);
        normalizedProduct.images[0] = {
            publicId: basePublicId,
            variants,
            formats,
            metadata: {
                width: 800,
                height: 600,
                aspectRatio: 800 / 600
            }
        };
        console.log('🖼️ [Normalize] Output images:', JSON.stringify(normalizedProduct.images, null, 2));
        return normalizedProduct;
    }
    // If first is legacy object { full, thumb }:
    if (first && first.full) {
        try {
            // Check if it's a demo Cloudinary URL - replace with our working demo image
            if (first.full.includes('cloudinary.com/demo/')) {
                // Use the working demo image as base
                const basePublicId = 'sample';
                const variants = (0, imageService_1.generateImageVariantsFromPublicId)(basePublicId);
                const formats = (0, imageService_1.generateModernFormatsFromPublicId)(basePublicId);
                normalizedProduct.images[0] = {
                    publicId: basePublicId,
                    variants,
                    formats,
                    metadata: {
                        width: 800,
                        height: 600,
                        aspectRatio: 800 / 600
                    }
                };
                console.log('🖼️ [Normalize] Replaced demo Cloudinary URL with structured variants');
            }
            else {
                // If URL contains our cloudinary cloud name and a public id, derive
                const r = /upload\/(?:v\d+\/)?(.+)\.(jpg|jpeg|png|webp|gif|avif)$/;
                const m = String(first.full).match(r);
                if (m && m[1]) {
                    const publicId = m[1];
                    const variants = (0, imageService_1.generateImageVariantsFromPublicId)(publicId);
                    const formats = (0, imageService_1.generateModernFormatsFromPublicId)(publicId);
                    normalizedProduct.images[0] = {
                        publicId,
                        variants,
                        formats,
                        metadata: {
                            width: 800,
                            height: 600,
                            aspectRatio: 800 / 600
                        }
                    };
                }
                else {
                    // remote url not a cloudinary id — import to our cloudinary
                    const newImage = await (0, imageService_1.importRemoteImageAndGenerate)(first.full);
                    normalizedProduct.images[0] = newImage;
                }
            }
        }
        catch (err) {
            console.error('Error normalizing image:', err);
            // fallback: keep original
        }
    }
    // If first is plain string url: import remote
    if (typeof first === 'string') {
        try {
            const newImage = await (0, imageService_1.importRemoteImageAndGenerate)(first);
            normalizedProduct.images[0] = newImage;
        }
        catch (err) {
            console.error('Error importing remote image:', err);
            // fallback: keep original
        }
    }
    console.log('🖼️ [Normalize] Output images:', JSON.stringify(normalizedProduct.images, null, 2));
    return normalizedProduct;
}
const getCategories = async (req, res) => {
    try {
        // Get product counts by category
        const categoryCounts = await Product_1.Product.aggregate([
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
        res.json({ categories });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch categories" });
    }
};
exports.getCategories = getCategories;
const getProducts = async (req, res) => {
    try {
        const { limit = 10, page = 1, category, minPrice, maxPrice, sortBy, sortOrder, search, tags, } = req.query;
        console.log('🔍 [GetProducts] Request received:', {
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
        // Build filter
        const filter = {};
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
        let sort = { createdAt: -1 }; // default sort
        if (sortBy) {
            sort[sortBy] = sortOrder === "asc" ? 1 : -1;
        }
        console.log('📊 [GetProducts] Query built:', { filter, sort });
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
        return res.json({
            products: safeProducts,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                total,
                pages: Math.ceil(total / parsedLimit),
            },
        });
    }
    catch (error) {
        console.error("❌ [GetProducts] Error:", error);
        const err = error;
        res.status(500).json({ message: "Server error", error: err?.message || String(err) });
    }
};
exports.getProducts = getProducts;
const getProductById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🔍 [GetProductById] Request received:', { id });
        // Validate ID using mongoose.isValidObjectId
        const mongoose = require("mongoose");
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Fetch from MongoDB
        const product = await Product_1.Product.findById(id);
        if (!product) {
            console.log('❌ [GetProductById] Product not found in DB:', id);
            return res.status(404).json({ message: "Product not found" });
        }
        // Analyze image structure
        const images = product.images || [];
        console.log('🖼️ [GetProductById] Product images analysis:', {
            productId: id,
            productName: product.name,
            imagesCount: images.length,
            imageTypes: images.map(img => typeof img),
            firstImageStructure: images[0]
        });
        // Normalize images using the same function as debug endpoint
        const clean = product.toObject ? product.toObject() : product;
        const normalizedProduct = await normalizeProductImages(clean);
        console.log('✅ [GetProductById] Response prepared:', {
            productId: id,
            normalizedImagesCount: normalizedProduct.images.length,
            firstImage: normalizedProduct.images[0] || null
        });
        res.json(normalizedProduct);
    }
    catch (error) {
        console.error("❌ [GetProductById] Error:", error);
        res.status(500).json({ message: "Failed to fetch product" });
    }
};
exports.getProductById = getProductById;
// CREATE PRODUCT — FIXED WITH CLOUDINARY UPLOAD + VARIANTS + METADATA
const createProduct = async (req, res) => {
    try {
        const files = req.files || [];
        console.log('🔥 Incoming headers:', req.headers);
        console.log('🔥 Incoming body:', req.body);
        console.log('🔥 Incoming files count:', files.length);
        // Basic validation
        const filtered = files.filter(f => f && (f.size ?? 0) > 0 && /^image\/(jpeg|png|webp|avif)$/.test((f.mimetype ?? '')));
        console.log('🔥 Valid files after filter (size>0 & image mimetype):', filtered.map(f => ({ name: f.originalname, size: f.size, mime: f.mimetype })));
        if (filtered.length === 0) {
            return res.status(400).json({ message: 'No valid images uploaded (empty or invalid mimetype)' });
        }
        const { name, description, category, price, mrp, stock, weight, tags, } = req.body;
        // Cloudinary helper
        const uploadToCloudinary = async (buffer) => {
            return new Promise((resolve, reject) => {
                cloudinary_1.v2.uploader
                    .upload_stream({
                    folder: "products",
                    resource_type: "image",
                    format: "jpg",
                }, (err, result) => {
                    if (err)
                        return reject(err);
                    resolve(result);
                })
                    .end(buffer);
            });
        };
        // process files -> when calling Cloudinary use try/catch per file
        const uploads = [];
        for (const f of filtered) {
            if (!f.buffer || f.buffer.length === 0) {
                console.warn('⚠️ Skipping empty buffer for file', f.originalname);
                continue;
            }
            console.log('🔥 Processing file:', f.originalname, 'size:', f.buffer.length, 'first 32 bytes:', f.buffer.slice(0, 32).toString('hex'));
            try {
                // uploadToCloudinary is your helper. Wrap it so errors are caught and logged.
                const result = await uploadToCloudinary(f.buffer);
                uploads.push(result);
            }
            catch (err) {
                console.error('❌ Cloudinary upload failed for', f.originalname, 'error=', err);
                // do not crash server: either return error or continue depending on your desired behaviour
                return res.status(500).json({ message: 'Cloudinary upload failed', error: err?.message ?? String(err) });
            }
        }
        if (uploads.length === 0) {
            return res.status(400).json({ message: 'No images could be uploaded' });
        }
        // Build variants
        const buildVariants = (publicId) => ({
            micro: cloudinary_1.v2.url(publicId, { transformation: [{ width: 16, height: 16, crop: "fill" }] }),
            thumb: cloudinary_1.v2.url(publicId, { transformation: [{ width: 150, height: 150, crop: "fill" }] }),
            small: cloudinary_1.v2.url(publicId, { transformation: [{ width: 300, height: 300, crop: "fill" }] }),
            medium: cloudinary_1.v2.url(publicId, { transformation: [{ width: 600, height: 600, crop: "fill" }] }),
            large: cloudinary_1.v2.url(publicId, { transformation: [{ width: 1200, height: 1200, crop: "fill" }] }),
            original: cloudinary_1.v2.url(publicId),
        });
        const buildFormats = (publicId) => ({
            avif: cloudinary_1.v2.url(publicId, { format: "avif" }),
            webp: cloudinary_1.v2.url(publicId, { format: "webp" }),
            jpg: cloudinary_1.v2.url(publicId, { format: "jpg" }),
        });
        // Process uploaded images
        const imageDocs = [];
        for (const uploaded of uploads) {
            const metadata = {
                width: uploaded.width,
                height: uploaded.height,
                aspectRatio: uploaded.width / uploaded.height,
            };
            imageDocs.push({
                publicId: uploaded.public_id,
                variants: buildVariants(uploaded.public_id),
                formats: buildFormats(uploaded.public_id),
                metadata,
            });
        }
        const product = new Product_1.Product({
            name,
            description,
            category,
            price,
            mrp,
            stock,
            weight,
            tags,
            images: imageDocs,
        });
        const saved = await product.save();
        // Normalize before sending to frontend
        const clean = saved.toObject ? saved.toObject() : saved;
        const normalized = await normalizeProductImages(clean);
        return res.status(201).json({
            success: true,
            product: normalized,
        });
    }
    catch (error) {
        console.error("CREATE PRODUCT ERROR:", error);
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
        const { images, ...updateData } = req.body;
        console.log('🔍 [UpdateProduct] Request received:', {
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
        const product = await Product_1.Product.findByIdAndUpdate(id, updateFields, {
            new: true,
            runValidators: true,
        });
        if (!product) {
            console.log('❌ [UpdateProduct] Product not found:', id);
            return res.status(404).json({ message: "Product not found" });
        }
        console.log('✅ [UpdateProduct] Product updated successfully:', {
            productId: id,
            imagesCount: (product.images || []).length
        });
        // Search indexing disabled (Algolia not configured)
        console.log('📝 [UpdateProduct] Search indexing disabled');
        res.json({
            message: "Product updated successfully",
            product
        });
    }
    catch (error) {
        console.error("❌ [UpdateProduct] Error:", error);
        const err = error;
        res.status(500).json({ message: "Server error", error: err?.message || String(err) });
    }
};
exports.updateProduct = updateProduct;
const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;
        console.log('🔍 [DeleteProduct] Request received:', { productId: id });
        // Validate ID using mongoose.isValidObjectId
        const mongoose = require("mongoose");
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ message: "Product not found" });
        }
        const product = await Product_1.Product.findByIdAndDelete(id);
        if (!product) {
            console.log('❌ [DeleteProduct] Product not found:', id);
            return res.status(404).json({ message: "Product not found" });
        }
        console.log('✅ [DeleteProduct] Product deleted successfully:', {
            productId: id,
            productName: product.name
        });
        // Search indexing disabled (Algolia not configured)
        console.log('🗑️ [DeleteProduct] Search indexing disabled');
        res.json({
            message: "Product deleted successfully",
            productId: id
        });
    }
    catch (error) {
        console.error("❌ [DeleteProduct] Error:", error);
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
        const currentProduct = await Product_1.Product.findById(id);
        if (!currentProduct) {
            return res.status(404).json({ message: "Product not found" });
        }
        // Find similar products based on category, excluding the current product
        const similarProducts = await Product_1.Product.find({
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
        console.log('🔍 [Debug] Checking product images for:', id);
        const product = await Product_1.Product.findById(id);
        if (!product) {
            console.log('❌ [Debug] Product not found:', id);
            return res.status(404).json({ message: "Product not found" });
        }
        const images = product.images || [];
        console.log('📊 [Debug] Product image analysis:', {
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
        console.log('✅ [Debug] Analysis complete:', analysis.summary);
        res.json({
            productId: id,
            productName: product.name,
            ...analysis
        });
    }
    catch (error) {
        console.error("❌ [Debug] Error:", error);
        const err = error;
        res.status(500).json({ message: "Debug error", error: err?.message || String(err) });
    }
};
exports.debugProductImages = debugProductImages;
