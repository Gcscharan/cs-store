import { logger } from '../../../utils/logger';
import { Request, Response } from "express";
import { SearchService } from "../../search/services/SearchService";

const searchService = new SearchService();

export const searchProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string) || "";
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 12;
    const sortBy = (req.query.sortBy as string) || 'relevance';
    const sortOrder = (req.query.sortOrder as string) || 'desc';
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    const category = req.query.category as string;
    const rating = req.query.rating ? Number(req.query.rating) : undefined;

    // If no query provided, don't treat it as an error – just return no results
    if (!q || q.trim().length === 0) {
      res.status(200).json({
        data: [],
        total: 0,
        page,
        limit,
        message: "No search query provided; returning empty results.",
        query: ""
      });
      return;
    }

    const searchQuery = q.trim();
    logger.info(`🔍 Search request:`, { query: searchQuery });

    const result = await searchService.search({ 
      q: searchQuery,
      page,
      limit,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      minPrice,
      maxPrice,
      category,
      rating
    });

    logger.info(`📊 Search results:`, {
      query: result.query,
      hits: result.products.length,
      message: result.message
    });

    // Final result mapping to match frontend expectation (PaginatedResponse)
    res.json({
      data: result.products || [],
      total: result.total,
      page,
      limit,
      message: result.message,
      query: result.query
    });

  } catch (error) {
    logger.error("❌ Search error:", error);
    res.status(500).json({
      error: "Internal server error during search",
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
};

export const getSearchSuggestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawQ = (req.query.q as string) ?? "";
    logger.info("[SEARCH SUGGESTIONS] received q:", JSON.stringify(rawQ));

    const { suggestions } = await searchService.suggestions({ q: rawQ });

    logger.info(`[SEARCH SUGGESTIONS] returning ${suggestions.length} suggestions (top scores):`, suggestions.map(s => ({ name: s.name, score: s.score })));

    res.json({ suggestions });
  } catch (err) {
    logger.error("[SEARCH SUGGESTIONS] error:", err);
    res.status(500).json({ suggestions: [] });
  }
};
