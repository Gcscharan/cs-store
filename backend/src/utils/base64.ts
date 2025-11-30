/**
 * Backend Base64 Image Utilities
 * 
 * These utilities are used for image processing and migration scripts.
 * Note: For production use, you might want to use a proper image processing library
 * like Sharp for better performance and quality.
 */

import { createWriteStream, existsSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import fetch from 'node-fetch';

const pipelineAsync = promisify(pipeline);

/**
 * Convert a file buffer to Base64 data URL
 */
export function bufferToBase64(buffer: Buffer, mimeType: string = 'image/jpeg'): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

/**
 * Create a simple thumbnail by resizing the image
 * This is a basic implementation - for production, use Sharp or similar
 */
export async function createThumbnail(buffer: Buffer, maxSize: number = 220): Promise<Buffer> {
  // This is a placeholder implementation
  // In a real production environment, you would use Sharp or another image processing library
  
  // For now, just return the original buffer (no actual resizing)
  // This maintains compatibility while allowing the migration script to work
  console.warn("⚠️  Using placeholder thumbnail generation. Consider implementing proper image processing with Sharp.");
  
  return buffer;
}

/**
 * Convert Base64 to File-like object (for migration script compatibility)
 */
export function base64ToFile(dataUrl: string): Buffer {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = Buffer.from(arr[1], 'base64');
  
  return bstr;
}

/**
 * Generate thumbnail from Base64 image
 */
export async function fileToThumbnailBase64(buffer: Buffer): Promise<string> {
  try {
    const thumbnailBuffer = await createThumbnail(buffer, 220);
    return bufferToBase64(thumbnailBuffer, 'image/jpeg');
  } catch (error) {
    console.error("Failed to generate thumbnail:", error);
    throw error;
  }
}

/**
 * Convert File-like object buffer to Base64 (for migration script compatibility)
 */
export async function migrateThumbnailFromBuffer(buffer: Buffer): Promise<string> {
  return fileToThumbnailBase64(buffer);
}

/**
 * Fetch image from URL and convert to Base64
 */
export async function urlToBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const buffer = await response.buffer();
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    
    return bufferToBase64(buffer, mimeType);
  } catch (error) {
    console.error(`Failed to convert URL to Base64: ${imageUrl}`, error);
    throw error;
  }
}

/**
 * Download image from URL to file
 */
export async function downloadImage(url: string, filepath: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    if (!response.body) throw new Error("No response body");
    await pipelineAsync(response.body as any, createWriteStream(filepath));
  } catch (error) {
    console.error(`Failed to download image: ${url}`, error);
    throw error;
  }
}

/**
 * Get image dimensions and metadata
 */
export async function getImageMetadata(buffer: Buffer): Promise<{
  width: number;
  height: number;
  size: number;
  format: string;
}> {
  // This is a placeholder implementation
  // In production, you would use a proper image library to extract metadata
  
  return {
    width: 800, // Default assumption
    height: 600, // Default assumption
    size: buffer.length,
    format: 'jpeg'
  };
}
