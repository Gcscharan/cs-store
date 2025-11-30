export interface ImageVariantUrls {
  micro: string;   // 16x16 tiny blurred base64 or remote
  thumb: string;   // 150x150
  small: string;   // 300x300
  medium: string;  // 600x600
  large: string;   // 1200x1200
  original: string; // original Cloudinary URL or public_id URL
}

export interface ImageFormats {
  avif?: string;
  webp?: string;
  jpg?: string;
}

export interface ProductImage {
  id?: string; // optional internal id
  publicId?: string; // cloudinary public id if available
  variants: ImageVariantUrls;
  formats?: ImageFormats;
  metadata?: {
    width?: number;
    height?: number;
    aspectRatio?: number;
    focalPoint?: { x: number; y: number } | null;
  };
}
