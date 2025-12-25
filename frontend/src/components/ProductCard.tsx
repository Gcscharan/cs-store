import { useState, memo } from "react";
import { motion } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { addToCart, setCart } from "../store/slices/cartSlice";
import { useAddToCartMutation } from "../store/api";
import { RootState } from "../store";
import { useToast } from "./AccessibleToast";
import { useNavigate } from "react-router-dom";
import { useCartFeedback } from "../contexts/CartFeedbackContext";
import OptimizedImage from "./OptimizedImage";

interface Product {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  mrp?: number;
  stock: number;
  weight: number;
  images: {
    variants: { micro: string; thumb: string; small: string; medium: string; large: string; original: string };
    formats?: { avif?: string; webp?: string; jpg?: string };
    metadata?: { width?: number; height?: number; aspectRatio?: number };
  }[];
  tags: string[];
}

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
}

const ProductCard = memo(({ product, onQuickView }: ProductCardProps) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const auth = useSelector((state: RootState) => state.auth);
  const [addToCartMutation, { isLoading: isAddingToCart }] =
    useAddToCartMutation();
  const { success, error: showError } = useToast();
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  
  // Cart feedback
  const { triggerGlobalConfirmation } = useCartFeedback();

  const handleAddToCart = async () => {
    if (product.stock === 0) return;

    // Check if user is authenticated
    if (!auth.isAuthenticated) {
      setShowLoginPopup(true);
      return;
    }

    try {
      // Add to Redux store immediately for UI feedback
      dispatch(
        addToCart({
          id: product._id,
          name: product.name,
          price: product.price,
          image: product.images?.[0]?.variants?.small || product.images?.[0]?.variants?.thumb || '/placeholder-product.svg',
          quantity: 1,
        })
      );

      // Call backend API
      const result = await addToCartMutation({
        productId: product._id,
        quantity: 1,
      }).unwrap();

      // Update Redux store with backend response
      if (result.cart) {
        dispatch(
          setCart({
            items: result.cart.items,
            total: result.cart.total,
            itemCount: result.cart.itemCount,
          })
        );
      }

      // ✅ Trigger Global Amazon-style confirmation bar
      const productImage = product.images?.[0]?.variants?.small || product.images?.[0]?.variants?.thumb || '/placeholder-product.svg';
      const updatedCartCount = result.cart?.items?.length || 1; // Default to 1 if no cart data
      const updatedCartTotal = result.cart?.total || product.price; // Use product price as fallback
      triggerGlobalConfirmation(product.name, productImage, updatedCartCount, updatedCartTotal);
      
      // Show success toast
      success(`✅ Successfully added ${product.name} to cart`);
    } catch (error: any) {
      console.error("Failed to add to cart:", error);

      // Handle specific error cases with toast notifications
      if (
        error?.data?.error === "Access token required" ||
        error?.status === 401
      ) {
        setShowLoginPopup(true);
      } else if (
        error?.data?.error === "Product not found" ||
        error?.status === 404
      ) {
        showError("Product Not Found", "This product is no longer available.");
      } else if (
        error?.data?.error === "Insufficient stock" ||
        error?.data?.error === "Insufficient stock available"
      ) {
        showError("Out of Stock", "This item is currently out of stock.");
      } else if (error?.status === 403) {
        showError(
          "Access Denied",
          "You don't have permission to perform this action."
        );
      } else {
        showError("Unable to add to cart", "Please try again.");
      }
    }
  };

  const discountPercentage = product.mrp
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300"
    >
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100">
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
          productId={product._id}
          debug={false}
        />
        {discountPercentage > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs font-semibold">
            {discountPercentage}% OFF
          </div>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-10 group-hover:bg-opacity-0 transition-opacity duration-300"></div>
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="text-white font-semibold">Out of Stock</span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 text-lg mb-2 line-clamp-2">
          {product.name}
        </h3>

        <p className="text-gray-600 text-sm mb-3 line-clamp-2">
          {product.description}
        </p>

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl font-bold text-gray-900">
            ₹{product.price}
          </span>
          {product.mrp && product.mrp > product.price && (
            <span className="text-sm text-gray-500 line-through">
              ₹{product.mrp}
            </span>
          )}
        </div>

        {/* Weight */}
        {product.weight > 0 && (
          <div className="text-sm text-gray-600 mb-3">
            <span className="font-medium">Weight:</span> {product.weight}g
          </div>
        )}

        {/* Stock Status */}
        <div className="text-sm text-gray-600 mb-3">
          {product.stock > 0 ? (
            <span className="text-green-600">{product.stock} in stock</span>
          ) : (
            <span className="text-red-600">Out of stock</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleAddToCart}
            disabled={product.stock === 0 || isAddingToCart}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isAddingToCart ? "Adding..." : "Add to Cart"}
          </button>

          {onQuickView && (
            <button
              onClick={() => onQuickView(product)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              Quick View
            </button>
          )}
        </div>
      </div>

      {/* Login Popup Modal */}
      {showLoginPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
          >
            <div className="text-center">
              <div className="text-6xl mb-4">🔒</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Login Required
              </h3>
              <p className="text-gray-600 mb-6">
                Please log in to add items to your cart.
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowLoginPopup(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowLoginPopup(false);
                    navigate("/login");
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Login
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
});

export default ProductCard;
