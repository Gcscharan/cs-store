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
  fetchPriority?: "high" | "low" | "auto";
  debug?: boolean; // prints additional logs
  productId?: string; // for better log correlation
}

const DEFAULT_PLACEHOLDER = "https://res.cloudinary.com/demo/image/upload/sample.jpg";

function looksLikeTransformSegment(seg: string): boolean {
  const s = String(seg || "").trim();
  if (!s) return false;
  if (!s.includes(",")) return false;
  return /(^|,)\s*(f_|q_|c_|w_|h_|g_|ar_|dpr_|fl_)/.test(s);
}

function isInvalidCloudinaryUploadUrl(url: string): boolean {
  const u = String(url || "").trim();
  if (!u) return true;
  if (!u.includes("res.cloudinary.com")) return false;
  const marker = "/image/upload/";
  const idx = u.indexOf(marker);
  if (idx === -1) return false;

  const after = u.slice(idx + marker.length);
  if (!after) return true;
  if (after.endsWith("/")) return true;

  const parts = after.split("/").filter(Boolean);
  if (parts.length === 0) return true;

  if (parts.length === 1) {
    const seg = parts[0] || "";
    const looksLikeTransform =
      seg.includes(",") && /(^|,)\s*(f_|q_|c_|w_|h_|g_|ar_|dpr_|fl_)/.test(seg);
    if (looksLikeTransform) return true;
  }

  return false;
}

function ensureCloudinaryAuto(url: string): string {
  const u = String(url || "");
  if (!u) return u;
  if (!u.includes("res.cloudinary.com")) return u;
  if (!u.includes("/upload/")) return u;

  const idx = u.indexOf("/upload/");
  const prefix = u.slice(0, idx + "/upload/".length);
  const rest = u.slice(idx + "/upload/".length);

  const firstSlash = rest.indexOf("/");
  if (firstSlash === -1) {
    if (looksLikeTransformSegment(rest)) return "";
    return `${prefix}f_auto,q_auto/${rest}`;
  }

  const maybeTransform = rest.slice(0, firstSlash);
  const tail = rest.slice(firstSlash + 1);

  const isVersion = /^v\d+$/.test(maybeTransform);
  const hasTransform = !isVersion && looksLikeTransformSegment(maybeTransform);
  if (hasTransform && !tail) return "";

  if (!hasTransform) return `${prefix}f_auto,q_auto/${rest}`;

  const t = maybeTransform;
  const hasFAuto = /(^|,)f_auto(,|$)/.test(t);
  const hasQAuto = /(^|,)q_auto(,|$)/.test(t);
  if (hasFAuto && hasQAuto) return u;

  const insert = [!hasFAuto ? "f_auto" : "", !hasQAuto ? "q_auto" : ""].filter(Boolean).join(",");
  const nextTransform = insert ? `${insert},${t}` : t;
  return `${prefix}${nextTransform}/${tail}`;
}

function ensureCloudinaryAutoSrcSet(srcSet: string): string {
  const s = String(srcSet || "").trim();
  if (!s) return s;

  const entries = s.split(/,(?=\s*(https?:\/\/|\/))/);
  if (entries.length <= 1) {
    const parts = s.split(/\s+/);
    const url = parts[0] || "";
    const desc = parts.slice(1).join(" ");
    const nextUrl = ensureCloudinaryAuto(url);
    return desc ? `${nextUrl} ${desc}` : nextUrl;
  }

  return entries
    .map((entry) => {
      const trimmed = entry.trim();
      if (!trimmed) return "";
      const parts = trimmed.split(/\s+/);
      const url = parts[0] || "";
      const desc = parts.slice(1).join(" ");
      const nextUrl = ensureCloudinaryAuto(url);
      return desc ? `${nextUrl} ${desc}` : nextUrl;
    })
    .filter(Boolean)
    .join(", ");
}

const DEFAULT_SIZES = "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";
const THUMB_SIZES = "(max-width: 640px) 25vw, 150px";

function buildVariantSrcSet(variants: Record<string, string | undefined>) {
  const candidates: Array<[string, number]> = [
    [variants.micro || "", 80],
    [variants.thumb || "", 150],
    [variants.small || "", 300],
    [variants.medium || "", 600],
    [variants.large || "", 900],
  ];

  const seen = new Set<string>();
  const parts: string[] = [];
  for (const [rawUrl, w] of candidates) {
    const url = ensureCloudinaryAuto(rawUrl);
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    parts.push(`${url} ${w}w`);
  }
  return parts.length ? parts.join(", ") : undefined;
}

export default function OptimizedImage({
  image,
  size = "small",
  alt = "Product image",
  className = "",
  priority = false,
  fetchPriority,
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

  useEffect(() => {
    if (debug && import.meta.env.DEV) {
      console.group(`🖼️ OptimizedImage Debug: ${productId}`);
      console.log("Received image:", image);
      console.log("Fixed img object:", img);
      console.log("Variants:", variants);
      console.log("Selected variant:", variants[size]);
      console.log("Formats:", formats);
      console.log("Metadata:", metadata);
      console.groupEnd();
    }
  }, [debug, productId, image, size]);

  // Logging helper
  const log = (...args: any[]) => {
    if (debug && import.meta.env.DEV) {
      // include productId to make logs traceable
      console.log(`[OptimizedImage] product=${productId || "unknown"}`, ...args);
    }
  };

  const imgRef = useRef<HTMLImageElement | null>(null);
  const [inView, setInView] = useState<boolean>(priority); // if priority, treat as in view

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
    if (!candidate) return DEFAULT_PLACEHOLDER;
    if (isInvalidCloudinaryUploadUrl(candidate)) return DEFAULT_PLACEHOLDER;
    return candidate;
  };

  const src = resolveUrl(size);
  const srcThumb = resolveUrl("thumb");
  const fetchPriorityProps = fetchPriority && fetchPriority !== "auto" ? ({ fetchpriority: fetchPriority } as any) : {};
  const sizesAttr = size === "micro" || size === "thumb" ? THUMB_SIZES : DEFAULT_SIZES;
  const srcSetAttr = buildVariantSrcSet(variants);

  const avifSrcSet = formats?.avif ? ensureCloudinaryAutoSrcSet(formats.avif) : "";
  const webpSrcSet = formats?.webp ? ensureCloudinaryAutoSrcSet(formats.webp) : "";
  const safeAvifSrcSet = avifSrcSet && !isInvalidCloudinaryUploadUrl(avifSrcSet.split(/\s+/)[0] || "") ? avifSrcSet : "";
  const safeWebpSrcSet = webpSrcSet && !isInvalidCloudinaryUploadUrl(webpSrcSet.split(/\s+/)[0] || "") ? webpSrcSet : "";

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
  const aspect = metadata?.aspectRatio || 1;
  const wrapperStyle: React.CSSProperties = {
    aspectRatio: aspect,
    minWidth: 1,
    minHeight: 1,
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff", // white bg for object-contain
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
  };
  const onError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    log("image load error, falling back to placeholder", (e.target as HTMLImageElement).src);
    (e.target as HTMLImageElement).src = DEFAULT_PLACEHOLDER;
  };

  // If image object is clearly invalid, log a warn
  if (!img || (!img.variants && !img.formats && !img.publicId)) {
    log("Invalid/empty image object detected — will use placeholder:", img);
  }

  // Early return for missing image or variants
  const hasRenderableImage =
    !!image &&
    (Object.keys(variants).length > 0 ||
      Object.keys(formats).length > 0 ||
      !!img.publicId);
  if (!hasRenderableImage) {
    log("Missing image data for product:", productId, image);
    return (
      <div style={wrapperStyle} className={`optimized-image-root ${className}`} data-productid={productId}>
        <img
          src={DEFAULT_PLACEHOLDER}
          alt=""
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          {...fetchPriorityProps}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      </div>
    );
  }

  return (
    <div style={wrapperStyle} className={`optimized-image-root ${className}`} data-productid={productId}>
      {/* Picture with modern format sources first */}
      {inView ? (
        <picture>
          {/* Prefer AVIF, then WEBP, then JPG from formats if present */}
          {safeAvifSrcSet && <source type="image/avif" srcSet={safeAvifSrcSet} />}
          {safeWebpSrcSet && <source type="image/webp" srcSet={safeWebpSrcSet} />}
          {/* Use resolved src as fallback */}
          <img
            ref={imgRef}
            data-optim-product={productId || ""}
            src={ensureCloudinaryAuto(src)}
            srcSet={srcSetAttr || (srcThumb ? `${ensureCloudinaryAuto(srcThumb)} 150w, ${ensureCloudinaryAuto(src)} 600w` : undefined)}
            sizes={sizesAttr}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            {...fetchPriorityProps}
            alt={alt || ""}
            onLoad={onLoad}
            onError={onError}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              opacity: 1,
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
            src={ensureCloudinaryAuto(srcThumb || DEFAULT_PLACEHOLDER)}
            alt=""
            decoding="async"
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: "blur(6px)",
            }}
          />
        </div>
      )}
    </div>
  );
}
