import React, { useState, useRef, useEffect } from "react";

/**
 * Lazy Loading Image Component with LQIP (Low Quality Image Placeholder)
 */

interface LazyImageProps {
  src: string;
  alt: string;
  lqip?: string; // Low Quality Image Placeholder (base64 or data URL)
  width?: number;
  height?: number;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
  priority?: boolean; // Load immediately if true
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  lqip,
  width,
  height,
  className = "",
  onLoad,
  onError,
  priority = false,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (priority) return;

    const imgElement = imgRef.current;
    if (!imgElement) return;

    // Create intersection observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: "50px 0px", // Start loading 50px before image comes into view
        threshold: 0.1,
      }
    );

    observerRef.current.observe(imgElement);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {/* LQIP placeholder */}
      {lqip && !isLoaded && !hasError && (
        <img
          src={lqip}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm scale-110"
          aria-hidden="true"
        />
      )}

      {/* Loading skeleton */}
      {!lqip && !isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}

      {/* Main image */}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
        />
      )}

      {/* Error state */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
          <div className="text-center">
            <svg
              className="w-8 h-8 mx-auto mb-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm">Failed to load image</p>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Image with automatic LQIP generation
 */
export const SmartImage: React.FC<
  Omit<LazyImageProps, "lqip"> & {
    generateLQIP?: boolean;
  }
> = ({ generateLQIP = true, ...props }) => {
  const [lqip, setLqip] = useState<string | undefined>();

  useEffect(() => {
    if (!generateLQIP || !props.src) return;

    // Generate a simple LQIP by creating a small canvas
    const generatePlaceholder = async () => {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";

        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          if (!ctx) return;

          // Create a small version (20x20) for LQIP
          const size = 20;
          canvas.width = size;
          canvas.height = size;

          ctx.drawImage(img, 0, 0, size, size);
          const dataURL = canvas.toDataURL("image/jpeg", 0.1);
          setLqip(dataURL);
        };

        img.src = props.src;
      } catch (error) {
        console.warn("Failed to generate LQIP:", error);
      }
    };

    generatePlaceholder();
  }, [props.src, generateLQIP]);

  return <LazyImage {...props} lqip={lqip} />;
};

export default LazyImage;
