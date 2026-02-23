import Product from "../models/Product.js";
import { normalizeProductImages } from "../utils/normalizeProductImages.js";

const SELLABLE_PRODUCT_FILTER = {
  deletedAt: null,
  isSellable: { $ne: false },
};

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find(SELLABLE_PRODUCT_FILTER);
    const fixed = products.map(p => ({
      ...p._doc,
      id: p._id,
      images: normalizeProductImages(p.images),
    }));

    res.json({
      products: fixed,
      page: 1,
      limit: fixed.length,
      total: fixed.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getProductById = async (req, res) => {
  try {
    const p = await Product.findOne({ _id: req.params.id, ...SELLABLE_PRODUCT_FILTER });
    if (!p) {
      return res.status(404).json({ error: "Product not found" });
    }
    const fixed = {
      ...p._doc,
      id: p._id,
      images: normalizeProductImages(p.images),
    };

    res.json(fixed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
