export interface SearchOptions {
  q: string;
  page?: number;
  limit?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'relevance' | 'price' | 'newest' | 'sales';
  sortOrder?: 'asc' | 'desc';
}

export interface SuggestionOptions {
  q: string;
  limit?: number;
}
