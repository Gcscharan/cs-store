interface SkeletonBoxProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export default function SkeletonBox({ width = "100%", height = "1rem", className = "" }: SkeletonBoxProps) {
  return (
    <div
      className={`bg-gray-200 rounded-lg animate-pulse ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        backgroundImage: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }}
    />
  );
}

// Add shimmer animation to global styles
const style = document.createElement("style");
style.textContent = `
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
`;
document.head.appendChild(style);
