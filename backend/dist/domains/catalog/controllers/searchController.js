"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSearchSuggestions = exports.searchProducts = void 0;
const SearchService_1 = require("../../search/services/SearchService");
const searchService = new SearchService_1.SearchService();
const searchProducts = async (req, res) => {
    try {
        const { q } = req.query;
        // If no query provided, don't treat it as an error – just return no results
        if (!q || typeof q !== "string" || q.trim().length === 0) {
            res.status(200).json({
                products: [],
                total: 0,
                message: "No search query provided; returning empty results.",
                query: ""
            });
            return;
        }
        console.log(`🔍 Search request:`, { query: q.trim() });
        const result = await searchService.search({ q: q.trim() });
        console.log(`📊 Search results:`, {
            query: result.query,
            hits: result.products.length,
            message: result.message
        });
        // Preserve response shape
        res.json({
            products: result.products || [],
            total: result.total,
            message: result.message,
            query: result.query
        });
    }
    catch (error) {
        console.error("❌ Search error:", error);
        res.status(500).json({
            error: "Internal server error during search",
            message: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
exports.searchProducts = searchProducts;
const getSearchSuggestions = async (req, res) => {
    try {
        const rawQ = req.query.q ?? "";
        console.log("[SEARCH SUGGESTIONS] received q:", JSON.stringify(rawQ));
        const { suggestions } = await searchService.suggestions({ q: rawQ });
        console.log(`[SEARCH SUGGESTIONS] returning ${suggestions.length} suggestions (top scores):`, suggestions.map(s => ({ name: s.name, score: s.score })));
        res.json({ suggestions });
    }
    catch (err) {
        console.error("[SEARCH SUGGESTIONS] error:", err);
        res.status(500).json({ suggestions: [] });
    }
};
exports.getSearchSuggestions = getSearchSuggestions;
