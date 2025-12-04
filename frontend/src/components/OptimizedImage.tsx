import React, { useEffect, useRef, useState } from "react";

type ImageVariant = {
  micro?: string;
  thumb?: string;
  small?: string;
  medium?: string;
  large?: string;
  original?: string;
  [key: string]: string | undefined; // Allow dynamic indexing
};

type ProductImage = {
  _id?: string;
  publicId?: string;
  variants?: ImageVariant;
  formats?: {
    avif?: string;
    webp?: string;
    jpg?: string;
  };
  metadata?: { width?: number; height?: number; aspectRatio?: number };
  _doc?: { // Handle Mongoose nested _doc
    variants?: ImageVariant;
    formats?: { avif?: string; webp?: string; jpg?: string };
    metadata?: { width?: number; height?: number; aspectRatio?: number };
  };
};

interface Props {
  image?: ProductImage | null;
  size?: "micro" | "thumb" | "small" | "medium" | "large";
  alt?: string;
  className?: string;
  priority?: boolean; // eager load
  debug?: boolean; // prints additional logs
  productId?: string; // for better log correlation
}

const DEFAULT_PLACEHOLDER = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

export default function OptimizedImage({
  image,
  size = "small",
  alt = "Product image",
  className = "",
  priority = false,
  debug = false,
  productId,
}: Props) {
  // Safe Mongoose-aware wrapper for image parsing
  const img: ProductImage = image?.publicId
    ? image
    : image?._doc
    ? image._doc
    : image || {};

  const variants = img.variants || {};
  const formats = img.formats || {};
  const metadata = img.metadata || {};

  // Comprehensive debug logging
  console.group(`🖼️ OptimizedImage Debug: ${productId}`);
  console.log("Received image:", image);
  console.log("Fixed img object:", img);
  console.log("Variants:", variants);
  console.log("Selected variant:", variants[size]);
  console.log("Formats:", formats);
  console.log("Metadata:", metadata);
  console.groupEnd();

  // Logging helper
  const log = (...args: any[]) => {
    if (debug) {
      // include productId to make logs traceable
      console.log(`[OptimizedImage] product=${productId || "unknown"}`, ...args);
    }
  };

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [inView, setInView] = useState<boolean>(priority); // if priority, treat as in view
  const [loaded, setLoaded] = useState(false);

  // Log the incoming image for debugging
  useEffect(() => {
    log("incoming image object:", image);
    log("fixed img object:", img);
    log("variants:", variants);
    log("variants.small:", variants.small);
    log("variants.thumb:", variants.thumb);
    log("formats:", formats);
    log("metadata:", metadata);
  }, [image]);

  // Resolve URL with fallbacks
  const resolveUrl = (sz: string) => {
    if (!img) return DEFAULT_PLACEHOLDER;
    // Prefer explicit format variants if available: e.g., variants.small
    let candidate = variants[sz] || null;
    // If candidate missing, try formats (publicId-based) if available
    if (!candidate && formats) {
      // formats may contain webp/avif/jpg of original; prefer webp then avif then jpg
      candidate = formats.webp || formats.avif || formats.jpg || null;
    }
    // Final fallback to placeholder
    return candidate || DEFAULT_PLACEHOLDER;
  };

  const src = resolveUrl(size);
  const srcThumb = resolveUrl("thumb");

  // IntersectionObserver for lazy load
  useEffect(() => {
    if (priority) return; // do not lazy if priority
    if (!imgRef.current) {
      // find nearest parent element to observe if component root not used
    }
    const el = imgRef.current || document.querySelector(`img[data-optim-product="${productId || ""}"]`);
    if (!el) {
      // fallback: mark inView true so it loads
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin: "100px", threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [priority, imgRef.current]);

  // Aspect ratio fallback
  const aspect = image?.metadata?.aspectRatio || 1;
  const wrapperStyle: React.CSSProperties = {
    aspectRatio: aspect,
    minWidth: 1,
    minHeight: 1,
    overflow: "hidden",
    display: "block",
    backgroundColor: "#f3f4f6", // neutral bg while loading
  };

  // Prevent classname from explicitly overriding width/height (log)
  useEffect(() => {
    if (className && /w-|h-/.test(className)) {
      log("Warning: className may override layout width/height:", className);
    }
  }, [className]);

  // Handle image load/error
  const onLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    log("image loaded:", (e.target as HTMLImageElement).src);
    setLoaded(true);
  };
  const onError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.error("[OptimizedImage] image load error, falling back to placeholder", (e.target as HTMLImageElement).src);
    (e.target as HTMLImageElement).src = DEFAULT_PLACEHOLDER;
  };

  // If image object is clearly invalid, log a warn
  if (!img || (!img.variants && !img.formats && !img.publicId)) {
    log("Invalid/empty image object detected — will use placeholder:", img);
  }

  // Early return for missing image or variants
  if (!image || !image.variants) {
    console.error("❌ Missing image or variants for product:", productId, image);
    return <div style={{background:"#eee", padding:20}}>No Image</div>;
  }

  return (
    <div style={wrapperStyle} className={`optimized-image-root ${className}`} data-productid={productId}>
      {/* Picture with modern format sources first */}
      {inView ? (
        <picture>
          {/* Prefer AVIF, then WEBP, then JPG from formats if present */}
          {formats?.avif && <source type="image/avif" srcSet={formats.avif} />}
          {formats?.webp && <source type="image/webp" srcSet={formats.webp} />}
          {/* Use resolved src as fallback */}
          <img
            ref={imgRef}
            data-optim-product={productId || ""}
            src={src}
            srcSet={srcThumb ? `${srcThumb} 150w, ${src} 600w` : undefined}
            sizes="(max-width: 600px) 150px, 300px"
            loading={priority ? "eager" : "lazy"}
            alt={alt || ""}
            onLoad={onLoad}
            onError={onError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              opacity: loaded ? 1 : 0,
              transition: "opacity 300ms ease-in-out",
            }}
          />
        </picture>
      ) : (
        // placeholder box until inView
        <div style={{ width: "100%", height: "100%" }} aria-hidden>
          <img
            ref={imgRef}
            data-optim-product={productId || ""}
            src={srcThumb || DEFAULT_PLACEHOLDER}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(6px)",
            }}
          />
        </div>
      )}
    </div>
  );
}
