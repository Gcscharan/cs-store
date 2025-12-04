import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDispatch, useSelector } from "react-redux";
import { addToCart, setCart } from "../store/slices/cartSlice";
import { useAddToCartMutation } from "../store/api";
import { RootState } from "../store";
import { useToast } from "./AccessibleToast";
import { useNavigate } from "react-router-dom";

interface Product {
  _id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  mrp?: number;
  stock: number;
  images: { full: string; thumb: string }[];
  tags: string[];
}

interface QuickViewModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

const QuickViewModal: React.FC<QuickViewModalProps> = ({
  product,
  isOpen,
  onClose,
}) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const auth = useSelector((state: RootState) => state.auth);
  const [addToCartMutation, { isLoading: isAddingToCart }] =
    useAddToCartMutation();
  const { success, error: showError } = useToast();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  
  const addToCartButtonRef = useRef<HTMLButtonElement>(null);

  if (!product) return null;

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
          image: product.images[0]?.thumb || product.images[0]?.full || '/placeholder-product.svg',
          quantity,
        })
      );

      // Call backend API
      const result = await addToCartMutation({
        productId: product._id,
        quantity,
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

      // Show success toast
      success("Added to Cart", `${product.name} has been added to your cart.`);
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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col lg:flex-row">
              {/* Images */}
              <div className="lg:w-1/2 p-6">
                <div className="aspect-square bg-gray-100 rounded-lg mb-4">
                  <img
                    src={
                      product.images?.[selectedImageIndex]?.full ||
                      "/placeholder-product.jpg"
                    }
                    alt={product.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>

                {product.images && product.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {product.images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        className={`flex-shrink-0 w-16 h-16 rounded-md overflow-hidden ${
                          selectedImageIndex === index
                            ? "ring-2 ring-blue-500"
                            : ""
                        }`}
                      >
                        <img
                          src={image.thumb}
                          alt={`${product.name} ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div className="lg:w-1/2 p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {product.name}
                  </h2>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <span className="inline-block bg-blue-100 text-blue-800 text-sm px-2 py-1 rounded-full">
                    {product.category}
                  </span>
                </div>

                <p className="text-gray-600 mb-6">{product.description}</p>

                {/* Price */}
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl font-bold text-gray-900">
                    ₹{product.price}
                  </span>
                  {product.mrp && product.mrp > product.price && (
                    <>
                      <span className="text-lg text-gray-500 line-through">
                        ₹{product.mrp}
                      </span>
                      <span className="bg-red-100 text-red-800 text-sm px-2 py-1 rounded-full">
                        {discountPercentage}% OFF
                      </span>
                    </>
                  )}
                </div>

                {/* Stock Status */}
                <div className="mb-6">
                  {product.stock > 0 ? (
                    <span className="text-green-600 font-medium">
                      {product.stock} in stock
                    </span>
                  ) : (
                    <span className="text-red-600 font-medium">
                      Out of stock
                    </span>
                  )}
                </div>

                {/* Quantity */}
                {product.stock > 0 && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quantity
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        -
                      </button>
                      <span className="w-12 text-center">{quantity}</span>
                      <button
                        onClick={() =>
                          setQuantity(Math.min(product.stock, quantity + 1))
                        }
                        className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {product.tags.length > 0 && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tags
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {product.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="bg-gray-100 text-gray-700 text-sm px-2 py-1 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    ref={addToCartButtonRef}
                    onClick={handleAddToCart}
                    disabled={product.stock === 0 || isAddingToCart}
                    className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {isAddingToCart ? "Adding..." : "Add to Cart"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

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
    </AnimatePresence>
  );
};

export default QuickViewModal;
