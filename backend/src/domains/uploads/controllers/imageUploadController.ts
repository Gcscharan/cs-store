import { logger } from '../../../utils/logger';
import { Request, Response } from 'express';
import { MediaImageService } from '../../media/services/MediaImageService';

const mediaService = new MediaImageService();

/**
 * Upload images to Cloudinary
 * POST /api/upload/images
 * 
 * This endpoint ONLY handles image uploads.
 * No product logic. No DB writes.
 * Returns secure URLs for later use.
 */
export const uploadImages = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    const userId = (req as any).user?._id;
    
    console.log('📤 Uploading images:', {
      fileCount: files.length,
      userId,
      timestamp: new Date().toISOString(),
    });
    
    logger.info('📤 [ImageUpload] Upload request received:', {
      fileCount: files.length,
      userId,
    });

    // Validation: No files provided
    if (files.length === 0) {
      logger.warn('⚠️ [ImageUpload] No files provided');
      return res.status(400).json({
        success: false,
        message: 'No images provided',
      });
    }

    // Filter valid image files
    const validFiles = files.filter(
      f => f && 
      (f.size ?? 0) > 0 && 
      /^image\/(jpeg|png|webp|avif)$/.test(f.mimetype ?? '')
    );

    logger.info('📤 [ImageUpload] Valid files after filter:', {
      total: files.length,
      valid: validFiles.length,
      invalid: files.length - validFiles.length,
    });

    // Validation: No valid images
    if (validFiles.length === 0) {
      logger.warn('⚠️ [ImageUpload] No valid images (empty or invalid mimetype)');
      return res.status(400).json({
        success: false,
        message: 'No valid images (must be JPEG, PNG, WEBP, or AVIF)',
      });
    }

    // Extract buffers for upload
    const buffers = validFiles
      .filter(f => f.buffer && f.buffer.length > 0)
      .map(f => f.buffer);

    if (buffers.length === 0) {
      logger.warn('⚠️ [ImageUpload] No valid buffers extracted');
      return res.status(400).json({
        success: false,
        message: 'Failed to process image files',
      });
    }

    // Upload to Cloudinary
    let uploadedImages;
    try {
      logger.info('☁️ [ImageUpload] Starting Cloudinary upload...', {
        count: buffers.length,
      });
      
      uploadedImages = await mediaService.uploadBuffersWithVariants(
        buffers,
        { folder: 'products' }
      );
      
      logger.info('✅ [ImageUpload] Cloudinary upload successful:', {
        uploaded: uploadedImages.length,
      });
    } catch (uploadError: any) {
      logger.error('❌ [ImageUpload] Cloudinary upload failed:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Image upload failed',
        error: uploadError?.message ?? String(uploadError),
      });
    }

    // Format response - SIMPLIFIED (frontend only needs URL)
    const images = uploadedImages.map(img => ({
      url: img.variants.original,
      status: 'uploaded',
    }));

    logger.info('✅ [ImageUpload] Upload complete:', {
      count: images.length,
    });

    return res.status(200).json({
      success: true,
      images,
    });
  } catch (error: any) {
    logger.error('❌ [ImageUpload] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during image upload',
      error: error?.message ?? String(error),
    });
  }
};
