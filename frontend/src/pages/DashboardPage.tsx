import { motion } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { Star } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useGetProductsQuery } from "../store/api";
import { useAddToCartMutation } from "../store/api";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { addToCart, setCart } from "../store/slices/cartSlice";
import { useToast } from "../components/AccessibleToast";
import { getProductImage, handleImageError } from "../utils/image";
import SkeletonCard from "../components/SkeletonCard";
import { useCartFeedback } from "../contexts/CartFeedbackContext";
import { useTokenRefresh } from "../hooks/useTokenRefresh";

const DashboardPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState("price_low_high");

  console.log("🔍 DashboardPage rendering - Auth state:", {
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    hasTokens: !!(auth.tokens.accessToken && auth.tokens.refreshToken),
  });
  const [addToCartMutation] = useAddToCartMutation();
  const { success, error: showError } = useToast();
  const { refreshToken } = useTokenRefresh();
  
  // Cart feedback
  const { triggerGlobalConfirmation } = useCartFeedback();

  // Cart persistence is handled by CartInitializer component

  // Validate authentication state on component mount
  useEffect(() => {
    const validateAuth = async () => {
      if (auth.isAuthenticated && auth.tokens?.accessToken) {
        try {
          const payload = JSON.parse(
            atob(auth.tokens.accessToken.split(".")[1])
          );
          const currentTime = Math.floor(Date.now() / 1000);
          if (payload.exp < currentTime) {
            // Token is expired, try to refresh it
            console.log("🔑 Access token expired, attempting to refresh...");
            const refreshSuccess = await refreshToken();
            if (!refreshSuccess) {
              console.log("🔑 Token refresh failed, user will be logged out");
            }
          }
        } catch (error) {
          // Invalid token, try to refresh it
          console.log("🔑 Invalid token format, attempting to refresh...");
          const refreshSuccess = await refreshToken();
          if (!refreshSuccess) {
            console.log("🔑 Token refresh failed, user will be logged out");
          }
        }
      }
    };

    validateAuth();
  }, [auth.isAuthenticated, auth.tokens?.accessToken, dispatch, refreshToken]);

  // Fetch products from API
  const {
    data: productsData,
    isLoading,
    error,
    refetch,
  } = useGetProductsQuery({
    limit: 100, // Get all products
  });

  // All Products - Show all products instead of just top selling
  const allProducts = useMemo(() => {
    if (!productsData?.products || productsData.products.length === 0)
      return [];

    // Filter products based on selected category
    let productsToShow = productsData.products;
    if (selectedCategory !== "all") {
      productsToShow = productsData.products.filter(
        (p: any) => p.category === selectedCategory
      );
    }

    // Shuffle products for random order on every refresh
    productsToShow = [...productsToShow].sort(() => Math.random() - 0.5);

    // Sort products
    const sortedProducts = [...productsToShow].sort((a: any, b: any) => {
      switch (sortBy) {
        case "price_low_high":
          return a.price - b.price;
        case "price_high_low":
          return b.price - a.price;
        case "name_a_z":
          return a.name.localeCompare(b.name);
        case "name_z_a":
          return b.name.localeCompare(a.name);
        case "newest":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "oldest":
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        default:
          return 0;
      }
    });

    // Map products to include mrp and discount calculation
    return sortedProducts.map((product: any) => ({
      ...product,
      mrp: product.mrp || 0,
      discount: product.mrp && product.mrp > product.price
        ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
        : 0,
    }));
  }, [productsData?.products, selectedCategory, sortBy]);

  // Categories for filtering
  const categories = [
    { id: "all", name: "For You" },
    { id: "chocolates", name: "Chocolates" },
    { id: "biscuits", name: "Biscuits" },
    { id: "ladoos", name: "Ladoos" },
    { id: "cakes", name: "Cakes" },
    { id: "hot_snacks", name: "Hot Snacks" },
  ];

  // Refresh data when page becomes visible (handles cache invalidation)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refetch();
      }
    };

    // Also refresh when the page loads (for admin updates)
    const handlePageLoad = () => {
      refetch();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handlePageLoad);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handlePageLoad);
    };
  }, [refetch]);

  // Add to cart functionality
  const handleAddToCart = async (product: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation to product detail

    // Check if user is authenticated
    if (!auth.isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      // Add to Redux store immediately for UI feedback
      dispatch(
        addToCart({
          id: product._id || product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
          image: getProductImage(product),
        })
      );

      // Call backend API
      const result = await addToCartMutation({
        productId: product._id || product.id,
        quantity: 1,
      });

      if (result && "data" in result && result.data) {
        dispatch(
          setCart({
            items: result.data.cart.items,
            total: result.data.cart.total,
            itemCount: result.data.cart.itemCount,
          })
        );
      }

      // Trigger global cart confirmation bar
      const productImage = getProductImage(product);
      const updatedCartCount = result && "data" in result && result.data ? result.data.cart.itemCount : 1;
      const updatedCartTotal = result && "data" in result && result.data ? result.data.cart.total : product.price;
      triggerGlobalConfirmation(product.name, productImage, updatedCartCount, updatedCartTotal);

      // Show success toast
      success("Added to Cart", `${product.name} has been added to your cart.`);
    } catch (error) {
      console.error("Error adding to cart:", error);
      showError("Failed to add to cart", "Please try again.");
    }
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
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Error Loading Products
          </h2>
          <p className="text-gray-600 mb-4">
            {error && "message" in error
              ? (error as any).message
              : "Something went wrong while loading products."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* SEO Content - Hidden but accessible to search engines */}
      <div className="sr-only">
        <h1>CS Store - Online Shopping for Electronics, Fashion & More</h1>
        <h2>Welcome to CS Store</h2>
        <p>
          CS Store is your one-stop destination for online shopping. Discover
          amazing deals on electronics, fashion, home & garden, and more. We
          offer fast delivery, secure payments, and excellent customer service.
        </p>
        <h3>Shop by Category</h3>
        <ul>
          <li>Electronics - Latest smartphones, laptops, gadgets and more</li>
          <li>
            Fashion - Trendy clothing, shoes, accessories for men and women
          </li>
        </ul>
      </div>

      {/* All Products Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="py-8 px-4 bg-white"
      >
        <div className="max-w-7xl mx-auto">
          {/* Category Filter and Sort - Top Left */}
          <div className="flex flex-wrap items-center justify-between mb-8">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-4">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? "bg-blue-600 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Sort by:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="price_low_high">Price: Low to High</option>
                <option value="price_high_low">Price: High to Low</option>
                <option value="name_a_z">Name: A to Z</option>
                <option value="name_z_a">Name: Z to A</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : allProducts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {allProducts.map((product: any) => (
                <motion.div
                  key={product._id || product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  onClick={() =>
                    navigate(`/product/${product._id || product.id}`)
                  }
                  className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group cursor-pointer"
                >
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={getProductImage(product)}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => handleImageError(e)}
                    />
                    {product.mrp && product.mrp > product.price && (
                      <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                        {Math.round(((product.mrp - product.price) / product.mrp) * 100)}% OFF
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-10 group-hover:bg-opacity-0 transition-opacity duration-300"></div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1 truncate">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-2">
                      {product.category}
                    </p>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-gray-900">
                          ₹{product.price.toFixed(2)}
                        </span>
                        {product.mrp && product.mrp > product.price && (
                          <span className="text-sm text-gray-500 line-through">
                            ₹{product.mrp.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-yellow-500">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="ml-1 text-sm text-gray-600">4.5</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!auth.isAuthenticated) {
                          navigate("/login");
                          return;
                        }
                        handleAddToCart(product, e);
                      }}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded-lg transition-colors duration-300 font-semibold"
                    >
                      Add to Cart
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">📦</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Products Found
              </h3>
              <p className="text-gray-600 mb-6">
                {selectedCategory !== "all"
                  ? "Try adjusting your filter criteria."
                  : "No products are available at the moment."}
              </p>
              {selectedCategory !== "all" && (
                <button
                  onClick={() => setSelectedCategory("all")}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Footer Section */}
      <footer className="bg-gray-900 text-white mt-16">
        {/* Upper Footer Section */}
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* ABOUT */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-orange-400">
                ABOUT
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/contact-us"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link
                    to="/about-us"
                    className="hover:text-orange-400 transition-colors"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    to="/careers"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Careers
                  </Link>
                </li>
                <li>
                  <Link
                    to="/cs-store-stories"
                    className="hover:text-orange-400 transition-colors"
                  >
                    CS Store Stories
                  </Link>
                </li>
                <li>
                  <Link
                    to="/corporate-information"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Corporate Information
                  </Link>
                </li>
              </ul>
            </div>

            {/* HELP */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-orange-400">
                HELP
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/payment"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Payments
                  </Link>
                </li>
                <li>
                  <Link
                    to="/shipping"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Shipping
                  </Link>
                </li>
                <li>
                  <Link
                    to="/cancellation"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Cancellation & Returns
                  </Link>
                </li>
                <li>
                  <Link
                    to="/faq"
                    className="hover:text-orange-400 transition-colors"
                  >
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link
                    to="/report-infringement"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Report Infringement
                  </Link>
                </li>
              </ul>
            </div>

            {/* CONSUMER POLICY */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-orange-400">
                CONSUMER POLICY
              </h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Terms Of Use
                  </Link>
                </li>
                <li>
                  <Link
                    to="/security"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Security
                  </Link>
                </li>
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/sitemap"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Sitemap
                  </Link>
                </li>
                <li>
                  <Link
                    to="/grievance"
                    className="hover:text-orange-400 transition-colors"
                  >
                    Grievance Redressal
                  </Link>
                </li>
              </ul>
            </div>

            {/* Mail Us & Registered Office */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-orange-400">
                Mail Us:
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                CS Store Internet Private Limited,
                <br />
                Buildings Alyssa, Begonia & Clove Embassy Tech Village,
                <br />
                Outer Ring Road, Devarabeesanahalli Village,
                <br />
                Bengaluru, 560103,
                <br />
                Karnataka, India
              </p>

              <h3 className="text-lg font-semibold mb-4 text-orange-400">
                Registered Office Address:
              </h3>
              <p className="text-sm text-gray-400">
                CS Store Internet Private Limited,
                <br />
                Buildings Alyssa, Begonia & Clove Embassy Tech Village,
                <br />
                Outer Ring Road, Devarabeesanahalli Village,
                <br />
                Bengaluru, 560103,
                <br />
                Karnataka, India
                <br />
                CIN : U51109KA2012PTC066107
                <br />
                Telephone:{" "}
                <a href="tel:044-45614700" className="hover:text-orange-400">
                  044-45614700
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Lower Footer Section */}
        <div className="border-t border-gray-700 mt-8 pt-8 pb-4">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
            <div className="flex space-x-6 mb-4 md:mb-0">
              <Link to="/seller" className="hover:text-orange-400">
                Become a Seller
              </Link>
              <Link to="/advertise" className="hover:text-orange-400">
                Advertise
              </Link>
              <Link to="/gift-cards" className="hover:text-orange-400">
                Gift Cards
              </Link>
              <Link to="/help" className="hover:text-orange-400">
                Help Center
              </Link>
            </div>
            <div className="mb-4 md:mb-0">© 2023-2024 CS Store.com</div>
            <div>
              <div className="text-sm text-gray-400">
                Secure Payments Available
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DashboardPage;
