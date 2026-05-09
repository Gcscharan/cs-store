/**
 * Product Image Standards — shared validation constants and server-side validator.
 *
 * Standards:
 *  - Aspect ratio  : 1:1 (square)
 *  - Min resolution: 600 × 600 px
 *  - Max resolution: 1080 × 1080 px (auto-resize above this)
 *  - Hard pixel cap: 4000 × 4000 px (reject before Sharp processes it)
 *  - Formats       : JPEG / WebP only (all output normalised to WebP)
 *  - Max file size : 500 KB  (checked BEFORE compression)
 *  - Compression   : WebP q75 → target ~80–200 KB
 */

import sharp from 'sharp';

// ─── Constants ────────────────────────────────────────────────────────────────

export const PRODUCT_IMAGE_STANDARDS = {
  /** Accepted MIME types */
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/webp'] as const,
  /** Accepted file extensions (lower-case) */
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.webp'] as const,
  /** Maximum raw upload size in bytes (500 KB) — checked before compression */
  MAX_FILE_SIZE_BYTES: 500 * 1024,
  /** Minimum width/height in pixels */
  MIN_DIMENSION: 600,
  /** Maximum width/height — images above this are resized down */
  MAX_DIMENSION: 1080,
  /**
   * Hard upper pixel guard — reject before Sharp even tries to process.
   * Prevents memory spikes / Sharp crashes from absurdly large inputs.
   */
  MAX_INPUT_DIMENSION: 4000,
  /** Tolerance for aspect-ratio check (allows ±1 px rounding) */
  ASPECT_RATIO_TOLERANCE: 1,
  /** WebP compression quality (0–100). 75 → ~80–200 KB at 1080×1080 */
  WEBP_QUALITY: 75,
  /** WebP encoding effort (0–6). 4 = good balance of speed vs size */
  WEBP_EFFORT: 4,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImageValidationResult {
  valid: boolean;
  errors: string[];
  /** Processed buffer (resized + compressed to WebP) — only present when valid === true */
  processedBuffer?: Buffer;
  /** Final dimensions after processing */
  width?: number;
  height?: number;
  /** Final size in bytes after compression */
  finalSizeBytes?: number;
}

// ─── Server-side validator (uses Sharp) ───────────────────────────────────────

/**
 * Validates, resizes, and compresses a product image buffer.
 * All output is normalised to WebP for consistent format and smaller file sizes.
 *
 * Pipeline (in order):
 *  1. MIME type must be JPEG or WebP
 *  2. Raw file size must be ≤ 500 KB
 *  3. Read dimensions via Sharp metadata
 *  4. Hard pixel guard: reject if either dimension > MAX_INPUT_DIMENSION (4000 px)
 *  5. Aspect-ratio must be 1:1 (± tolerance); optionally center-crop
 *  6. Width/height must be ≥ MIN_DIMENSION
 *  7. Resize to MAX_DIMENSION if larger (no stretching)
 *  8. Compress to WebP q75 — always applied, output is always WebP
 *
 * @param buffer          Raw file buffer
 * @param mimeType        MIME type reported by multer
 * @param enableCenterCrop  When true, non-square images are center-cropped to
 *                          square instead of rejected. Defaults to false.
 */
export async function validateAndProcessProductImage(
  buffer: Buffer,
  mimeType: string,
  enableCenterCrop = false,
): Promise<ImageValidationResult> {
  const errors: string[] = [];
  const {
    ALLOWED_MIME_TYPES,
    MAX_FILE_SIZE_BYTES,
    MIN_DIMENSION,
    MAX_DIMENSION,
    MAX_INPUT_DIMENSION,
    ASPECT_RATIO_TOLERANCE,
    WEBP_QUALITY,
    WEBP_EFFORT,
  } = PRODUCT_IMAGE_STANDARDS;

  // 1. Format check
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    errors.push(`Invalid format "${mimeType}". Only JPEG and WebP are accepted.`);
    return { valid: false, errors };
  }

  // 2. Raw file size check (before compression)
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    const kb = Math.round(buffer.length / 1024);
    errors.push(`File size ${kb} KB exceeds the 500 KB limit.`);
    return { valid: false, errors };
  }

  // 3. Read metadata
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    errors.push('Could not read image metadata. The file may be corrupt.');
    return { valid: false, errors };
  }

  const { width = 0, height = 0 } = metadata;

  // 4. Hard pixel guard — must come before any Sharp processing
  if (width > MAX_INPUT_DIMENSION || height > MAX_INPUT_DIMENSION) {
    errors.push(
      `Image dimensions ${width}×${height} are too large. ` +
        `Maximum allowed input is ${MAX_INPUT_DIMENSION}×${MAX_INPUT_DIMENSION} px.`,
    );
    return { valid: false, errors };
  }

  // 5. Aspect-ratio check
  const diff = Math.abs(width - height);
  if (diff > ASPECT_RATIO_TOLERANCE) {
    if (!enableCenterCrop) {
      errors.push(
        `Image must be square (1:1). Got ${width}×${height}. ` +
          'Please crop to a square before uploading.',
      );
      return { valid: false, errors };
    }
    // Center-crop to square
    const side = Math.min(width, height);
    const left = Math.floor((width - side) / 2);
    const top = Math.floor((height - side) / 2);
    buffer = await sharp(buffer).extract({ left, top, width: side, height: side }).toBuffer();
  }

  // 6. Minimum resolution check
  const effectiveSide = Math.min(width, height);
  if (effectiveSide < MIN_DIMENSION) {
    errors.push(
      `Image resolution ${width}×${height} is below the minimum ${MIN_DIMENSION}×${MIN_DIMENSION} px.`,
    );
    return { valid: false, errors };
  }

  // 7 + 8. Resize (if needed) + compress to WebP — single Sharp pipeline
  const needsResize = effectiveSide > MAX_DIMENSION;
  const targetSize = needsResize ? MAX_DIMENSION : effectiveSide;
  const finalWidth = targetSize;
  const finalHeight = targetSize;

  const processedBuffer = await sharp(buffer)
    // Fix EXIF orientation before any transform (phone photos often need this)
    .rotate()
    .resize(targetSize, targetSize, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    // Normalise ALL output to WebP — 30–50% smaller than JPEG, consistent format
    .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
    .toBuffer();

  return {
    valid: true,
    errors: [],
    processedBuffer,
    width: finalWidth,
    height: finalHeight,
    finalSizeBytes: processedBuffer.length,
  };
}

// ─── Client-side validation helper (no Sharp — browser / RN safe) ─────────────

export interface ClientImageValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Lightweight validation that can run in the browser or React Native
 * (no Sharp dependency).  Checks format, file size, and aspect ratio.
 *
 * @param file     File object (browser) or equivalent { size, type, name }
 * @param width    Image natural width in pixels
 * @param height   Image natural height in pixels
 */
export function validateProductImageClient(
  file: { size: number; type: string; name: string },
  width: number,
  height: number,
): ClientImageValidationResult {
  const errors: string[] = [];
  const { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MIN_DIMENSION, ASPECT_RATIO_TOLERANCE } =
    PRODUCT_IMAGE_STANDARDS;

  // Format
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    // Allow .jpg/.jpeg/.webp by extension as fallback (some browsers report wrong MIME)
    const extOk = ['jpg', 'jpeg', 'webp'].includes(ext);
    if (!extOk) {
      errors.push(`"${file.name}" is not a JPEG or WebP image.`);
    }
  }

  // File size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const kb = Math.round(file.size / 1024);
    errors.push(`"${file.name}" is ${kb} KB — exceeds the 500 KB limit.`);
  }

  // Aspect ratio
  const diff = Math.abs(width - height);
  if (diff > ASPECT_RATIO_TOLERANCE) {
    errors.push(
      `"${file.name}" is not square (${width}×${height}). Please crop to 1:1 before uploading.`,
    );
  }

  // Minimum resolution
  const side = Math.min(width, height);
  if (side < MIN_DIMENSION) {
    errors.push(
      `"${file.name}" is too small (${width}×${height}). Minimum is ${MIN_DIMENSION}×${MIN_DIMENSION} px.`,
    );
  }

  return { valid: errors.length === 0, errors };
}
