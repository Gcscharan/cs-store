"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchService = void 0;
const ProductSearchRepository_1 = require("../repositories/ProductSearchRepository");
const MediaImageService_1 = require("../../media/services/MediaImageService");
const regex_1 = require("../../../utils/regex");
const searchFallbackService_1 = require("../../../services/searchFallbackService");
class SearchService {
    constructor() {
        this.SUGGESTION_PROJECTION = "name images category description tags sales views";
        this.REPO_FETCH_LIMIT = 200;
        this.DEFAULT_SUGGESTION_LIMIT = 12;
        this.fallback = new searchFallbackService_1.SearchFallbackService();
        this.repo = new ProductSearchRepository_1.ProductSearchRepository();
        this.media = new MediaImageService_1.MediaImageService();
    }
    // MongoDB-based search using fallback service (no Algolia required)
    async search(options) {
        const q = (options.q || "").trim();
        if (!q) {
            return {
                products: [],
                total: 0,
                message: "Empty search query.",
                query: "",
            };
        }
        try {
            const result = await this.fallback.searchProducts({
                q,
                page: options.page ?? 1,
                limit: options.limit ?? 12,
                category: options.category,
                minPrice: options.minPrice,
                maxPrice: options.maxPrice,
                sortBy: options.sortBy,
                sortOrder: options.sortOrder,
                suggest: false,
            });
            return {
                products: result.products,
                total: result.total,
                message: "Search results from MongoDB fallback.",
                query: q,
            };
        }
        catch (error) {
            console.error("SearchService.search error:", error);
            return {
                products: [],
                total: 0,
                message: "Search failed due to an internal error.",
                query: q,
            };
        }
    }
    scoreProduct(p, qLower, wordBoundaryRegex) {
        let score = 0;
        const name = (p.name || "").toString();
        const nameLower = name.toLowerCase();
        // strong prefix match
        if (nameLower.startsWith(qLower))
            score += 200;
        // word boundary
        if (wordBoundaryRegex.test(name))
            score += 120;
        // substring
        if (nameLower.includes(qLower))
            score += 60;
        // category & tags
        if (p.category && p.category.toString().toLowerCase().includes(qLower))
            score += 40;
        if (Array.isArray(p.tags)) {
            for (const t of p.tags) {
                if (typeof t === "string" && t.toLowerCase().includes(qLower))
                    score += 30;
            }
        }
        // popularity (safe defaults)
        const sales = typeof p.sales === "number" ? p.sales : 0;
        const views = typeof p.views === "number" ? p.views : 0;
        score += sales * 3 + views * 0.2;
        return score;
    }
    // Suggestions logic moved from catalog controller; DB access via repository; images normalized via Media domain
    async suggestions(options) {
        const rawQ = options.q ?? "";
        const q = rawQ.trim();
        if (q.length === 0) {
            return { suggestions: [] };
        }
        const escaped = (0, regex_1.escapeRegex)(q);
        const regex = new RegExp(escaped, "i");
        const dbQuery = {
            $or: [
                { name: regex },
                { description: regex },
                { category: regex },
                { tags: regex },
            ],
        };
        const docs = await this.repo.find(dbQuery, this.SUGGESTION_PROJECTION, { limit: this.REPO_FETCH_LIMIT, sort: undefined, lean: true });
        if (!docs || docs.length === 0) {
            return { suggestions: [] };
        }
        const qLower = q.toLowerCase();
        const wordBoundaryRegex = new RegExp(`\\b${escaped}`, "i");
        const scored = docs.map((p) => {
            const score = this.scoreProduct(p, qLower, wordBoundaryRegex);
            return { product: p, score };
        });
        const filtered = scored
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
            .slice(0, options.limit ?? this.DEFAULT_SUGGESTION_LIMIT);
        const normalizedSuggestions = await Promise.all(filtered.map(async (x) => {
            const normalizedProduct = await this.media.normalizeProductImages(x.product);
            return {
                _id: normalizedProduct._id,
                name: normalizedProduct.name,
                category: normalizedProduct.category,
                images: normalizedProduct.images || [],
                snippet: (normalizedProduct.description || "").substring(0, 120),
                score: x.score,
            };
        }));
        return { suggestions: normalizedSuggestions };
    }
}
exports.SearchService = SearchService;
