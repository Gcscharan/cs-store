import { Product } from "../models/Product";
import { escapeRegex } from "../utils/regex";
import { normalizeProductImages } from "../domains/catalog/controllers/productController";

export interface SearchOptions {
  q: string;
  page: number;
  limit: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'relevance' | 'price' | 'newest' | 'sales';
  sortOrder?: 'asc' | 'desc';
  suggest?: boolean;
}

export interface SearchResult {
  total: number;
  page: number;
  limit: number;
  products: Array<{
    _id: string;
    name: string;
    slug?: string;
    price?: number;
    category?: string;
    images: Array<{
      publicId?: string;
      variants?: {
        micro?: string;
        thumb?: string;
        small?: string;
        medium?: string;
        large?: string;
        original?: string;
      };
      formats?: {
        avif?: string;
        webp?: string;
        jpg?: string;
      };
      metadata?: {
        width?: number;
        height?: number;
        aspectRatio?: number;
      };
    }>;
    snippet?: string;
    score?: number;
  }>;
}

export class SearchFallbackService {
  // Helper to normalize images using the same function as other endpoints
  private async normalizeImages(product: any): Promise<any[]> {
    const normalized = await normalizeProductImages(product);
    return normalized.images || [];
  }

  // Create snippet from description
  private createSnippet(description: string, query: string, maxLength: number = 150): string {
    if (!description) return '';
    
    const queryLower = query.toLowerCase();
    const descLower = description.toLowerCase();
    const queryIndex = descLower.indexOf(queryLower);
    
    if (queryIndex === -1) {
      return description.length > maxLength ? description.substring(0, maxLength) + '...' : description;
    }
    
    const start = Math.max(0, queryIndex - 30);
    const end = Math.min(description.length, queryIndex + query.length + 30);
    let snippet = description.substring(start, end);
    
    if (start > 0) snippet = '...' + snippet;
    if (end < description.length) snippet = snippet + '...';
    
    return snippet;
  }

  async searchProducts(options: SearchOptions): Promise<SearchResult> {
    const {
      q,
      page = 1,
      limit = 12,
      category,
      minPrice,
      maxPrice,
      sortBy = 'relevance',
      sortOrder = 'desc',
      suggest = false
    } = options;

    // Validate inputs
    if (!q || q.trim().length === 0) {
      return {
        total: 0,
        page: 1,
        limit,
        products: []
      };
    }

    const searchQuery = q.trim();
    const escapedQuery = escapeRegex(searchQuery);
    const skip = (page - 1) * limit;

    try {
      // Build match stages
      const matchStages: any[] = [];

      // Text search stage (if text index exists)
      const textMatch: any = {};
      if (searchQuery) {
        textMatch.$text = { $search: searchQuery };
      }
      
      // Category filter
      if (category) {
        textMatch.category = category;
      }
      
      // Price range filter
      if (minPrice !== undefined || maxPrice !== undefined) {
        textMatch.price = {};
        if (minPrice !== undefined) textMatch.price.$gte = minPrice;
        if (maxPrice !== undefined) textMatch.price.$lte = maxPrice;
      }

      if (Object.keys(textMatch).length > 0) {
        matchStages.push({ $match: textMatch });
      }

      // Add scoring stage
      const addFieldsStage: any = {
        $addFields: {
          // Text score (if available)
          textScore: { $ifNull: [{ $meta: "textScore" }, 0] },
          
          // Regex-based scoring for name matching
          nameLower: { $toLower: "$name" },
          queryLower: searchQuery.toLowerCase(),
          
          // Popularity score: (sales * 2) + (views * 0.2)
          popularity: {
            $add: [
              { $multiply: [{ $ifNull: ["$sales", 0] }, 2] },
              { $multiply: [{ $ifNull: ["$views", 0] }, 0.2] }
            ]
          }
        }
      };

      // Add regex-based scoring
      addFieldsStage.$addFields.isPrefix = {
        $cond: [
          { $eq: [{ $strLenCP: searchQuery }, { $strLenCP: { $substrCP: ["$name", 0, { $strLenCP: searchQuery }] } }] },
          { $eq: [{ $substrCP: ["$name", 0, { $strLenCP: searchQuery }] }, searchQuery.toLowerCase()] },
          false
        ]
      };

      addFieldsStage.$addFields.isWordPrefix = {
        $cond: [
          { $regexMatch: { input: "$name", regex: new RegExp('\\b' + escapedQuery, 'i') } },
          true,
          false
        ]
      };

      addFieldsStage.$addFields.isSubstring = {
        $cond: [
          { $regexMatch: { input: "$name", regex: new RegExp(escapedQuery, 'i') } },
          true,
          false
        ]
      };

      // Calculate final score: prefix > wordPrefix > substring
      addFieldsStage.$addFields.score = {
        $add: [
          { $multiply: ["$textScore", 10] },
          { $multiply: ["$isPrefix", 100] },
          { $multiply: ["$isWordPrefix", 50] },
          { $multiply: ["$isSubstring", 10] },
          "$popularity"
        ]
      };

      const pipeline: any[] = [
        ...matchStages,
        addFieldsStage
      ];

      // Sort stage: score DESC
      const sortStage: any = {};
      if (sortBy === 'relevance' && searchQuery) {
        sortStage.score = sortOrder === 'asc' ? 1 : -1;
      } else if (sortBy === 'price') {
        sortStage.price = sortOrder === 'asc' ? 1 : -1;
      } else if (sortBy === 'newest') {
        sortStage.createdAt = sortOrder === 'asc' ? 1 : -1;
      } else if (sortBy === 'sales') {
        sortStage.sales = sortOrder === 'asc' ? 1 : -1;
      } else {
        // Default: sort by score desc, then createdAt desc
        sortStage.score = -1;
        sortStage.createdAt = -1;
      }
      
      pipeline.push({ $sort: sortStage });

      // Facet stage to get both total count and paginated results
      pipeline.push({
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                name: 1,
                slug: 1,
                price: 1,
                category: 1,
                images: 1,
                stock: 1,
                description: 1,
                score: 1,
                sales: 1,
                views: 1,
                createdAt: 1
              }
            }
          ]
        }
      });

      // Execute aggregation
      const [result] = await Product.aggregate(pipeline);
      
      const total = result.metadata?.[0]?.total || 0;
      let products = result.data || [];

      // Transform products to consistent format
      products = await Promise.all(products.map(async (product: any) => ({
        _id: product._id,
        name: product.name || "Unknown Product",
        slug: product.slug,
        price: product.price || 0,
        category: product.category || "Products",
        images: await this.normalizeImages(product),
        stock: typeof product.stock === "number" ? product.stock : 0,
        snippet: suggest ? undefined : this.createSnippet(product.description, searchQuery),
        score: product.score
      })));

      // For suggestions, limit to 8 and minimal fields
      if (suggest) {
        products = products.slice(0, 8).map((product: any) => ({
          _id: product._id,
          name: product.name,
          category: product.category,
          price: product.price,
          images: product.images,
          stock: product.stock,
          score: product.score
        }));
      }

      return {
        total,
        page,
        limit,
        products
      };

    } catch (error) {
      console.error('Search error:', error);
      // Fallback to simple regex search
      return this.fallbackRegexSearch(options);
    }
  }

  // Fallback simple regex search if aggregation fails
  private async fallbackRegexSearch(options: SearchOptions): Promise<SearchResult> {
    const { q, page = 1, limit = 12, suggest = false } = options;
    const searchQuery = q.trim();
    const escapedQuery = escapeRegex(searchQuery);
    const skip = (page - 1) * limit;

    const products = await Product.find({
      name: { $regex: escapedQuery, $options: "i" }
    })
      .select("_id name slug price category images description sales views createdAt stock")
      .sort({ sales: -1, views: -1, createdAt: -1 })
      .skip(skip)
      .limit(suggest ? 8 : limit)
      .lean()
      .exec();

    const total = await Product.countDocuments({
      name: { $regex: escapedQuery, $options: "i" }
    });

    const transformedProducts = await Promise.all(products.map(async (product: any) => ({
      _id: product._id,
      name: product.name || "Unknown Product",
      slug: product.slug,
      price: product.price || 0,
      category: product.category || "Products",
      images: await this.normalizeImages(product),
      stock: typeof product.stock === "number" ? product.stock : 0,
      snippet: suggest ? undefined : this.createSnippet(product.description, searchQuery)
    })));

    return {
      total,
      page,
      limit,
      products: transformedProducts
    };
  }
}
