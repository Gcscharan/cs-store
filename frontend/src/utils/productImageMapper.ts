/**
 * Product Image Mapper
 * Maps product names to appropriate default images
 */

export interface ProductImageMapping {
  [key: string]: {
    primary: string;
    secondary?: string;
    tertiary?: string;
  };
}

// Product image mappings based on product names - using local placeholder to avoid external dependency issues
export const productImageMappings: ProductImageMapping = {
  // Chocolate Products
  KitKat: {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Snickers Bar": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Mars Bar": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Bounty Bar": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Milky Way": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Galaxy Smooth": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Ferrero Rocher": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  Toblerone: {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Cadbury Dairy Milk": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },

  // Biscuit Products
  "Parle-G Biscuits": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Oreo Cookies": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Good Day Biscuits": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Marie Gold": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Monaco Salted": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Hide & Seek": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Coconut Cookies": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Digestive Biscuits": {
    primary: "/placeholder-product.svg",
    secondary: "/placeholder-product.svg",
  },
  "Cream Biscuits": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Chocolate Biscuits": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },

  // Ladoo Products
  "Besan Laddu": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Coconut Laddu": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Motichoor Laddu": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Rava Laddu": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Til Laddu": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Dry Fruit Laddu": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Gond Laddu": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Churma Laddu": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Kaju Laddu": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Badam Laddu": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },

  // Cake Products
  "Chocolate Cake": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Vanilla Cake": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Strawberry Cake": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Red Velvet Cake": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  "Cheese Cake": {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },

  // Hot Snacks
  Samosa: {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  Pakora: {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  Vada: {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  Bonda: {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
  Kachori: {
    primary:
      "/placeholder-product.svg",
    secondary:
      "/placeholder-product.svg",
  },
};

// Generic fallback images for different categories - using local placeholder to avoid external dependency issues
export const categoryFallbackImages = {
  chocolates: "/placeholder-product.svg",
  biscuits: "/placeholder-product.svg",
  ladoos: "/placeholder-product.svg",
  cakes: "/placeholder-product.svg",
  hot_snacks: "/placeholder-product.svg",
  default: "/placeholder-product.svg",
};

/**
 * Get appropriate images for a product based on its name
 * @param productName - The name of the product
 * @param category - The category of the product (optional)
 * @returns Array of image URLs
 */
export function getProductImages(
  productName: string,
  category?: string
): string[] {
  // Handle undefined/null productName
  if (!productName) {
    return [categoryFallbackImages[category as keyof typeof categoryFallbackImages] || categoryFallbackImages.default];
  }

  // First, try exact name match
  const exactMatch = productImageMappings[productName];
  if (exactMatch) {
    const images = [exactMatch.primary];
    if (exactMatch.secondary) images.push(exactMatch.secondary);
    if (exactMatch.tertiary) images.push(exactMatch.tertiary);
    return images;
  }

  // Try partial name matching for common patterns
  const lowerName = (productName || "").toLowerCase();

  // Chocolate patterns
  if (lowerName.includes("chocolate") || lowerName.includes("choco")) {
    return [
      "/placeholder-product.svg",
      "/placeholder-product.svg",
    ];
  }

  // Biscuit patterns
  if (
    lowerName.includes("biscuit") ||
    lowerName.includes("cookie") ||
    lowerName.includes("cracker")
  ) {
    return [
      "/placeholder-product.svg",
    ];
  }

  // Ladoo patterns
  if (lowerName.includes("ladoo") || lowerName.includes("laddu")) {
    return [
      "/placeholder-product.svg",
    ];
  }

  // Cake patterns
  if (lowerName.includes("cake")) {
    return [
      "/placeholder-product.svg",
    ];
  }

  // Hot snacks patterns
  if (
    lowerName.includes("samosa") ||
    lowerName.includes("pakora") ||
    lowerName.includes("vada") ||
    lowerName.includes("bonda") ||
    lowerName.includes("kachori")
  ) {
    return [
      "/placeholder-product.svg",
    ];
  }

  // Fallback to category-based image
  if (
    category &&
    categoryFallbackImages[category as keyof typeof categoryFallbackImages]
  ) {
    return [
      categoryFallbackImages[category as keyof typeof categoryFallbackImages],
    ];
  }

  // Final fallback to generic product image
  return [categoryFallbackImages.default];
}

/**
 * Get the primary image for a product (first image in the array)
 * @param productName - The name of the product
 * @param category - The category of the product (optional)
 * @returns Primary image URL
 */
export function getProductPrimaryImage(
  productName: string,
  category?: string
): string {
  const images = getProductImages(productName, category);
  return images[0];
}
