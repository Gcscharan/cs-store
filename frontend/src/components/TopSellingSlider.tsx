import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TopSellingProduct {
  id: string | number;
  name: string;
  image: string;
  category: string;
}

interface TopSellingSliderProps {
  products: TopSellingProduct[];
  className?: string;
}

const TopSellingSlider: React.FC<TopSellingSliderProps> = ({
  products,
  className = "",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const navigate = useNavigate();

  // Calculate maximum index based on products length and visible items
  const getMaxIndex = () => {
    if (products.length <= 4) return 0;
    // Calculate the exact index needed to show the last item at the right edge
    const visibleItems = 4;
    const totalItems = products.length;
    // We need to slide until the last item is at the right edge
    // The last slide should show the last 4 items with the last item at the right edge
    return Math.max(0, totalItems - visibleItems);
  };

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying || products.length <= 4) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const maxIndex = getMaxIndex();
        // If at the end, go back to start; otherwise move forward
        return prevIndex >= maxIndex ? 0 : prevIndex + 1;
      });
    }, 3000); // Change slide every 3 seconds

    return () => clearInterval(interval);
  }, [isAutoPlaying, products.length, currentIndex]);

  const nextSlide = () => {
    const maxIndex = getMaxIndex();
    if (currentIndex < maxIndex) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const prevSlide = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Check if navigation buttons should be disabled
  const isPrevDisabled = currentIndex === 0;
  const isNextDisabled = currentIndex >= getMaxIndex();

  const handleProductClick = (product: TopSellingProduct) => {
    // Ensure we have a valid product ID
    if (!product.id) {
      console.error("Product ID is missing:", product);
      return;
    }

    try {
      navigate(`/product/${product.id}`);
    } catch (error) {
      console.error("Navigation error:", error);
      // Fallback: redirect to products page
      navigate("/products");
    }
  };

  const handleMouseEnter = () => {
    setIsAutoPlaying(false);
  };

  const handleMouseLeave = () => {
    setIsAutoPlaying(true);
  };

  // Don't render if no products
  if (!products || products.length === 0) {
    return null;
  }

  // Calculate the translation based on current index
  const getTranslationX = () => {
    if (products.length <= 4) return 0;

    const totalItems = products.length;
    const visibleItems = 4;
    const maxIndex = getMaxIndex();

    // If we're at the last slide, ensure the last item aligns to the right edge
    if (currentIndex >= maxIndex) {
      // For the last slide, we want to show the last 4 items
      // Calculate the exact percentage needed to position the last item at the right edge
      // We need to translate by the width of the items that are hidden
      // Each item takes 25% of the container width
      const itemsToHide = totalItems - visibleItems;
      // Calculate the percentage of the container that needs to be hidden
      const hiddenPercentage = (itemsToHide / totalItems) * 100;
      return -hiddenPercentage;
    }

    // For normal slides, translate by the current index
    const slidePercentage = (currentIndex / totalItems) * 100;
    return -slidePercentage;
  };

  return (
    <div
      className={`relative w-full ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-3 sm:space-y-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
            🔥 Top Selling
          </h2>
          <p className="text-sm sm:text-base text-neutral-600">
            Most popular products this week
          </p>
        </div>

        {/* Navigation Controls */}
        {products.length > 4 && (
          <div className="flex space-x-2">
            <motion.button
              whileHover={
                !isPrevDisabled
                  ? {
                      scale: 1.1,
                      rotate: -5,
                      boxShadow: "0 8px 25px rgba(0, 0, 0, 0.15)",
                      transition: { duration: 0.3, ease: "easeOut" },
                    }
                  : {}
              }
              whileTap={
                !isPrevDisabled
                  ? {
                      scale: 0.95,
                      transition: { duration: 0.1 },
                    }
                  : {}
              }
              onClick={prevSlide}
              disabled={isPrevDisabled}
              className={`p-3 rounded-lg shadow-flipkart transition-all duration-300 ${
                isPrevDisabled
                  ? "bg-neutral-100 border border-neutral-200 cursor-not-allowed"
                  : "bg-white border border-neutral-300 hover:shadow-flipkart-hover hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
              }`}
              aria-label="Previous products"
            >
              <ChevronLeft
                className={`h-4 w-4 ${
                  isPrevDisabled ? "text-neutral-400" : "text-neutral-600"
                }`}
              />
            </motion.button>

            <motion.button
              whileHover={
                !isNextDisabled
                  ? {
                      scale: 1.1,
                      rotate: 5,
                      boxShadow: "0 8px 25px rgba(0, 0, 0, 0.15)",
                      transition: { duration: 0.3, ease: "easeOut" },
                    }
                  : {}
              }
              whileTap={
                !isNextDisabled
                  ? {
                      scale: 0.95,
                      transition: { duration: 0.1 },
                    }
                  : {}
              }
              onClick={nextSlide}
              disabled={isNextDisabled}
              className={`p-3 rounded-lg shadow-flipkart transition-all duration-300 ${
                isNextDisabled
                  ? "bg-neutral-100 border border-neutral-200 cursor-not-allowed"
                  : "bg-white border border-neutral-300 hover:shadow-flipkart-hover hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50"
              }`}
              aria-label="Next products"
            >
              <ChevronRight
                className={`h-4 w-4 ${
                  isNextDisabled ? "text-neutral-400" : "text-neutral-600"
                }`}
              />
            </motion.button>
          </div>
        )}
      </div>

      {/* Products Slider */}
      <div className="relative overflow-hidden">
        <motion.div
          className="flex space-x-4"
          animate={{
            x: `${getTranslationX()}%`,
          }}
          transition={{
            duration: 0.8,
            ease: [0.25, 0.46, 0.45, 0.94],
            type: "spring",
            stiffness: 100,
            damping: 20,
          }}
        >
          {products.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{
                delay: index * 0.15,
                duration: 0.6,
                ease: [0.25, 0.46, 0.45, 0.94],
                type: "spring",
                stiffness: 120,
                damping: 15,
              }}
              whileHover={{
                scale: 1.08,
                y: -8,
                rotateY: 2,
                transition: { duration: 0.3, ease: "easeOut" },
              }}
              whileTap={{
                scale: 0.95,
                transition: { duration: 0.1 },
              }}
              onClick={() => handleProductClick(product)}
              className="flex-shrink-0 w-48 sm:w-52 md:w-56 lg:w-60 bg-white rounded-lg shadow-flipkart hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden group"
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
              <div className="relative h-28 sm:h-32 overflow-hidden">
                <motion.img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  whileHover={{
                    scale: 1.15,
                    transition: { duration: 0.4, ease: "easeOut" },
                  }}
                  transition={{ duration: 0.3 }}
                />
                <motion.div
                  className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
                  initial={{ opacity: 0 }}
                  whileHover={{
                    opacity: 1,
                    transition: { duration: 0.3, ease: "easeOut" },
                  }}
                />

                {/* Top Selling Badge */}
                <motion.div
                  className="absolute top-2 left-2"
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: index * 0.1 + 0.3,
                    duration: 0.5,
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                  }}
                  whileHover={{
                    scale: 1.1,
                    rotate: 5,
                    transition: { duration: 0.2 },
                  }}
                >
                  <motion.div
                    className="bg-gradient-to-r from-secondary-500 to-orange-500 text-white px-2 py-1 rounded-md text-xs font-bold shadow-flipkart"
                    whileHover={{
                      boxShadow: "0 8px 25px rgba(255, 140, 0, 0.4)",
                      transition: { duration: 0.3 },
                    }}
                  >
                    🔥 Top
                  </motion.div>
                </motion.div>
              </div>

              {/* Product Name */}
              <motion.div
                className="p-3 sm:p-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.1 + 0.4,
                  duration: 0.4,
                  ease: "easeOut",
                }}
              >
                <motion.h3
                  className="font-semibold text-neutral-900 text-xs sm:text-sm line-clamp-2 group-hover:text-primary-600 transition-colors duration-300"
                  whileHover={{
                    scale: 1.02,
                    transition: { duration: 0.2 },
                  }}
                >
                  {product.name}
                </motion.h3>
                <motion.p
                  className="text-xs text-neutral-500 mt-2 capitalize font-medium"
                  whileHover={{
                    color: "#f97316",
                    transition: { duration: 0.2 },
                  }}
                >
                  {product.category}
                </motion.p>
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Dots Indicator */}
      {products.length > 4 && (
        <motion.div
          className="flex justify-center mt-4 space-x-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {Array.from({ length: Math.ceil(products.length / 4) }).map(
            (_, index) => {
              const targetIndex = index * 4;
              const maxIndex = getMaxIndex();
              const isActive = currentIndex === targetIndex;
              const isDisabled = targetIndex > maxIndex;

              return (
                <motion.button
                  key={index}
                  onClick={() => {
                    if (targetIndex <= maxIndex) {
                      setCurrentIndex(targetIndex);
                    }
                  }}
                  disabled={isDisabled}
                  whileHover={
                    !isDisabled
                      ? {
                          scale: 1.3,
                          transition: { duration: 0.2 },
                        }
                      : {}
                  }
                  whileTap={
                    !isDisabled
                      ? {
                          scale: 0.9,
                          transition: { duration: 0.1 },
                        }
                      : {}
                  }
                  className={`h-2 rounded-full transition-all duration-300 ${
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 w-6 shadow-lg"
                      : isDisabled
                      ? "bg-gray-200 w-2 cursor-not-allowed"
                      : "bg-gray-300 hover:bg-gradient-to-r hover:from-blue-400 hover:to-indigo-500 w-2 hover:w-4"
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: 0.6 + index * 0.1,
                    duration: 0.3,
                    type: "spring",
                    stiffness: 200,
                  }}
                />
              );
            }
          )}
        </motion.div>
      )}
    </div>
  );
};

export default TopSellingSlider;
