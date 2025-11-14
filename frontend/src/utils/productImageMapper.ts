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

// Product image mappings based on product names
export const productImageMappings: ProductImageMapping = {
  // Chocolate Products
  KitKat: {
    primary:
      "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  "Snickers Bar": {
    primary:
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  "Mars Bar": {
    primary:
      "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  "Bounty Bar": {
    primary:
      "https://images.unsplash.com/photo-1551024506-0bccd828d307?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  "Milky Way": {
    primary:
      "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  "Galaxy Smooth": {
    primary:
      "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  "Ferrero Rocher": {
    primary:
      "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  Toblerone: {
    primary:
      "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  "Cadbury Dairy Milk": {
    primary:
      "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },

  // Biscuit Products
  "Parle-G Biscuits": {
    primary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
  },
  "Oreo Cookies": {
    primary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
  },
  "Good Day Biscuits": {
    primary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
  },
  "Marie Gold": {
    primary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
  },
  "Monaco Salted": {
    primary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
  },
  "Hide & Seek": {
    primary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
  },
  "Coconut Cookies": {
    primary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
  },
  "Digestive Biscuits": {
    primary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
  },
  "Cream Biscuits": {
    primary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
  },
  "Chocolate Biscuits": {
    primary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
  },

  // Ladoo Products
  "Besan Laddu": {
    primary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
  },
  "Coconut Laddu": {
    primary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
  },
  "Motichoor Laddu": {
    primary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
  },
  "Rava Laddu": {
    primary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
  },
  "Til Laddu": {
    primary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
  },
  "Dry Fruit Laddu": {
    primary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
  },
  "Gond Laddu": {
    primary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
  },
  "Churma Laddu": {
    primary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
  },
  "Kaju Laddu": {
    primary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
  },
  "Badam Laddu": {
    primary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
  },

  // Cake Products
  "Chocolate Cake": {
    primary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  "Vanilla Cake": {
    primary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  "Strawberry Cake": {
    primary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  "Red Velvet Cake": {
    primary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },
  "Cheese Cake": {
    primary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  },

  // Hot Snacks
  Samosa: {
    primary:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
  },
  Pakora: {
    primary:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
  },
  Vada: {
    primary:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
  },
  Bonda: {
    primary:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
  },
  Kachori: {
    primary:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
    secondary:
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
  },
};

// Generic fallback images for different categories
export const categoryFallbackImages = {
  chocolates:
    "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&h=400&fit=crop&crop=center",
  biscuits:
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
  ladoos:
    "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
  cakes:
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
  hot_snacks:
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
  default:
    "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=400&fit=crop&crop=center",
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
  // First, try exact name match
  const exactMatch = productImageMappings[productName];
  if (exactMatch) {
    const images = [exactMatch.primary];
    if (exactMatch.secondary) images.push(exactMatch.secondary);
    if (exactMatch.tertiary) images.push(exactMatch.tertiary);
    return images;
  }

  // Try partial name matching for common patterns
  const lowerName = productName.toLowerCase();

  // Chocolate patterns
  if (lowerName.includes("chocolate") || lowerName.includes("choco")) {
    return [
      "https://images.unsplash.com/photo-1606312619070-d48b4c652a52?w=400&h=400&fit=crop&crop=center",
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
    ];
  }

  // Biscuit patterns
  if (
    lowerName.includes("biscuit") ||
    lowerName.includes("cookie") ||
    lowerName.includes("cracker")
  ) {
    return [
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&crop=center",
    ];
  }

  // Ladoo patterns
  if (lowerName.includes("ladoo") || lowerName.includes("laddu")) {
    return [
      "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=400&fit=crop&crop=center",
    ];
  }

  // Cake patterns
  if (lowerName.includes("cake")) {
    return [
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop&crop=center",
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
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=400&h=400&fit=crop&crop=center",
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
