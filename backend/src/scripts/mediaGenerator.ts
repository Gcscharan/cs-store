import { logger } from '../utils/logger';
import { MediaValidator, MediaValidationResult } from './mediaValidator';

export interface MediaUrls {
  images: string[];
  video?: string;
}

export interface MediaGenerationOptions {
  productId: string;
  category: string;
  index: number;
  includeVideo?: boolean;
}

export class MediaGenerator {
  private validator = new MediaValidator();
  private fallbackImageUrl = 'https://picsum.photos/400';

  // Picsum.photos provides stable, seeded images
  generateImageUrl(seed: string, size = 400): string {
    return `https://picsum.photos/seed/${seed}/${size}/${size}`;
  }

  // Generate multiple image variants for a product
  async generateProductMedia(options: MediaGenerationOptions): Promise<MediaUrls> {
    const { productId, category, index, includeVideo = false } = options;

    // Generate 1-3 images per product with unique seeds
    const imageCount = 1 + (index % 3); // 1, 2, or 3 images
    const imageUrls: string[] = [];

    for (let i = 0; i < imageCount; i++) {
      const seed = `${category}-${productId}-${i}`;
      const url = this.generateImageUrl(seed);
      imageUrls.push(url);
    }

    // Validate all images
    const validationResults = await this.validator.validateBatch(imageUrls);
    const validImages = validationResults
      .filter((r) => r.isValid)
      .map((r) => r.url);

    // If all images failed, use fallback
    if (validImages.length === 0) {
      logger.warn(`⚠️ All images failed for product ${productId}, using fallback`);
      validImages.push(this.fallbackImageUrl);
    }

    // Log failed images
    const failedImages = validationResults.filter((r) => !r.isValid);
    if (failedImages.length > 0) {
      logger.warn(`⚠️ Failed images for product ${productId}:`, {
        failed: failedImages.map((r) => ({ url: r.url, error: r.error })),
      });
    }

    const result: MediaUrls = {
      images: validImages,
    };

    // Optional: Add video (skip if unavailable)
    if (includeVideo) {
      const videoUrl = await this.generateVideoUrl(category, index);
      if (videoUrl) {
        result.video = videoUrl;
      }
    }

    return result;
  }

  private async generateVideoUrl(category: string, index: number): Promise<string | undefined> {
    // Videos are explicitly optional - graceful degradation
    // Mixkit videos require authentication in some regions
    // For production, consider:
    // 1. Hosting videos on your own CDN
    // 2. Using a paid video API
    // 3. Skipping videos entirely (current approach)
    
    // Explicitly return undefined (not null) to avoid crashes
    return undefined;
  }

  // Batch validate existing URLs (for migration/cleanup)
  async validateExistingMedia(urls: string[]): Promise<MediaValidationResult[]> {
    return this.validator.validateBatch(urls);
  }
}
