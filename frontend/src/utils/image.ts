/**
 * Image utility functions for handling product images
 */

/**
 * Extracts a usable image URL from ANY image format:
 * - Cloudinary variant format (new)
 * - Dual-resolution { full, thumb }
 * - Legacy string[] URLs
 */
function extractImageUrl(img: any): string {
  if (!img) return "/placeholder-product.svg";

  // 1️⃣ Cloudinary new format
  if (img?.variants) {
    return (
      img.variants.thumb ||
      img.variants.small ||
      img.variants.micro ||
      img.variants.medium ||
      img.variants.original ||
      "/placeholder-product.svg"
    );
  }

  // 2️⃣ Dual-resolution { full, thumb }
  if (typeof img === "object") {
    return img.thumb || img.full || "/placeholder-product.svg";
  }

  // 3️⃣ Legacy string URL
  if (typeof img === "string") {
    // If relative path: prepend backend URL
    if (!img.startsWith("http") && !img.startsWith("/")) {
      return `${
        import.meta.env.VITE_API_URL || "http://localhost:5001"
      }/uploads/${img}`;
    }

    if (img.startsWith("/uploads")) {
      return `${
        import.meta.env.VITE_API_URL || "http://localhost:5001"
      }${img}`;
    }

    return img;
  }

  return "/placeholder-product.svg";
}

/**
 * Get primary thumbnail image for a product
 */
export function getProductImage(product: any): string {
  if (product?.images?.length > 0) {
    return extractImageUrl(product.images[0]);
  }

  // Fallback to legacy "image" field
  if (product?.image) return extractImageUrl(product.image);

  return "/placeholder-product.svg";
}

/**
 * Get all product images as URLs
 */
export function getProductImages(product: any): string[] {
  if (product?.images?.length > 0) {
    return product.images.map((img: any) => extractImageUrl(img));
  }

  if (product?.image) return [extractImageUrl(product.image)];

  return ["/placeholder-product.svg"];
}

/**
 * Handles image load errors by applying fallback
 */
export function handleImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  fallbackUrl: string = "/placeholder-product.svg"
) {
  const img = event.currentTarget;
  if (img.src !== fallbackUrl) img.src = fallbackUrl;
}
