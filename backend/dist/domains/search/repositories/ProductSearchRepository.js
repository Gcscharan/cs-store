"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductSearchRepository = void 0;
const Product_1 = require("../../../models/Product");
class ProductSearchRepository {
    async aggregate(pipeline) {
        return Product_1.Product.aggregate(pipeline);
    }
    async find(query, projection, options) {
        let q = Product_1.Product.find(query, projection);
        if (options?.sort)
            q = q.sort(options.sort);
        if (typeof options?.skip === 'number')
            q = q.skip(options.skip);
        if (typeof options?.limit === 'number')
            q = q.limit(options.limit);
        if (options?.lean !== false)
            q = q.lean();
        const res = await q.exec();
        return res;
    }
    async countDocuments(query) {
        return Product_1.Product.countDocuments(query).exec();
    }
}
exports.ProductSearchRepository = ProductSearchRepository;
