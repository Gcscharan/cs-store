import { motion } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { Star } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import TopSellingSlider from "../components/TopSellingSlider";
import { useGetProductsQuery, useAddToCartMutation } from "../store/api";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { addToCart, setCart } from "../store/slices/cartSlice";
import { useToast } from "../components/AccessibleToast";
import { useOtpModal } from "../contexts/OtpModalContext";
import { useTokenRefresh } from "../hooks/useTokenRefresh";
import { getGradientPlaceholder } from '../utils/mockImages';
import OptimizedImage from "../components/OptimizedImage";

const HomePage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);
  const [selectedGuestCategory, setSelectedGuestCategory] = useState("all");

  console.log("🔍 HomePage rendering - Auth state:", {
    isAuthenticated: auth.isAuthenticated,
    user: auth.user,
    hasTokens: !!(auth.tokens.accessToken && auth.tokens.refreshToken),
  });

  // Fetch products from API
  const {
    data: productsData,
    isLoading,
    error,
    refetch,
  } = useGetProductsQuery({
    limit: 100, // Get all products
  });

  // Debug logging for products data
  useEffect(() => {
    console.log("[HomePage] productsData loaded:", productsData?.products?.length, "products");
    if (productsData?.products?.length > 0) {
      const firstProduct = productsData.products[0];
      console.log("[HomePage] first product sample:", firstProduct);
      console.log("[HomePage] first product images structure:", firstProduct.images);
      if (firstProduct.images && firstProduct.images.length > 0) {
        const firstImage = firstProduct.images[0];
        console.log("[HomePage] first image object:", firstImage);
        console.log("[HomePage] first image keys:", Object.keys(firstImage || {}));
        console.log("[HomePage] has variants:", 'variants' in firstImage);
        console.log("[HomePage] has formats:", 'formats' in firstImage);
        console.log("[HomePage] has metadata:", 'metadata' in firstImage);
        if (firstImage.variants) {
          console.log("[HomePage] variants keys:", Object.keys(firstImage.variants));
          console.log("[HomePage] variants.small:", firstImage.variants.small);
        }
        if (firstImage.formats) {
          console.log("[HomePage] formats keys:", Object.keys(firstImage.formats));
          console.log("[HomePage] formats.avif:", firstImage.formats.avif);
        }
        if (firstImage.metadata) {
          console.log("[HomePage] metadata keys:", Object.keys(firstImage.metadata));
          console.log("[HomePage] metadata.aspectRatio:", firstImage.metadata.aspectRatio);
        }
      }
    }
  }, [productsData]);
  const [addToCartMutation] = useAddToCartMutation();
  const { success, error: showError } = useToast();
  const { showOtpModal } = useOtpModal();
  const { refreshToken } = useTokenRefresh();

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

  // Check for login query parameter and show login modal
  useEffect(() => {
    // Don't show modal if user is already authenticated
    if (auth.isAuthenticated) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const showLogin = urlParams.get("showLogin");

    if (showLogin === "true") {
      // Show the login modal only if user is not authenticated
      showOtpModal("/account/profile");

      // Clean up the URL by removing the query parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, [showOtpModal, auth.isAuthenticated]);

  // Top Selling Products
  const topSellingProducts = useMemo(() => {
    if (!productsData?.products || productsData.products.length === 0)
      return [];

    const shuffled = [...productsData.products].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 8).map((product: any) => ({
      _id: product._id || product.id,
      id: product._id || product.id,
      name: product.name,
      image: product.images?.[0]?.variants?.small || product.images?.[0]?.variants?.thumb || product.images?.[0]?.thumb || product.images?.[0]?.full || '/placeholder-product.svg',
      category: product.category,
    }));
  }, [productsData?.products]);

  // Top Deals Products
  const topDealsProducts = useMemo(() => {
    if (!productsData?.products || productsData.products.length === 0)
      return [];

    const shuffled = [...productsData.products].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 6).map((product: any) => ({
      id: product._id || product.id,
      name: product.name,
      image: product.images?.[0]?.variants?.small || product.images?.[0]?.variants?.thumb || product.images?.[0]?.thumb || product.images?.[0]?.full || '/placeholder-product.svg',
      category: product.category,
      price: product.price,
      mrp: product.mrp || product.price * 1.2, // Add 20% markup for MRP if not available
      discountedPrice: product.price,
      originalPrice: product.mrp ? product.mrp : product.price * 1.2,
      discount: product.mrp
        ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
        : 20,
    }));
  }, [productsData?.products]);

  // Featured Products
  const featuredProducts = useMemo(() => {
    if (!productsData?.products || productsData.products.length === 0)
      return [];
    return productsData.products.slice(0, 12).map((product: any) => ({
      ...product,
      _id: product._id || product.id,
      id: product._id || product.id,
      mrp: product.mrp || 0,
      discount: product.mrp && product.mrp > product.price
        ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
        : 0,
    }));
  }, [productsData?.products]);

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

  // Handle category click for guest users
  const handleGuestCategoryClick = (category: string) => {
    setSelectedGuestCategory(category);
  };

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
          image: product.images?.[0]?.variants?.small || product.images?.[0]?.variants?.thumb || product.images?.[0]?.thumb || product.images?.[0]?.full || '/placeholder-product.svg',
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

      {/* Top Selling Products Slider */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-secondary-50 via-orange-50 to-yellow-50 py-8 px-4 shadow-flipkart relative overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-orange-200 to-red-200 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-pink-200 to-orange-200 rounded-full blur-2xl"></div>
        </div>
        <div className="max-w-7xl mx-auto">
          <TopSellingSlider products={topSellingProducts} />
        </div>
      </motion.div>

      {/* Category Grid - Only show when user is not logged in */}
      {!auth.isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-white py-8 px-4"
        >
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              Browse Categories
            </h2>
            <div className="grid grid-cols-3 gap-8 max-w-7xl mx-auto">
              {/* Chocolates */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleGuestCategoryClick("chocolates")}
                className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                  selectedGuestCategory === "chocolates"
                    ? "ring-4 ring-orange-300"
                    : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
                <div className="relative z-10">
                  <div className="text-base opacity-90 mb-3">
                    Premium chocolates & more
                  </div>
                  <div className="text-2xl font-bold mb-3">Chocolates</div>
                  <div className="text-lg opacity-90">From ₹99</div>
                </div>
                <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                  🍫
                </div>
              </motion.button>

              {/* Biscuits */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleGuestCategoryClick("biscuits")}
                className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                  selectedGuestCategory === "biscuits"
                    ? "ring-4 ring-orange-300"
                    : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
                <div className="relative z-10">
                  <div className="text-base opacity-90 mb-3">
                    Crunchy & crispy
                  </div>
                  <div className="text-2xl font-bold mb-3">Biscuits</div>
                  <div className="text-lg opacity-90">From ₹49</div>
                </div>
                <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                  🍪
                </div>
              </motion.button>

              {/* Ladoos */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleGuestCategoryClick("ladoos")}
                className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                  selectedGuestCategory === "ladoos"
                    ? "ring-4 ring-orange-300"
                    : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
                <div className="relative z-10">
                  <div className="text-base opacity-90 mb-3">
                    Traditional sweets
                  </div>
                  <div className="text-2xl font-bold mb-3">Festive Ladoos</div>
                  <div className="text-lg opacity-90">From ₹199</div>
                </div>
                <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                  🥮
                </div>
              </motion.button>

              {/* Cakes */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleGuestCategoryClick("cakes")}
                className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                  selectedGuestCategory === "cakes"
                    ? "ring-4 ring-orange-300"
                    : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
                <div className="relative z-10">
                  <div className="text-base opacity-90 mb-3">
                    Fresh baked daily
                  </div>
                  <div className="text-2xl font-bold mb-3">Birthday Cakes</div>
                  <div className="text-lg opacity-90">From ₹299</div>
                </div>
                <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                  🎂
                </div>
              </motion.button>

              {/* Hot Snacks */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleGuestCategoryClick("hot_snacks")}
                className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                  selectedGuestCategory === "hot_snacks"
                    ? "ring-4 ring-orange-300"
                    : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
                <div className="relative z-10">
                  <div className="text-base opacity-90 mb-3">Spicy & tangy</div>
                  <div className="text-2xl font-bold mb-3">Hot Snacks</div>
                  <div className="text-lg opacity-90">From ₹99</div>
                </div>
                <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                  🌶️
                </div>
              </motion.button>

              {/* Beverages */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleGuestCategoryClick("beverages")}
                className={`relative bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-8 text-white overflow-hidden group min-h-[200px] ${
                  selectedGuestCategory === "beverages"
                    ? "ring-4 ring-orange-300"
                    : ""
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-orange-400/20 to-red-500/20"></div>
                <div className="relative z-10">
                  <div className="text-base opacity-90 mb-3">
                    Refreshing drinks
                  </div>
                  <div className="text-2xl font-bold mb-3">Beverages</div>
                  <div className="text-lg opacity-90">From ₹29</div>
                </div>
                <div className="absolute -bottom-4 -right-4 text-8xl opacity-20 group-hover:opacity-30 transition-opacity">
                  🥤
                </div>
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Featured Products Section - Only show when user is not logged in */}
      {!auth.isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gray-50 py-8 px-4"
        >
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
              Featured Products
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {featuredProducts.map((product: any) => {
                return (
                  <motion.div
                    key={product._id || product.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden group cursor-pointer"
                    onClick={() =>
                      navigate(`/product/${product._id || product.id}`)
                    }
                  >
                    <div className="relative h-48 overflow-hidden">
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
                        className="w-full h-full group-hover:scale-105 transition-transform duration-300"
                        productId={product._id || product.id}
                        debug={false}
                      />
                      {product.discount > 0 && (
                        <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
                          {product.discount}% OFF
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
                          <span className="ml-1 text-sm text-gray-600">
                            4.5
                          </span>
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
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Top Deals Section - Only show when user is not logged in */}
      {!auth.isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="bg-gradient-to-r from-red-50 via-orange-50 to-yellow-50 py-8 px-4 shadow-lg relative overflow-hidden"
        >
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-red-200 to-orange-200 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-yellow-200 to-red-200 rounded-full blur-2xl"></div>
          </div>

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                🔥 Top Deals
              </h2>
              <p className="text-lg text-gray-600">
                Limited time offers - Don't miss out!
              </p>
            </div>

            {/* Top Deals Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {topDealsProducts.map((product: any, index: number) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-white rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 overflow-hidden group cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <div className="relative h-56 overflow-hidden">
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
                      className="w-full h-full"
                      productId={product.id}
                      debug={false}
                    />
                    {product.discount > 0 && (
                      <span className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                        {product.discount}% OFF
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-xl font-semibold text-gray-800 mb-2 truncate">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">
                      {product.category}
                    </p>
                    <div className="flex items-baseline space-x-2 mb-4">
                      <span className="text-2xl font-bold text-gray-900">
                        ₹{product.discountedPrice.toFixed(2)}
                      </span>
                      {product.originalPrice > product.discountedPrice && (
                        <span className="text-sm text-gray-500 line-through">
                          ₹{product.originalPrice.toFixed(2)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center mb-4">
                      <div className="flex text-yellow-400">
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4 fill-current" />
                        <Star className="h-4 w-4 text-gray-300" />
                      </div>
                      <span className="ml-2 text-sm text-gray-600">4.5</span>
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
          </div>
        </motion.div>
      )}

      {/* Download App Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              For better experience, download the CS Store now
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Get the best shopping experience with our mobile app
            </p>
            <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <button
                onClick={() => navigate("/download-app")}
                className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Download App
              </button>
              <button
                onClick={() => navigate("/download-app")}
                className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-white hover:text-blue-600 transition-colors"
              >
                Learn More
              </button>
            </div>
            <div className="mt-8 flex justify-center space-x-8 text-blue-100">
              <div className="text-center">
                <div className="text-2xl font-bold">4.8★</div>
                <div className="text-sm">App Store Rating</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">1M+</div>
                <div className="text-sm">Downloads</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">24/7</div>
                <div className="text-sm">Support</div>
              </div>
            </div>
          </div>
        </div>
      </div>

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
              <img
                src={getGradientPlaceholder('Banner', 1200, 300).src}
                alt="Payment Methods"
                className="h-6"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
