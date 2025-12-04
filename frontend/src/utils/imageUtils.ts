/**
 * Image utility functions for handling product images
 */

/**
 * Gets the primary image URL for a product
 * Backend uses `images: string[]` field
 * @param product - Product object with images array
 * @returns Primary image URL or fallback
 */
export function getProductImage(product: any): string {
  // If product has images array, use the first image
  if (product?.images && Array.isArray(product.images) && product.images.length > 0) {
    const firstImage = product.images[0];
    
    // Handle new dual-resolution format
    if (typeof firstImage === 'object' && firstImage !== null) {
      return firstImage.thumb || firstImage.full || '/placeholder-product.svg';
    }
    
    // Handle legacy string array format
    if (typeof firstImage === 'string') {
      const imageUrl = firstImage;
      
      // If the image URL is relative (doesn't start with http), prepend backend URL
      if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
        return `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/uploads/${imageUrl}`;
      }
      
      // If it starts with /uploads, ensure it has the full backend URL
      if (imageUrl && imageUrl.startsWith('/uploads')) {
        return `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${imageUrl}`;
      }
      
      return imageUrl || '/placeholder-product.svg';
    }
  }
  
  // Fallback to legacy image field if it exists
  if (product?.image) {
    const imageUrl = product.image;
    
    // Apply same URL transformation
    if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
      return `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/uploads/${imageUrl}`;
    }
    
    if (imageUrl && imageUrl.startsWith('/uploads')) {
      return `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${imageUrl}`;
    }
    
    return imageUrl;
  }
  
  // Final fallback
  return '/placeholder-product.svg';
}

/**
 * Gets all image URLs for a product
 * @param product - Product object with images array
 * @returns Array of image URLs
 */
export function getProductImages(product: any): string[] {
  if (product?.images && Array.isArray(product.images) && product.images.length > 0) {
    return product.images.map((img: any) => {
      // Handle new dual-resolution format
      if (typeof img === 'object' && img !== null) {
        return img.thumb || img.full || '/placeholder-product.svg';
      }
      
      // Handle legacy string format
      if (typeof img === 'string') {
        if (img && !img.startsWith('http') && !img.startsWith('/')) {
          return `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/uploads/${img}`;
        }
        if (img && img.startsWith('/uploads')) {
          return `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${img}`;
        }
        return img;
      }
      
      return '/placeholder-product.svg';
    });
  }
  
  // Fallback to legacy single image field
  if (product?.image) {
    const img = product.image;
    if (img && !img.startsWith('http') && !img.startsWith('/')) {
      return [`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/uploads/${img}`];
    }
    if (img && img.startsWith('/uploads')) {
      return [`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${img}`];
    }
    return [img];
  }
  
  return ['/placeholder-product.svg'];
}

/**
 * Handles image error by setting fallback
 * @param event - Error event from img element
 * @param fallbackUrl - Fallback image URL (optional)
 */
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement>, fallbackUrl: string = '/placeholder-product.svg') {
  const img = event.currentTarget;
  if (img.src !== fallbackUrl) {
    img.src = fallbackUrl;
  }
}
