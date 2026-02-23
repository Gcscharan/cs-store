import { Request, Response } from "express";
import { Product } from "../../../models/Product";
import { normalizeProductImages } from "./productController";

const SELLABLE_PRODUCT_FILTER: any = {
  deletedAt: null,
  isSellable: { $ne: false },
};

export const debugProductImages = async (req: Request, res: Response) => {
  try {
    const product = await Product.findOne({ _id: req.params.id, ...SELLABLE_PRODUCT_FILTER }).lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const normalizedProduct = await normalizeProductImages(product);
    const normalized = normalizedProduct.images || [];

    return res.json({
      message: "Debug data",
      productId: product._id,
      rawImages: product.images,
      normalizedImages: normalized
    });
  } catch (err) {
    console.error("Debug Error:", err);
    return res.status(500).json({ message: "Server Error", error: err });
  }
};
