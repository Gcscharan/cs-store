"use strict";
/**
 * searchService.ts
 * MongoDB-based search only. Algolia is disabled.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchProducts = void 0;
const searchProducts = async (query) => {
    return {
        hits: [],
        query,
        message: "Search disabled: Algolia not configured.",
    };
};
exports.searchProducts = searchProducts;
exports.default = {
    searchProducts: exports.searchProducts,
};
