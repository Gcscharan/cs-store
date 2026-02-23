interface SkeletonBoxProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export default function SkeletonBox({ width = "100%", height = "1rem", className = "" }: SkeletonBoxProps) {
  return (
    <div
      aria-hidden="true"
      className={`bg-gray-200 rounded-lg animate-shimmer ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  );
}

// Add shimmer animation to global styles
