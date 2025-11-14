import React, { useEffect, useState } from 'react';
import { CheckCircle, X } from 'lucide-react';

interface CartConfirmationBarProps {
  isVisible: boolean;
  productName: string;
  productImage?: string;
  onClose: () => void;
}

const CartConfirmationBar: React.FC<CartConfirmationBarProps> = ({
  isVisible,
  productName,
  productImage,
  onClose
}) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      
      // Auto-close after 4 seconds
      const timer = setTimeout(() => {
        onClose();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      // Delay removing from DOM to allow exit animation
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm mx-4">
        <div className="flex items-center space-x-3">
          {/* Success Check Circle */}
          <div className="flex-shrink-0">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          
          {/* Product Image (if provided) */}
          {productImage && (
            <div className="flex-shrink-0">
              <img 
                src={productImage} 
                alt={productName}
                className="h-12 w-12 object-cover rounded-md border border-gray-200"
              />
            </div>
          )}
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">
              Added to cart
            </p>
            <p className="text-sm text-gray-600 truncate">
              {productName}
            </p>
          </div>
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartConfirmationBar;
