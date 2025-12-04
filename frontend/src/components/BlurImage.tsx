import { useState, useRef, useEffect } from "react";
import { useLazyImage } from "../hooks/useLazyImage.js";

// Simple LRU cache implementation
class ImageCache {
  private cache = new Map<string, HTMLImageElement>();
  private maxSize = 50;

  get(key: string): HTMLImageElement | undefined {
    const value = this.cache.get(key);
    if (value) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, value: HTMLImageElement): void {
    if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }
}

const imageCache = new ImageCache();

interface BlurImageProps {
  thumb: string;
  full: string;
  alt?: string;
  className?: string;
  priority?: boolean; // For hero images
}

export default function BlurImage({ thumb, full, alt, className, priority = false }: BlurImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const { shouldLoad } = useLazyImage(imgRef, { priority });

  // Generate srcset for responsive images
  const thumbSrcSet = `${thumb}?w=200 200w, ${thumb}?w=400 400w`;
  const fullSrcSet = `${full}?w=800 800w, ${full}?w=1200 1200w, ${full}?w=1600 1600w`;

  // Generate WebP versions (assuming Base64 can be converted to WebP by browser)
  const thumbWebpSrcSet = `${thumb}?w=200&format=webp 200w, ${thumb}?w=400&format=webp 400w`;
  const fullWebpSrcSet = `${full}?w=800&format=webp 800w, ${full}?w=1200&format=webp 1200w, ${full}?w=1600&format=webp 1600w`;

  useEffect(() => {
    if (priority && shouldLoad) {
      // Check cache first
      const cachedImage = imageCache.get(full);
      if (cachedImage) {
        setIsLoaded(true);
        return;
      }

      // Preload hero image
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = full;
      document.head.appendChild(link);
      
      // Cache the image
      const img = new Image();
      img.onload = () => {
        imageCache.set(full || '', img);
        setIsLoaded(true);
      };
      img.src = full;
      
      return () => {
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
      };
    }
  }, [priority, shouldLoad, full]);

  const handleLoad = () => {
    setIsLoaded(true);
    // Cache the loaded image
    if (imgRef.current) {
      imageCache.set(full || '', imgRef.current);
    }
  };
  
  const handleError = () => setError(true);

  if (error) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <span className="text-gray-500">Image not available</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Thumbnail (blurred) */}
      <picture>
        <source
          type="image/webp"
          srcSet={thumbWebpSrcSet}
          sizes="(max-width: 400px) 200px, 400px"
        />
        <img
          ref={imgRef}
          src={thumb}
          srcSet={thumbSrcSet}
          sizes="(max-width: 400px) 200px, 400px"
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-out ${
            isLoaded ? "opacity-0 scale-110 blur-xl" : "opacity-100 scale-100 blur-sm"
          }`}
        />
      </picture>
      
      {/* Full resolution image */}
      {shouldLoad && (
        <picture>
          <source
            type="image/webp"
            srcSet={fullWebpSrcSet}
            sizes="(max-width: 800px) 800px, (max-width: 1200px) 1200px, 1600px"
          />
          <img
            src={full}
            srcSet={fullSrcSet}
            sizes="(max-width: 800px) 800px, (max-width: 1200px) 1200px, 1600px"
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            className={`w-full h-full object-cover transition-all duration-500 ease-out ${
              isLoaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-105 blur-sm"
            }`}
          />
        </picture>
      )}
    </div>
  );
}
