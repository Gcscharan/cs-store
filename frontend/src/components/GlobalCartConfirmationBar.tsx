import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, ShoppingCart } from 'lucide-react';

interface GlobalCartConfirmationBarProps {
  isVisible: boolean;
  productName: string;
  productImage?: string;
  currentCartCount: number;
  cartTotal?: number;
  onClose: () => void;
}

const GlobalCartConfirmationBar: React.FC<GlobalCartConfirmationBarProps> = ({
  isVisible,
  productName,
  productImage,
  currentCartCount,
  cartTotal = 0,
  onClose
}) => {
  useEffect(() => {
    if (isVisible) {
      // Auto-dismiss after 5 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  // Determine delivery message based on cart value (₹2000 threshold)
  const FREE_DELIVERY_THRESHOLD = 2000;
  const getDeliveryMessage = (total: number) => {
    if (total >= FREE_DELIVERY_THRESHOLD) {
      return "🚚 Your order qualifies for FREE Delivery!";
    } else {
      const remaining = FREE_DELIVERY_THRESHOLD - total;
      return `Add ₹${remaining} more for FREE Delivery`;
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ 
            type: "spring",
            stiffness: 300,
            damping: 30,
            duration: 0.6
          }}
          className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-lg"
          role="alert"
          aria-live="polite"
        >
          {/* Rich Confirmation Content */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between py-3">
              {/* Left Section: Success Icon + Product Info */}
              <div className="flex items-center space-x-4">
                {/* Success Checkmark */}
                <div className="flex-shrink-0">
                  <div className="bg-green-100 rounded-full p-2">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                </div>

                {/* Product Image */}
                {productImage && (
                  <div className="flex-shrink-0 hidden sm:block">
                    <img 
                      src={productImage} 
                      alt={productName}
                      className="h-12 w-12 object-cover rounded-md border border-gray-200 shadow-sm"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-semibold text-gray-900">
                      ✅ Added to cart
                    </p>
                    <div className="hidden md:flex items-center space-x-2 text-sm text-gray-600">
                      <span>•</span>
                      <ShoppingCart className="h-4 w-4" />
                      <span className="font-medium">{currentCartCount} item{currentCartCount !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span className="font-semibold text-green-600">₹{cartTotal}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-700 truncate max-w-xs sm:max-w-md">
                    {productName}
                  </p>
                  
                  {/* Mobile cart count and total */}
                  <div className="md:hidden flex items-center space-x-2 text-xs text-gray-500 mt-1">
                    <ShoppingCart className="h-3 w-3" />
                    <span>{currentCartCount} item{currentCartCount !== 1 ? 's' : ''}</span>
                    <span>•</span>
                    <span className="font-semibold text-green-600">₹{cartTotal}</span>
                  </div>
                </div>
              </div>

              {/* Right Section: Delivery Message + Close */}
              <div className="flex items-center space-x-4">
                {/* Delivery Message */}
                <div className="hidden lg:block text-right">
                  <p className="text-sm text-green-600 font-medium">
                    {getDeliveryMessage(cartTotal)}
                  </p>
                  {cartTotal >= FREE_DELIVERY_THRESHOLD && (
                    <p className="text-xs text-gray-500 mt-1">
                      Estimated delivery: Tomorrow
                    </p>
                  )}
                </div>

                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded-full hover:bg-gray-100"
                  aria-label="Close notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Mobile Delivery Message */}
            <div className="lg:hidden border-t border-gray-100 py-2">
              <p className="text-sm text-green-600 font-medium">
                {getDeliveryMessage(cartTotal)}
              </p>
              {cartTotal >= FREE_DELIVERY_THRESHOLD && (
                <p className="text-xs text-gray-500 mt-1">
                  Estimated delivery: Tomorrow
                </p>
              )}
            </div>
          </div>

          {/* Progress Bar Animation (Optional Enhancement) */}
          <motion.div
            initial={{ scaleX: 1 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: 5, ease: "linear" }}
            className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-500 origin-left"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalCartConfirmationBar;
