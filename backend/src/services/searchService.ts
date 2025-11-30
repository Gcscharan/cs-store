/**
 * searchService.ts
 * MongoDB-based search only. Algolia is disabled.
 */

export const searchProducts = async (query: string) => {
  return {
    hits: [],
    query,
    message: "Search disabled: Algolia not configured.",
  };
};

export default {
  searchProducts,
};
