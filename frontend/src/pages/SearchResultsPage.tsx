import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, ArrowLeft } from "lucide-react";
import { useSearchProductsQuery } from "../store/api";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import OptimizedImage from "../components/OptimizedImage";

const SearchResultsPage: React.FC = () => {
  const { q } = useParams();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState("relevance");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const auth = useSelector((state: RootState) => state.auth);

  // Use backend search
  const { data, isLoading, error } = useSearchProductsQuery({
    q,
    page,
    limit: 12
  }) as { data: { products: any[], total: number } | undefined, isLoading: boolean, error?: any };

  const products = data?.products || [];
  const total = data?.total || 0;
  const totalPages = data ? Math.ceil(total / 12) : 0;

  const handleProductClick = (product: any) => {
    navigate(`/product/${product._id || product.id}`);
  };

  const handleAddToCart = (product: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!auth.isAuthenticated) {
      navigate("/login");
      return;
    }
    // TODO: Implement add to cart functionality
    console.log("Add to cart:", product.name);
  };

  const handleSortChange = (newSortBy: string) => {
    setSortBy(newSortBy);
    setPage(1); // Reset to first page when sorting changes
  };

  const handleSortOrderChange = (newSortOrder: string) => {
    setSortOrder(newSortOrder);
    setPage(1); // Reset to first page when sort order changes
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo(0, 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Searching products...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Error loading search results. Please try again.</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg bg-white shadow hover:shadow-md transition-shadow"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Search Results for "{q}"
              </h1>
              <p className="text-gray-600">
                {total} products found
              </p>
            </div>
          </div>

          {/* Sort Options */}
          <div className="flex items-center space-x-4">
            <select
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="relevance">Relevance</option>
              <option value="price">Price</option>
              <option value="newest">Newest</option>
              <option value="sales">Sales</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => handleSortOrderChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>

        {/* No Results */}
        {products.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No products found for "{q}"</p>
            <p className="text-gray-500 mt-2">Try searching with different keywords</p>
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((product: any, index: number) => (
            <motion.div
              key={product._id || product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleProductClick(product)}
            >
              <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-t-lg">
                <OptimizedImage
                  image={product.images?.[0] || {
                    variants: {
                      micro: '/placeholder-product.svg',
                      thumb: '/placeholder-product.svg',
                      small: '/placeholder-product.svg',
                      medium: '/placeholder-product.svg',
                      large: '/placeholder-product.svg',
                      original: '/placeholder-product.svg'
                    }
                  }}
                  size="small"
                  alt={product.name}
                  className="w-full h-48"
                  productId={product._id || product.id}
                  debug={false}
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 truncate">
                  {product.name}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {product.category}
                </p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-blue-600">
                      ₹{product.price}
                    </p>
                    {product.mrp && product.mrp > product.price && (
                      <p className="text-sm text-gray-500 line-through">
                        ₹{product.mrp}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600">
                      {product.rating || "4.0"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleAddToCart(product, e)}
                  className="mt-3 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add to Cart
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 mt-8">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = i + 1;
              const isCurrentPage = pageNum === page;
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`px-3 py-2 rounded-lg ${
                    isCurrentPage
                      ? "bg-blue-600 text-white"
                      : "border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages}
              className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchResultsPage;
