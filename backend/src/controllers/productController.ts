import { Request, Response } from "express";
import { Product } from "../models/Product";
import { createError } from "../middleware/errorHandler";

export const getProducts = async (req: Request, res: Response) => {
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

    res.json({
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
};

export const getProductById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch product" });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const productData = req.body;
    const product = new Product(productData);
    await product.save();

    res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create product" });
  }
};

export const updateProduct = async (req: Request, res: Response) => {
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

    res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update product" });
  }
};

export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete product" });
  }
};
