import React, { useState } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  Heart,
  Share2,
  Star,
  Truck,
  Shield,
  RotateCcw,
  CreditCard,
  Camera,
  X,
  Send,
} from "lucide-react";
import ProductMediaCarousel from "../components/ProductMediaCarousel";
import { useLanguage } from "../contexts/LanguageContext";
import {
  useGetProductByIdQuery,
  useAddToCartMutation,
  useGetSimilarProductsQuery,
} from "../store/api";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { addToCart, setCart } from "../store/slices/cartSlice";
import { useToast } from "../components/AccessibleToast";
import { getProductImages } from "../utils/productImageMapper";
import { useCartFeedback } from "../contexts/CartFeedbackContext";

const ProductDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const dispatch = useDispatch();
  const cart = useSelector((state: RootState) => state.cart);
  const auth = useSelector((state: RootState) => state.auth);
  const [addToCartMutation, { isLoading: isAddingToCart }] =
    useAddToCartMutation();
  const { success, error: showError } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [showLoginPopup, setShowLoginPopup] = useState(false);
  
  // Cart feedback
  const { triggerGlobalConfirmation } = useCartFeedback();

  // Review state
  const [reviews, setReviews] = useState([
    {
      id: 1,
      customerName: "Rajesh Kumar",
      rating: 5,
      text: "Excellent product! Very good quality and fast delivery.",
      images: ["https://dummyimage.com/200x200/4ade80/ffffff&text=Review+1"],
      date: "2024-01-15",
    },
    {
      id: 2,
      customerName: "Priya Sharma",
      rating: 4,
      text: "Good product, but delivery was a bit slow.",
      images: [],
      date: "2024-01-10",
    },
  ]);

  const [newReview, setNewReview] = useState({
    customerName: "",
    rating: 0,
    text: "",
    images: [] as string[],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if it's a fallback product ID (starts with "fallback-")
  const isFallbackProduct = id?.startsWith("fallback-") || false;

  // Debug logging
  console.log("ProductDetailPage - Product ID:", id);
  console.log("ProductDetailPage - Is fallback product:", isFallbackProduct);

  // Fetch product from API (skip if fallback product)
  const {
    data: product,
    isLoading,
    error,
  } = useGetProductByIdQuery(id || "", {
    skip: !id || isFallbackProduct,
  });

  // Debug logging for API response
  console.log("ProductDetailPage - API Response:", {
    product,
    isLoading,
    error,
  });

  // Fetch similar products from API (skip if fallback product)
  const {
    data: similarProductsData,
    isLoading: isLoadingSimilar,
    error: similarError,
  } = useGetSimilarProductsQuery(
    { id: id || "", limit: 4 },
    {
      skip: !id || isFallbackProduct,
    }
  );

  // Safe similar products with defaults
  const similarProducts = similarProductsData?.products || [];

  const handleAddToCart = async () => {
    if (!product) return;

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
          quantity: quantity,
          image: getProductImages(product.name, product.category)[0],
        })
      );

      // Call backend API
      const result = await addToCartMutation({
        productId: product._id || product.id,
        quantity: quantity,
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
      const productImage = getProductImages(product.name, product.category)[0];
      const updatedCartCount = result.cart?.itemCount || (cart.itemCount + quantity);
      const updatedCartTotal = result.cart?.total || (cart.total + (product.price * quantity));
      triggerGlobalConfirmation(product.name, productImage, updatedCartCount, updatedCartTotal);
      
      // Show success toast
      success(`✅ Successfully added ${product.name} to cart`);
      console.log(`Successfully added ${quantity} ${product.name} to cart`);
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

  const handleFavorite = () => {
    console.log(`Added ${product?.name} to favorites`);
    // Implement favorite functionality
  };

  const handleShare = () => {
    console.log(`Sharing ${product?.name}!`);
    // Implement share functionality here
    if (navigator.share) {
      navigator.share({
        title: product?.name,
        text: `Check out this ${product?.name} from CS Store!`,
        url: window.location.href,
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
    }
  };

  // Review handling functions
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const imageUrls = Array.from(files).map((file) =>
        URL.createObjectURL(file)
      );
      setNewReview((prev) => ({
        ...prev,
        images: [...prev.images, ...imageUrls],
      }));
    }
  };

  const removeImage = (index: number) => {
    setNewReview((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSubmitReview = async () => {
    if (
      !newReview.customerName.trim() ||
      !newReview.text.trim() ||
      newReview.rating === 0
    ) {
      alert("Please fill in all required fields and select a rating.");
      return;
    }

    setIsSubmitting(true);

    try {
      const review = {
        id: Date.now(),
        customerName: newReview.customerName,
        rating: newReview.rating,
        text: newReview.text,
        images: newReview.images,
        date: new Date().toISOString().split("T")[0],
      };

      setReviews((prev) => [review, ...prev]);
      setNewReview({
        customerName: "",
        rating: 0,
        text: "",
        images: [],
      });

      // Here you would typically save to your backend
      console.log("Review submitted:", review);
    } catch (error) {
      console.error("Error submitting review:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimilarProductClick = (similarProduct: any) => {
    const productId = similarProduct.id || similarProduct._id;
    if (productId) {
      navigate(`/product/${productId}`);
    }
  };

  // Show fallback product message
  if (isFallbackProduct) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-6">
            <div className="w-24 h-24 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
              <span className="text-4xl">🔍</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Product Not Available
            </h1>
            <p className="text-gray-600 mb-6">
              This product is currently unavailable. Please check out our other
              amazing products.
            </p>
          </div>
          <button
            onClick={() => navigate("/products")}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading product...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Product not found or failed to load.</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              Product Details
            </h1>
          </div>
        </div>
      </div>

      {/* Product Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Product Media */}
          <div className="space-y-4">
            <div className="relative">
              {(() => {
                const productImages = getProductImages(
                  product.name,
                  product.category
                );
                return productImages.length > 0 ? (
                  <ProductMediaCarousel
                    media={productImages.map((img, index) => ({
                      id: `img-${index}`,
                      type: "image" as const,
                      url: img,
                      alt: product.name,
                    }))}
                  />
                ) : (
                  <div className="aspect-square bg-gray-200 rounded-xl flex items-center justify-center">
                    <span className="text-gray-400 text-lg">
                      No Image Available
                    </span>
                  </div>
                );
              })()}

              {/* Overlay Icons */}
              <div className="absolute top-4 right-4 flex space-x-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleFavorite}
                  className="p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors"
                >
                  <Heart className="h-5 w-5 text-gray-600 hover:text-red-500 transition-colors" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={handleShare}
                  className="p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-colors"
                >
                  <Share2 className="h-5 w-5 text-gray-600 hover:text-blue-500 transition-colors" />
                </motion.button>
              </div>
            </div>

            {/* Add to Cart Section - Below product image */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="space-y-4">
                {/* Quantity Input */}
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-gray-700">
                    Quantity:
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 1;
                      setQuantity(Math.max(1, value));
                    }}
                    className="w-16 px-3 py-2 text-center border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Add to Cart Button */}
                  <button
                    onClick={handleAddToCart}
                    disabled={product.stock <= 0 || isAddingToCart}
                    className="bg-blue-600 text-white py-4 px-8 rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl font-semibold text-lg flex-1"
                  >
                    <ShoppingCart className="h-6 w-6" />
                    <span>{isAddingToCart ? "Adding..." : "Add to Cart"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            {/* Product Name */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {product.name}
              </h1>

              {/* Rating */}
              <div className="flex items-center space-x-2 mb-4">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i < Math.floor(product.rating || 4.5)
                          ? "text-yellow-400 fill-current"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  {product.rating || 4.5} ({product.reviews || 128} reviews)
                </span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-center space-x-4">
              <span className="text-3xl font-bold text-gray-900">
                ₹{product.price}
              </span>
              {product.mrp && product.mrp > product.price && (
                <>
                  <span className="text-xl text-gray-500 line-through">
                    ₹{product.mrp}
                  </span>
                  <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                    Save ₹{product.mrp - product.price}
                  </span>
                </>
              )}
            </div>

            {/* Weight */}
            {product.weight > 0 && (
              <div className="text-lg text-gray-600">
                <span className="font-medium">Weight:</span> {product.weight}g
              </div>
            )}

            {/* Description */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Description
              </h3>
              <p className="text-gray-700 leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Delivery Info */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Truck className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Free Delivery</p>
                  <p className="text-sm text-green-700">
                    Estimated delivery: {product.deliveryDate || "2-3 days"}
                  </p>
                </div>
              </div>
            </div>

            {/* Policy Info */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <RotateCcw className="h-5 w-5 text-gray-500" />
                <span className="text-gray-700">No Return</span>
              </div>
              <div className="flex items-center space-x-3">
                <CreditCard className="h-5 w-5 text-gray-500" />
                <span className="text-gray-700">Cash on Delivery</span>
              </div>
              <div className="flex items-center space-x-3">
                <Shield className="h-5 w-5 text-blue-500" />
                <span className="text-gray-700 font-medium">
                  CS Store Assured
                </span>
              </div>
            </div>

            {/* Stock Status */}
            <div className="flex items-center space-x-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  product.stock > 0 ? "bg-green-500" : "bg-red-500"
                }`}
              ></div>
              <span
                className={`text-sm font-medium ${
                  product.stock > 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {product.stock > 0 ? "In Stock" : "Out of Stock"}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Reviews */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Customer Reviews
          </h2>

          {/* Review Submission Form */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Write a Review
            </h3>

            <div className="space-y-4">
              {/* Customer Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  value={newReview.customerName}
                  onChange={(e) =>
                    setNewReview((prev) => ({
                      ...prev,
                      customerName: e.target.value,
                    }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="Enter your name"
                />
              </div>

              {/* Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rating *
                </label>
                <div className="flex space-x-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() =>
                        setNewReview((prev) => ({ ...prev, rating: star }))
                      }
                      className="p-1"
                    >
                      <Star
                        className={`h-6 w-6 ${
                          star <= newReview.rating
                            ? "text-yellow-400 fill-current"
                            : "text-gray-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Review Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Review *
                </label>
                <textarea
                  value={newReview.text}
                  onChange={(e) =>
                    setNewReview((prev) => ({ ...prev, text: e.target.value }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  rows={4}
                  placeholder="Share your experience with this product..."
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Images (Optional)
                </label>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="review-images"
                  />
                  <label
                    htmlFor="review-images"
                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer transition-colors"
                  >
                    <Camera className="h-4 w-4" />
                    <span>Choose Images</span>
                  </label>
                </div>

                {/* Display uploaded images */}
                {newReview.images.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {newReview.images.map((image, index) => (
                      <div key={index} className="relative">
                        <img
                          src={image}
                          alt={`Review image ${index + 1}`}
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSubmitReview}
                  disabled={isSubmitting}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="h-4 w-4" />
                  <span>
                    {isSubmitting ? "Submitting..." : "Submit Review"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Existing Reviews */}
          <div className="space-y-6">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="bg-white rounded-xl shadow-lg p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-gray-900">
                      {review.customerName}
                    </h4>
                    <div className="flex items-center space-x-1 mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating
                              ? "text-yellow-400 fill-current"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-sm text-gray-500">{review.date}</span>
                </div>

                <p className="text-gray-700 mb-4">{review.text}</p>

                {/* Review Images */}
                {review.images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {review.images.map((image, index) => (
                      <img
                        key={index}
                        src={image}
                        alt={`Review image ${index + 1}`}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Similar Products */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Similar Products
          </h2>

          {isLoadingSimilar ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse"
                >
                  <div className="aspect-square bg-gray-200"></div>
                  <div className="p-4">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : similarError ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">
                Failed to load similar products. Please try again later.
              </p>
            </div>
          ) : similarProducts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 text-lg">
                No similar products found.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {similarProducts.map((similarProduct) => (
                <motion.div
                  key={similarProduct.id || similarProduct._id}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSimilarProductClick(similarProduct)}
                  className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden group"
                >
                  <div className="aspect-square bg-gray-200 overflow-hidden">
                    <img
                      src={
                        similarProduct.image ||
                        "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop&crop=center"
                      }
                      alt={similarProduct.name || "Product"}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      onError={(e) => {
                        e.currentTarget.src =
                          "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop&crop=center";
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {similarProduct.name || "Unknown Product"}
                    </h3>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-lg font-bold text-gray-900">
                        ₹{similarProduct.price || 0}
                      </span>
                      <div className="flex items-center">
                        <Star className="h-4 w-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-600 ml-1">
                          {similarProduct.rating || 4.0}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
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
    </div>
  );
};

export default ProductDetailPage;
