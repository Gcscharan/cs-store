"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductRepository = void 0;
const Product_1 = require("../../../models/Product");
class ProductRepository {
    async findById(productId) {
        return await Product_1.Product.findById(productId);
    }
}
exports.ProductRepository = ProductRepository;
