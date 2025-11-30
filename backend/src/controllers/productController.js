import Product from "../models/Product.js";
import { normalizeProductImages } from "../utils/normalizeProductImages.js";

export const getProducts = async (req, res) => {
  try {
    const products = await Product.find();
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
    const p = await Product.findById(req.params.id);
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
