export interface SearchOptions {
  q: string;
  page?: number;
  limit?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'relevance' | 'price' | 'newest' | 'sales' | 'rating';
  sortOrder?: 'asc' | 'desc';
  rating?: number;
}

export interface SuggestionOptions {
  q: string;
  limit?: number;
}
