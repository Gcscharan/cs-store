import React from "react";
import { motion } from "framer-motion";

interface SkeletonLoaderProps {
  className?: string;
  variant?: "text" | "rectangular" | "circular" | "card" | "list";
  width?: string | number;
  height?: string | number;
  lines?: number;
  animate?: boolean;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  className = "",
  variant = "rectangular",
  width,
  height,
  lines = 1,
  animate = true,
}) => {
  const baseClasses = "bg-secondary-200 rounded animate-pulse";

  const getVariantClasses = () => {
    switch (variant) {
      case "text":
        return "h-4 w-full";
      case "circular":
        return "rounded-full";
      case "card":
        return "h-48 w-full";
      case "list":
        return "h-16 w-full";
      default:
        return "h-4 w-full";
    }
  };

  const getDimensions = () => {
    const style: React.CSSProperties = {};
    if (width) style.width = typeof width === "number" ? `${width}px` : width;
    if (height)
      style.height = typeof height === "number" ? `${height}px` : height;
    return style;
  };

  if (variant === "text" && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <motion.div
            key={index}
            className={`${baseClasses} ${getVariantClasses()}`}
            style={getDimensions()}
            initial={animate ? { opacity: 0.6 } : {}}
            animate={animate ? { opacity: [0.6, 1, 0.6] } : {}}
            transition={animate ? { duration: 1.5, repeat: Infinity } : {}}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      className={`${baseClasses} ${getVariantClasses()} ${className}`}
      style={getDimensions()}
      initial={animate ? { opacity: 0.6 } : {}}
      animate={animate ? { opacity: [0.6, 1, 0.6] } : {}}
      transition={animate ? { duration: 1.5, repeat: Infinity } : {}}
    />
  );
};

// Predefined skeleton components for common use cases
export const ProductCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
    <SkeletonLoader variant="rectangular" height={200} className="w-full" />
    <div className="space-y-2">
      <SkeletonLoader variant="text" width="80%" />
      <SkeletonLoader variant="text" width="60%" />
    </div>
    <div className="flex justify-between items-center">
      <SkeletonLoader variant="text" width="40%" />
      <SkeletonLoader variant="rectangular" width={80} height={32} />
    </div>
  </div>
);

export const OrderCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
    <div className="flex justify-between items-start">
      <SkeletonLoader variant="text" width="30%" />
      <SkeletonLoader variant="rectangular" width={60} height={24} />
    </div>
    <SkeletonLoader variant="text" width="70%" />
    <div className="flex justify-between items-center">
      <SkeletonLoader variant="text" width="40%" />
      <SkeletonLoader variant="text" width="20%" />
    </div>
  </div>
);

export const DriverCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
    <div className="flex items-center space-x-3">
      <SkeletonLoader variant="circular" width={40} height={40} />
      <div className="flex-1 space-y-2">
        <SkeletonLoader variant="text" width="60%" />
        <SkeletonLoader variant="text" width="40%" />
      </div>
    </div>
    <div className="flex justify-between items-center">
      <SkeletonLoader variant="text" width="50%" />
      <SkeletonLoader variant="rectangular" width={60} height={24} />
    </div>
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-8">
    {/* Header skeleton */}
    <div className="bg-white rounded-lg shadow-sm p-6">
      <SkeletonLoader variant="text" width="40%" height={32} className="mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <SkeletonLoader variant="text" width="60%" height={24} />
            <SkeletonLoader variant="text" width="40%" />
          </div>
        ))}
      </div>
    </div>

    {/* Charts skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-sm p-6">
          <SkeletonLoader variant="text" width="30%" className="mb-4" />
          <SkeletonLoader variant="rectangular" height={300} />
        </div>
      ))}
    </div>

    {/* Lists skeleton */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-sm p-6">
          <SkeletonLoader variant="text" width="40%" className="mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, itemIndex) => (
              <div
                key={itemIndex}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <SkeletonLoader variant="circular" width={32} height={32} />
                  <div className="space-y-1">
                    <SkeletonLoader variant="text" width="60%" />
                    <SkeletonLoader variant="text" width="40%" />
                  </div>
                </div>
                <SkeletonLoader variant="text" width="20%" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default SkeletonLoader;
