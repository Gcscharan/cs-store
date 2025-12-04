import React, { useState } from "react";
import { useGetProductsQuery } from "../store/api";
import ProductCard from "../components/ProductCard";
import ProductFilters from "../components/ProductFilters";
import SortingDropdown, { SortOption } from "../components/SortingDropdown";
import SkeletonLoader from "../components/SkeletonLoader";
import { motion } from "framer-motion";

const ProductsPage: React.FC = () => {
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filters, setFilters] = useState({
    category: "",
    minPrice: "",
    maxPrice: "",
    search: "",
    sortBy: "createdAt",
    sortOrder: "desc",
  });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: productsData, error, isLoading, refetch } = useGetProductsQuery({
  search: filters.search || "",
  category: filters.category || "",
  sortBy: filters.sortBy || "createdAt",
  minPrice: filters.minPrice || "",
  maxPrice: filters.maxPrice || "",
  page: 1,
  limit: 100,
});

  const products = productsData?.products || [];

  const handleFiltersChange = (newFilters: any) => {
    setFilters(newFilters);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center py-12">
            <div className="text-red-500 text-lg font-medium mb-4">
              Failed to load products
            </div>
            <p className="text-gray-600 mb-6">
              There was an error loading the products. Please try again.
            </p>
            <button
              onClick={() => refetch()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Products</h1>
          <p className="text-gray-600">Discover our wide range of products</p>
        </div>

        {/* Filters and Search */}
        <div className="mb-8">
          <ProductFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />
        </div>

        {/* Results Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="mb-4 sm:mb-0">
            <p className="text-sm text-gray-600">
              {isLoading ? "Loading..." : `${products.length} products found`}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <SortingDropdown
              currentSort={sortBy}
              onSortChange={setSortBy}
            />
            <div className="flex border border-gray-300 rounded-lg">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${
                  viewMode === "grid"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${
                  viewMode === "list"
                    ? "bg-blue-600 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Products Grid/List */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => (
              <SkeletonLoader key={index} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📦</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No products found
            </h3>
            <p className="text-gray-600 mb-6">
              {filters.search ||
              filters.category ||
              filters.minPrice ||
              filters.maxPrice
                ? "Try adjusting your search or filter criteria."
                : "No products are available at the moment."}
            </p>
            {(filters.search ||
              filters.category ||
              filters.minPrice ||
              filters.maxPrice) && (
              <button
                onClick={() => {
                  setFilters({
                    category: "",
                    minPrice: "",
                    maxPrice: "",
                    search: "",
                    sortBy: "createdAt",
                    sortOrder: "desc",
                  });
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
            }
          >
            {products.map((product: any) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
