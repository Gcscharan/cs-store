import React, { useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, ArrowLeft } from "lucide-react";
import { useSearchProductsQuery, useAddToCartMutation } from "../store/api";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { addToCart, setCart } from "../store/slices/cartSlice";
import { useToast } from "../components/AccessibleToast";
import { useCartFeedback } from "../contexts/CartFeedbackContext";
import OptimizedImage from "../components/OptimizedImage";

const SearchResultsPage: React.FC = () => {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [sortBy, setSortBy] = useState("relevance");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const auth = useSelector((state: RootState) => state.auth);
  const cart = useSelector((state: RootState) => state.cart);
  const { success, error: showError } = useToast();
  const { triggerGlobalConfirmation } = useCartFeedback();
  const [addToCartMutation, { isLoading: isAddingToCart }] =
    useAddToCartMutation();
  const [addingId, setAddingId] = useState<string | null>(null);

  // Prefer query string ?q= over route params, fallback to empty string
  const searchParams = new URLSearchParams(location.search);
  const qFromSearch = searchParams.get("q") || "";
  const q = (params.q as string) || qFromSearch;

  // Use backend search
  const { data, isLoading, error } = useSearchProductsQuery({
    q,
    page,
    limit: 12
  }) as { data: { products: any[]; total: number } | undefined; isLoading: boolean; error?: any };

  const products = data?.products || [];
  const total = data?.total || 0;
  const totalPages = data ? Math.ceil(total / 12) : 0;

  const handleProductClick = (product: any) => {
    navigate(`/product/${product._id || product.id}`);
  };

  const handleAddToCart = async (product: any, e: React.MouseEvent) => {
    e.stopPropagation();

    const productId = product._id || product.id;

    // Block add to cart when out of stock
    if ((product.stock || 0) <= 0) {
      showError("Out of Stock", "This item is currently out of stock.");
      return;
    }

    if (!auth.isAuthenticated) {
      navigate("/login");
      return;
    }

    try {
      setAddingId(productId);

      // Optimistic Redux update for instant UI feedback
      dispatch(
        addToCart({
          id: productId,
          name: product.name,
          price: product.price || 0,
          quantity: 1,
          image: product.images?.[0]?.thumb || "/placeholder-product.svg",
        })
      );

      // Persist to backend
      const result = await addToCartMutation({
        productId,
        quantity: 1,
      }).unwrap();

      // Reconcile with backend response
      if (result.cart) {
        dispatch(
          setCart({
            items: result.cart.items,
            total: result.cart.total,
            itemCount: result.cart.itemCount,
          })
        );
      }

      const productImage =
        product.images?.[0]?.thumb || "/placeholder-product.svg";
      const updatedCartCount =
        result.cart?.items?.length || cart.items.length;
      const updatedCartTotal =
        result.cart?.total || cart.total + (product.price || 0);
      triggerGlobalConfirmation(
        product.name,
        productImage,
        updatedCartCount,
        updatedCartTotal
      );

      success(`✅ Successfully added ${product.name} to cart`);
    } catch (err: any) {
      console.error("Failed to add to cart:", err);
      if (
        err?.data?.error === "Access token required" ||
        err?.status === 401
      ) {
        navigate("/login");
      } else if (err?.status === 404) {
        showError("Product Not Found", "This product is no longer available.");
      } else if (
        err?.data?.error?.includes?.("stock") ||
        err?.data?.message?.includes?.("stock") ||
        err?.data?.message?.includes?.("available")
      ) {
        const available = err?.data?.availableStock;
        showError(
          "Out of Stock",
          available !== undefined
            ? `Only ${available} item(s) available`
            : "This item is currently out of stock."
        );
      } else {
        showError("Unable to add to cart", "Please try again.");
      }
    } finally {
      setAddingId(null);
    }
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
                  disabled={
                    (product.stock || 0) <= 0 ||
                    (isAddingToCart &&
                      addingId === (product._id || product.id))
                  }
                  className="mt-3 w-full py-2 rounded-lg transition-colors text-white disabled:bg-gray-400 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700"
                >
                  {(product.stock || 0) <= 0
                    ? "Out of Stock"
                    : isAddingToCart &&
                      addingId === (product._id || product.id)
                    ? "Adding..."
                    : "Add to Cart"}
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
