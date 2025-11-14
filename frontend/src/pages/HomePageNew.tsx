import { motion } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { ShoppingCart, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import SortingDropdown, { SortOption } from "../components/SortingDropdown";
import TopSellingSlider from "../components/TopSellingSlider";
import { useGetProductsQuery } from "../store/api";

const HomePage = () => {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("price_low_high");
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Fetch products from API
  const {
    data: productsData,
    isLoading,
    error,
  } = useGetProductsQuery({
    limit: 100, // Get all products
  });

  // Listen for search updates from the layout
  useEffect(() => {
    const handleSearchUpdate = (query: string) => {
      setSearchQuery(query);
    };

    // Store the update function globally for Layout to use
    (window as any).searchQueryUpdate = handleSearchUpdate;

    return () => {
      delete (window as any).searchQueryUpdate;
    };
  }, []);

  // Process products from API
  const products = productsData?.products || [];

  // Group products by category
  const productData = {
    chocolates: products.filter((p) => p.category === "chocolates"),
    biscuits: products.filter((p) => p.category === "biscuits"),
    ladoos: products.filter((p) => p.category === "ladoos"),
    cakes: products.filter((p) => p.category === "cakes"),
    hot_snacks: products.filter((p) => p.category === "hot_snacks"),
  };

  // Top-selling products data (dynamically updated based on customer interests)
  // Use real products from API, fallback to empty array if no products
  const topSellingProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    // Get a random selection of products for top selling
    const shuffled = [...products].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 8).map((product) => ({
      id: product._id || product.id,
      name: product.name,
      image:
        product.image ||
        product.images?.[0] ||
        "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlN2ViIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5Y2EzYWYiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+",
      category: product.category,
    }));
  }, [products]);

  // Categories for the slider
  const categories = [
    {
      id: "all",
      name: t("home.for_you"),
      icon: "🌟",
      color: "from-purple-500 to-pink-500",
    },
    {
      id: "chocolates",
      name: t("home.chocolates"),
      icon: "🍫",
      color: "from-yellow-500 to-orange-500",
    },
    {
      id: "biscuits",
      name: t("home.biscuits"),
      icon: "🍪",
      color: "from-amber-500 to-yellow-500",
    },
    {
      id: "ladoos",
      name: t("home.ladoos"),
      icon: "🥮",
      color: "from-orange-500 to-red-500",
    },
    {
      id: "cakes",
      name: t("home.cakes"),
      icon: "🎂",
      color: "from-pink-500 to-purple-500",
    },
    {
      id: "hot_snacks",
      name: t("home.hot_snacks"),
      icon: "🌶️",
      color: "from-red-500 to-orange-500",
    },
  ];

  // Filter products based on selected category and search query
  const filteredProducts = useMemo(() => {
    let productsToShow = [];

    if (selectedCategory === "all") {
      // Show all products from all categories
      productsToShow = [
        ...productData.chocolates,
        ...productData.biscuits,
        ...productData.ladoos,
        ...productData.cakes,
        ...productData.hot_snacks,
      ];
    } else {
      productsToShow =
        productData[selectedCategory as keyof typeof productData] || [];
    }

    // Apply search filter
    if (searchQuery) {
      productsToShow = productsToShow.filter((product) =>
        product.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    switch (sortBy) {
      case "price_low_high":
        return productsToShow.sort((a, b) => a.price - b.price);
      case "price_high_low":
        return productsToShow.sort((a, b) => b.price - a.price);
      case "popularity":
        return productsToShow.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case "newest":
        return productsToShow.sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() -
            new Date(a.createdAt || 0).getTime()
        );
      case "best_selling":
        return productsToShow.sort((a, b) => (b.sales || 0) - (a.sales || 0));
      default:
        return productsToShow;
    }
  }, [selectedCategory, searchQuery, sortBy, productData]);

  // Add to cart functionality
  const handleAddToCart = (product: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to product detail
    console.log("Added to cart:", product);
  };

  const handleProductClick = (product: any) => {
    navigate(`/product/${product._id || product.id}`);
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">
            Failed to load products. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Selling Products Slider */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-orange-50 to-red-50 py-6 px-4 shadow-sm"
      >
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">
                Loading top selling products...
              </p>
            </div>
          ) : topSellingProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600">
                No products available at the moment.
              </p>
            </div>
          ) : (
            <TopSellingSlider products={topSellingProducts} />
          )}
        </div>
      </motion.div>

      {/* Category Slider */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white py-6 px-4 shadow-sm"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex space-x-4 overflow-x-auto pb-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex-shrink-0 flex flex-col items-center p-4 rounded-xl transition-all duration-300 ${
                  selectedCategory === category.id
                    ? `bg-gradient-to-r ${category.color} text-white shadow-lg`
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span className="text-2xl mb-2">{category.icon}</span>
                <span className="text-sm font-medium">{category.name}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Products Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="py-8 px-4"
      >
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedCategory === "all"
                  ? t("home.for_you")
                  : categories.find((c) => c.id === selectedCategory)?.name}
              </h2>
              <p className="text-gray-600 mt-1">
                {filteredProducts.length} products available
              </p>
            </div>

            {/* Sorting Dropdown */}
            <div className="mt-4 sm:mt-0">
              <SortingDropdown currentSort={sortBy} onSortChange={setSortBy} />
            </div>
          </div>

          {/* Products Grid */}
          <div
            className={`grid gap-6 ${
              selectedCategory === "all"
                ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            }`}
          >
            {filteredProducts.map((product) => (
              <motion.div
                key={product._id || product.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                whileHover={{ scale: 1.05, y: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleProductClick(product)}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleProductClick(product);
                  }
                }}
              >
                {/* Product Image */}
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={
                      product.images?.[0] ||
                      product.image ||
                      "https://dummyimage.com/400x400/cccccc/666666&text=No+Image"
                    }
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Price Badge */}
                  <div className="absolute top-2 right-2">
                    <div className="bg-white/90 backdrop-blur-sm text-gray-900 px-2 py-1 rounded-full text-xs font-bold shadow-lg">
                      ₹{product.price}
                    </div>
                  </div>
                </div>

                {/* Product Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {product.name}
                  </h3>

                  {/* Price and MRP */}
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-lg font-bold text-gray-900">
                      ₹{product.price}
                    </span>
                    {product.mrp && product.mrp > product.price && (
                      <>
                        <span className="text-sm text-gray-500 line-through">
                          ₹{product.mrp}
                        </span>
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">
                          Save ₹{product.mrp - product.price}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    onClick={(e) => handleAddToCart(product, e)}
                    className="w-full mt-3 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {/* End of Products Message */}
          {filteredProducts.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="text-center mt-8 py-4"
            >
              <p className="text-gray-500 text-sm">
                {t("home.end_of_products")}
              </p>
            </motion.div>
          )}

          {/* No Products Message */}
          {filteredProducts.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center py-12"
            >
              <div className="text-gray-400 text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No products found
              </h3>
              <p className="text-gray-600">
                {searchQuery
                  ? `No products match "${searchQuery}"`
                  : "No products available in this category"}
              </p>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage;
