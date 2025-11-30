"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugProductImages = void 0;
const Product_1 = require("../../../models/Product");
const productController_1 = require("./productController");
const debugProductImages = async (req, res) => {
    try {
        const product = await Product_1.Product.findById(req.params.id).lean();
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const normalizedProduct = await (0, productController_1.normalizeProductImages)(product);
        const normalized = normalizedProduct.images || [];
        return res.json({
            message: "Debug data",
            productId: product._id,
            rawImages: product.images,
            normalizedImages: normalized
        });
    }
    catch (err) {
        console.error("Debug Error:", err);
        return res.status(500).json({ message: "Server Error", error: err });
    }
};
exports.debugProductImages = debugProductImages;
