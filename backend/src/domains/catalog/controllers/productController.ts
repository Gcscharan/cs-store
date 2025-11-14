import { Request, Response } from "express";
import { Product } from "../../../models/Product";
import { createError } from "../../../middleware/errorHandler";
import { AuthRequest } from "../../../middleware/auth";
import cloudinary from "../../../config/cloudinary";
import redisClient from "../../../config/redis";
import { invalidateCache } from "../../../middleware/cache";
import { dispatchToAllUsers } from "../../communication/services/notificationService";

export const getProducts = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Generate cache key
    const cacheKey = redisClient.generateProductsListKey(req.query);
    
    // Try to get from cache (Cache-Aside Pattern - Step 1: Check cache)
    if (redisClient.isReady()) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 Products Cache HIT: ${cacheKey}`);
        return res.json(JSON.parse(cachedData));
      }
      console.log(`💥 Products Cache MISS: ${cacheKey}`);
    }

    // Cache miss - fetch from MongoDB
    const query: any = {};

    // Apply filters
    if (category) query.category = category;
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }
    if (search) {
      query.$text = { $search: search as string };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "desc" ? -1 : 1;

    const products = await Product.find(query)
      .sort(sort)
      .skip(skip)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);

    const responseData = {
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };

    // Cache the response (Cache-Aside Pattern - Step 2: Store in cache)
    if (redisClient.isReady()) {
      await redisClient.set(cacheKey, JSON.stringify(responseData), 3600); // 1 hour TTL
    }

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
};

export const getProductById = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // Debug logging
    console.log("Backend - Fetching product with ID:", id);

    // Check if it's a fallback product ID (starts with "fallback-")
    if (id.startsWith("fallback-")) {
      console.log("Backend - Fallback product detected, returning 404");
      return res.status(404).json({ error: "Product not found" });
    }

    // Generate cache key
    const cacheKey = redisClient.generateProductKey(id);
    
    // Try to get from cache (Cache-Aside Pattern - Step 1: Check cache)
    if (redisClient.isReady()) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 Product Cache HIT: ${id}`);
        return res.json(JSON.parse(cachedData));
      }
      console.log(`💥 Product Cache MISS: ${id}`);
    }

    // Cache miss - fetch from MongoDB
    const product = await Product.findById(id);
    console.log("Backend - Product found:", product ? "Yes" : "No");

    if (!product) {
      console.log("Backend - Product not found in database");
      return res.status(404).json({ error: "Product not found" });
    }

    // Cache the response (Cache-Aside Pattern - Step 2: Store in cache)
    if (redisClient.isReady()) {
      await redisClient.set(cacheKey, JSON.stringify(product), 3600); // 1 hour TTL
    }

    console.log("Backend - Returning product:", product.name);
    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
};

export const createProduct = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const productData = req.body;

    // Handle image uploads if images are provided as base64
    if (productData.images && Array.isArray(productData.images)) {
      const uploadedImages = [];

      for (const image of productData.images) {
        if (typeof image === "string" && image.startsWith("data:image/")) {
          // Upload base64 image to Cloudinary
          const result = await cloudinary.uploader.upload(image, {
            folder: "cps-store/products",
            resource_type: "image",
            transformation: [
              { width: 800, height: 600, crop: "limit" },
              { quality: "auto" },
              { format: "auto" },
            ],
          });
          uploadedImages.push(result.secure_url);
        } else {
          // Already a URL
          uploadedImages.push(image);
        }
      }

      productData.images = uploadedImages;
    }

    const product = new Product(productData);
    await product.save();

    // Invalidate product caches after creation
    await invalidateCache.products();

    // Send new product notification to all eligible users
    try {
      await dispatchToAllUsers('NEW_PRODUCT_ALERT', {
        productId: product._id.toString(),
        productName: product.name,
        productPrice: product.price,
        productCategory: product.category
      });
      console.log(`📢 New product notification sent for: ${product.name}`);
    } catch (notificationError) {
      console.error("Failed to send new product notification:", notificationError);
    }

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);
    res.status(500).json({ error: "Failed to create product" });
    return;
  }
};

export const updateProduct = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Invalidate specific product cache and all product lists after update
    await invalidateCache.product(id);

    res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update product" });
  }
};

export const deleteProduct = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Invalidate specific product cache and all product lists after deletion
    await invalidateCache.product(id);

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete product" });
  }
};

// Helper function to escape regex special characters
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const getSearchSuggestions = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { q } = req.query;

    // Return empty array if query is empty or too short
    if (!q || (q as string).length < 1) {
      return res.json({ products: [] });
    }

    const searchQuery = (q as string).trim();
    
    // Generate cache key
    const cacheKey = redisClient.generateSearchKey(searchQuery);
    
    // Try to get from cache (Cache-Aside Pattern - Step 1: Check cache)
    if (redisClient.isReady()) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 Search Cache HIT: ${searchQuery}`);
        return res.json(JSON.parse(cachedData));
      }
      console.log(`💥 Search Cache MISS: ${searchQuery}`);
    }

    const escapedQuery = escapeRegex(searchQuery);

    // Case-insensitive search on product name
    const products = await Product.find({
      name: { $regex: escapedQuery, $options: "i" },
    })
      .select("_id name images category price sales views")
      .lean()
      .exec();

    // Score and sort products in JavaScript
    const scoredProducts = products.map((product: any) => {
      const name = product.name || "";
      const nameLower = name.toLowerCase();
      const queryLower = searchQuery.toLowerCase();

      // Calculate match scores
      const isPrefix = nameLower.startsWith(queryLower) ? 1 : 0;
      const isWordPrefix = new RegExp('\\b' + escapedQuery, 'i').test(name) ? 1 : 0;
      const isSubstring = nameLower.includes(queryLower) ? 1 : 0;
      const popularityScore = (product.sales || 0) + ((product.views || 0) * 0.1);

      // Calculate final score
      const score = (isPrefix * 100) + (isWordPrefix * 50) + (isSubstring * 10) + popularityScore;

      return {
        ...product,
        score,
      };
    });

    // Sort by score (desc), then name (asc), and limit to 8
    const sortedProducts = scoredProducts
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return (a.name || "").localeCompare(b.name || "");
      })
      .slice(0, 8);

    // Format response with safe defaults
    const suggestions = sortedProducts.map((product) => ({
      _id: product._id,
      name: product.name || "Unknown Product",
      image:
        product.images && product.images.length > 0
          ? product.images[0]
          : "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop&crop=center",
      category: product.category || "Products",
      price: product.price || 0,
    }));

    const responseData = { products: suggestions };

    // Cache the response (Cache-Aside Pattern - Step 2: Store in cache)
    if (redisClient.isReady()) {
      await redisClient.set(cacheKey, JSON.stringify(responseData), 1800); // 30 minutes TTL
    }

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching search suggestions:", error);
    res.status(500).json({ error: "Failed to fetch suggestions" });
  }
};

export const getSimilarProducts = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { limit = 4 } = req.query;

    // Check if it's a fallback product ID (starts with "fallback-")
    if (id.startsWith("fallback-")) {
      return res.json({
        products: [],
        total: 0,
        message: "Product not found - fallback product",
      });
    }

    // Generate cache key
    const cacheKey = redisClient.generateSimilarProductsKey(id, Number(limit));
    
    // Try to get from cache (Cache-Aside Pattern - Step 1: Check cache)
    if (redisClient.isReady()) {
      const cachedData = await redisClient.get(cacheKey);
      if (cachedData) {
        console.log(`🎯 Similar Products Cache HIT: ${id}`);
        return res.json(JSON.parse(cachedData));
      }
      console.log(`💥 Similar Products Cache MISS: ${id}`);
    }

    // First, get the current product to find similar ones
    const currentProduct = await Product.findById(id);
    if (!currentProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    // Find similar products based on category, excluding the current product
    const similarProducts = await Product.find({
      _id: { $ne: id }, // Exclude current product
      category: currentProduct.category,
    })
      .limit(Number(limit))
      .select("_id name price images category weight stock tags")
      .lean();

    // If no similar products found in same category, try to find any products
    let fallbackProducts: any[] = [];
    if (similarProducts.length === 0) {
      fallbackProducts = await Product.find({
        _id: { $ne: id },
      })
        .limit(Number(limit))
        .select("_id name price images category weight stock tags")
        .lean();
    }

    const products =
      similarProducts.length > 0 ? similarProducts : fallbackProducts;

    // Ensure all products have required fields with defaults
    const safeProducts = products.map((product) => ({
      _id: product._id,
      id: product._id,
      name: product.name || "Unknown Product",
      price: product.price || 0,
      image:
        product.images && product.images.length > 0
          ? product.images[0]
          : "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop&crop=center",
      category: product.category || "other",
      weight: product.weight || 0,
      stock: product.stock || 0,
      rating: 4.0, // Default rating since we don't have rating system yet
      tags: product.tags || [],
    }));

    const responseData = {
      products: safeProducts,
      total: safeProducts.length,
    };

    // Cache the response (Cache-Aside Pattern - Step 2: Store in cache)
    if (redisClient.isReady()) {
      await redisClient.set(cacheKey, JSON.stringify(responseData), 1800); // 30 minutes TTL
    }

    res.json(responseData);
  } catch (error) {
    console.error("Error fetching similar products:", error);
    // Return empty array instead of 500 error
    res.json({
      products: [],
      total: 0,
      error: "Failed to load similar products",
    });
  }
};
