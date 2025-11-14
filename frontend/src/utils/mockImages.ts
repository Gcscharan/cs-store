/**
 * Mock Images Utility for CS Store
 * Provides LQIP (Low Quality Image Placeholder) placeholders for initial development
 */

export interface MockImage {
  src: string;
  lqip: string;
  alt: string;
  width: number;
  height: number;
}

// Base64 encoded LQIP placeholders (20x20px, low quality)
const LQIP_PLACEHOLDERS = {
  biscuit:
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  laddu:
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  chocolate:
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  default:
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
};

// Color schemes for different categories
const CATEGORY_COLORS = {
  biscuit: ["#FF6B6B", "#FF8E8E", "#FFB1B1"],
  laddu: ["#4ECDC4", "#7EDDD6", "#A8E6E1"],
  chocolate: ["#8B4513", "#A0522D", "#CD853F"],
  default: ["#95A5A6", "#BDC3C7", "#D5DBDB"],
};

/**
 * Generate a mock image with LQIP placeholder
 */
export const generateMockImage = (
  category: string = "default",
  name: string = "Product",
  width: number = 300,
  height: number = 300
): MockImage => {
  const colors =
    CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ||
    CATEGORY_COLORS.default;
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  // Create inline SVG placeholder instead of using external service
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="${color}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16">${name}</text>
  </svg>`;
  const base64Svg = btoa(unescape(encodeURIComponent(svg)));

  return {
    src: `data:image/svg+xml;base64,${base64Svg}`,
    lqip:
      LQIP_PLACEHOLDERS[category as keyof typeof LQIP_PLACEHOLDERS] ||
      LQIP_PLACEHOLDERS.default,
    alt: `${name} - ${category}`,
    width,
    height,
  };
};

/**
 * Generate multiple mock images for a category
 */
export const generateMockImages = (
  category: string,
  count: number = 10,
  width: number = 300,
  height: number = 300
): MockImage[] => {
  const images: MockImage[] = [];

  for (let i = 0; i < count; i++) {
    const name = `${category} ${i + 1}`;
    images.push(generateMockImage(category, name, width, height));
  }

  return images;
};

/**
 * Predefined mock images for common products
 */
export const MOCK_PRODUCT_IMAGES = {
  // Biscuit products
  biscuit: [
    generateMockImage("biscuit", "Parle-G Original", 300, 300),
    generateMockImage("biscuit", "Monaco Salted", 300, 300),
    generateMockImage("biscuit", "Good Day Cashew", 300, 300),
    generateMockImage("biscuit", "Marie Gold", 300, 300),
    generateMockImage("biscuit", "Oreo Original", 300, 300),
    generateMockImage("biscuit", "Bourbon Chocolate", 300, 300),
    generateMockImage("biscuit", "Cream Biscuits", 300, 300),
    generateMockImage("biscuit", "Digestive Biscuits", 300, 300),
    generateMockImage("biscuit", "Coconut Biscuits", 300, 300),
    generateMockImage("biscuit", "Butter Biscuits", 300, 300),
  ],

  // Laddu products
  laddu: [
    generateMockImage("laddu", "Besan Laddu", 300, 300),
    generateMockImage("laddu", "Rava Laddu", 300, 300),
    generateMockImage("laddu", "Coconut Laddu", 300, 300),
    generateMockImage("laddu", "Motichoor Laddu", 300, 300),
    generateMockImage("laddu", "Kaju Laddu", 300, 300),
    generateMockImage("laddu", "Badam Laddu", 300, 300),
    generateMockImage("laddu", "Pista Laddu", 300, 300),
    generateMockImage("laddu", "Dry Fruit Laddu", 300, 300),
    generateMockImage("laddu", "Til Laddu", 300, 300),
    generateMockImage("laddu", "Gur Laddu", 300, 300),
  ],

  // Chocolate products
  chocolate: [
    generateMockImage("chocolate", "Milk Chocolate Bar", 300, 300),
    generateMockImage("chocolate", "Dark Chocolate Bar", 300, 300),
    generateMockImage("chocolate", "White Chocolate Bar", 300, 300),
    generateMockImage("chocolate", "Chocolate Truffles", 300, 300),
    generateMockImage("chocolate", "Chocolate Coins", 300, 300),
    generateMockImage("chocolate", "Chocolate Balls", 300, 300),
    generateMockImage("chocolate", "Chocolate Cookies", 300, 300),
    generateMockImage("chocolate", "Chocolate Biscuits", 300, 300),
    generateMockImage("chocolate", "Chocolate Wafers", 300, 300),
    generateMockImage("chocolate", "Chocolate Cream", 300, 300),
  ],
};

/**
 * Get a random mock image for a category
 */
export const getRandomMockImage = (category: string): MockImage => {
  const categoryImages =
    MOCK_PRODUCT_IMAGES[category as keyof typeof MOCK_PRODUCT_IMAGES];
  if (categoryImages && categoryImages.length > 0) {
    return categoryImages[Math.floor(Math.random() * categoryImages.length)];
  }
  return generateMockImage(category);
};

/**
 * Get all mock images for a category
 */
export const getCategoryMockImages = (category: string): MockImage[] => {
  return (
    MOCK_PRODUCT_IMAGES[category as keyof typeof MOCK_PRODUCT_IMAGES] || [
      generateMockImage(category),
    ]
  );
};

/**
 * Generate a placeholder image URL with LQIP
 */
export const getPlaceholderImage = (
  text: string = "Image",
  width: number = 300,
  height: number = 300,
  backgroundColor: string = "f0f0f0",
  textColor: string = "333333"
): { src: string; lqip: string } => {
  // Create inline SVG placeholder instead of using external service
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#${backgroundColor}"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#${textColor}" font-family="Arial, sans-serif" font-size="16">${text}</text>
  </svg>`;
  const base64Svg = btoa(unescape(encodeURIComponent(svg)));
  const src = `data:image/svg+xml;base64,${base64Svg}`;

  return {
    src,
    lqip: LQIP_PLACEHOLDERS.default,
  };
};

/**
 * Generate a gradient placeholder
 */
export const getGradientPlaceholder = (
  text: string = "Image",
  width: number = 300,
  height: number = 300,
  color1: string = "FF6B6B",
  color2: string = "4ECDC4"
): { src: string; lqip: string } => {
  // Create inline SVG with gradient placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#${color1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:#${color2};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16">${text}</text>
  </svg>`;
  const base64Svg = btoa(unescape(encodeURIComponent(svg)));
  const src = `data:image/svg+xml;base64,${base64Svg}`;

  return {
    src,
    lqip: LQIP_PLACEHOLDERS.default,
  };
};

/**
 * Utility to check if an image URL is a placeholder
 */
export const isPlaceholderImage = (url: string): boolean => {
  return url.includes("via.placeholder.com") || url.includes("placeholder") || url.startsWith("data:image/svg+xml");
};

/**
 * Utility to get a fallback image if the original fails
 */
export const getFallbackImage = (category: string = "default"): MockImage => {
  return generateMockImage(category, "Image not available", 300, 300);
};

export default {
  generateMockImage,
  generateMockImages,
  getRandomMockImage,
  getCategoryMockImages,
  getPlaceholderImage,
  getGradientPlaceholder,
  isPlaceholderImage,
  getFallbackImage,
  MOCK_PRODUCT_IMAGES,
};
