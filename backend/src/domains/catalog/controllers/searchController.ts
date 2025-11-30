import { Request, Response } from "express";
import searchService, { searchProducts as searchProductsFn } from "../../../services/searchService";
import { Product } from "../../../models/Product";
import { normalizeProductImages } from "./productController";

export const searchProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;

    // Validate required parameters
    if (!q || typeof q !== "string" || q.trim().length === 0) {
      res.status(400).json({
        error: "Search query 'q' is required and must be a non-empty string"
      });
      return;
    }

    console.log(`🔍 Search request:`, { query: q.trim() });

    const result = await searchProductsFn(q.trim());

    console.log(`📊 Search results:`, {
      query: q.trim(),
      hits: result.hits.length,
      message: result.message
    });

    // Return results
    res.json({
      products: result.hits || [],
      total: 0,
      message: result.message,
      query: result.query
    });

  } catch (error) {
    console.error("❌ Search error:", error);
    res.status(500).json({
      error: "Internal server error during search",
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

export const getSearchSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawQ = (req.query.q as string) ?? "";
    const q = rawQ.trim();

    console.log("[SEARCH SUGGESTIONS] received q:", JSON.stringify(rawQ));

    if (q.length === 0) {
      console.log("[SEARCH SUGGESTIONS] empty query -> returning []");
      res.json({ suggestions: [] });
      return;
    }

    // Escape regex special chars:
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(escaped, "i");

    // Basic DB query to verify DB matches exist:
    // Restrict fields to reduce payload
    const dbQuery = {
      $or: [
        { name: regex },
        { description: regex },
        { category: regex },
        { tags: regex }
      ]
    };

    console.log("[SEARCH SUGGESTIONS] executing DB find with query:", JSON.stringify(dbQuery));

    const docs = await Product.find(dbQuery, "name images category description tags sales views")
      .limit(200)
      .lean()
      .exec();

    console.log(`[SEARCH SUGGESTIONS] DB returned ${Array.isArray(docs) ? docs.length : 0} docs`);

    if (!docs || docs.length === 0) {
      res.json({ suggestions: [] });
      return;
    }

    // scoring function (tune weights as you like)
    const qLower = q.toLowerCase();
    const scored = docs.map((p: any) => {
      let score = 0;
      const name = (p.name || "").toString();
      const nameLower = name.toLowerCase();

      // strong prefix match
      if (nameLower.startsWith(qLower)) score += 200;
      // word boundary (e.g., "amul b" matches "Amul Butter")
      if (new RegExp(`\\b${escaped}`, "i").test(name)) score += 120;
      // substring
      if (nameLower.includes(qLower)) score += 60;

      // category & tags
      if (p.category && p.category.toString().toLowerCase().includes(qLower)) score += 40;
      if (Array.isArray(p.tags)) {
        for (const t of p.tags) {
          if (typeof t === "string" && t.toLowerCase().includes(qLower)) score += 30;
        }
      }

      // popularity (safe defaults if fields missing)
      const sales = typeof p.sales === "number" ? p.sales : 0;
      const views = typeof p.views === "number" ? p.views : 0;
      score += sales * 3 + views * 0.2;

      return { product: p, score };
    });

    // keep those with positive score, sort by score desc, then name
    const filtered = scored
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name))
      .slice(0, 12);

    // Normalize images for all suggestions
    const normalizedSuggestions = await Promise.all(
      filtered.map(async (x) => {
        const normalizedProduct = await normalizeProductImages(x.product);
        return {
          _id: normalizedProduct._id,
          name: normalizedProduct.name,
          category: normalizedProduct.category,
          images: normalizedProduct.images || [],
          snippet: (normalizedProduct.description || "").substring(0, 120),
          score: x.score
        };
      })
    );

    console.log(`[SEARCH SUGGESTIONS] returning ${normalizedSuggestions.length} suggestions (top scores):`, normalizedSuggestions.map(s => ({ name: s.name, score: s.score })));

    res.json({ suggestions: normalizedSuggestions });
  } catch (err) {
    console.error("[SEARCH SUGGESTIONS] error:", err);
    res.status(500).json({ suggestions: [] });
  }
};
