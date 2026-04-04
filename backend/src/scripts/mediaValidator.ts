import axios from 'axios';
import { logger } from '../utils/logger';

export interface MediaValidationResult {
  url: string;
  isValid: boolean;
  statusCode?: number;
  error?: string;
  retries: number;
}

export interface MediaValidationStats {
  total: number;
  valid: number;
  failed: number;
  fallbackUsed: number;
}

export class MediaValidator {
  private maxRetries = 2;
  private retryDelayMs = 1000;
  private timeoutMs = 5000;

  async validateUrl(url: string, retryCount = 0): Promise<MediaValidationResult> {
    try {
      // Use GET with range header to minimize data transfer
      // Picsum.photos and many CDNs don't support HEAD requests
      const response = await axios.get(url, {
        timeout: this.timeoutMs,
        validateStatus: (status) => status < 500,
        headers: {
          'Range': 'bytes=0-0', // Request only first byte
        },
        maxRedirects: 5,
      });

      if (response.status === 200 || response.status === 206) {
        // Validate content-type to ensure it's actually an image
        const contentType = response.headers['content-type'];
        if (!contentType || !contentType.includes('image')) {
          return {
            url,
            isValid: false,
            statusCode: response.status,
            error: `Invalid content-type: ${contentType}`,
            retries: retryCount,
          };
        }

        return {
          url,
          isValid: true,
          statusCode: response.status,
          retries: retryCount,
        };
      }

      // Non-200/206 status
      if (retryCount < this.maxRetries) {
        await this.delay(this.retryDelayMs);
        return this.validateUrl(url, retryCount + 1);
      }

      return {
        url,
        isValid: false,
        statusCode: response.status,
        error: `HTTP ${response.status}`,
        retries: retryCount,
      };
    } catch (error: any) {
      if (retryCount < this.maxRetries) {
        await this.delay(this.retryDelayMs);
        return this.validateUrl(url, retryCount + 1);
      }

      return {
        url,
        isValid: false,
        error: error.message || 'Network error',
        retries: retryCount,
      };
    }
  }

  async validateBatch(urls: string[]): Promise<MediaValidationResult[]> {
    const results = await Promise.all(
      urls.map((url) => this.validateUrl(url))
    );
    return results;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  logStats(results: MediaValidationResult[]): MediaValidationStats {
    const stats: MediaValidationStats = {
      total: results.length,
      valid: results.filter((r) => r.isValid).length,
      failed: results.filter((r) => !r.isValid).length,
      fallbackUsed: 0, // Will be updated by caller
    };

    logger.info(`📊 Media Validation Stats:`, {
      total: stats.total,
      valid: stats.valid,
      failed: stats.failed,
      successRate: `${((stats.valid / stats.total) * 100).toFixed(1)}%`,
    });

    return stats;
  }
}
