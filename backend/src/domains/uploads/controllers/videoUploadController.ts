import { logger } from '../../../utils/logger';
import { Request, Response } from 'express';
import { MediaVideoService } from '../../media/services/MediaVideoService';

const videoService = new MediaVideoService();

/**
 * Upload video to Cloudinary
 * POST /api/uploads/video
 * 
 * This endpoint ONLY handles video uploads.
 * Returns secure URL, thumbnail, and duration for later use.
 */
export const uploadVideo = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const file = req.file as Express.Multer.File;
    const userId = (req as any).user?._id;
    
    console.log('📤 Uploading video:', {
      hasFile: !!file,
      userId,
      timestamp: new Date().toISOString(),
    });
    
    logger.info('📤 [VideoUpload] Upload request received:', {
      hasFile: !!file,
      userId,
    });

    // Validation: No file provided
    if (!file) {
      logger.warn('⚠️ [VideoUpload] No file provided');
      return res.status(400).json({
        success: false,
        message: 'No video provided',
      });
    }

    // Validation: Check mimetype
    if (!/^video\/(mp4|quicktime|x-msvideo|x-matroska|webm)$/.test(file.mimetype ?? '')) {
      logger.warn('⚠️ [VideoUpload] Invalid video format:', { mimetype: file.mimetype });
      return res.status(400).json({
        success: false,
        message: 'Invalid video format (must be MP4, MOV, AVI, MKV, or WEBM)',
      });
    }

    // Validation: Check file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      logger.warn('⚠️ [VideoUpload] File too large:', { size: file.size });
      return res.status(400).json({
        success: false,
        message: 'Video file too large (max 50MB)',
      });
    }

    // Validation: Check buffer
    if (!file.buffer || file.buffer.length === 0) {
      logger.warn('⚠️ [VideoUpload] No valid buffer');
      return res.status(400).json({
        success: false,
        message: 'Failed to process video file',
      });
    }

    // Upload to Cloudinary
    let uploadedVideo;
    try {
      logger.info('☁️ [VideoUpload] Starting Cloudinary upload...');
      
      uploadedVideo = await videoService.uploadBuffer(
        file.buffer,
        { folder: 'products/videos' }
      );
      
      logger.info('✅ [VideoUpload] Cloudinary upload successful');
    } catch (uploadError: any) {
      logger.error('❌ [VideoUpload] Cloudinary upload failed:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Video upload failed',
        error: uploadError?.message ?? String(uploadError),
      });
    }

    // Format response
    const video = {
      url: uploadedVideo.url,
      thumbnail: uploadedVideo.thumbnail,
      duration: uploadedVideo.duration,
      status: 'uploaded',
    };

    logger.info('✅ [VideoUpload] Upload complete:', {
      url: video.url,
      duration: video.duration,
    });

    return res.status(200).json({
      success: true,
      video,
    });
  } catch (error: any) {
    logger.error('❌ [VideoUpload] Unexpected error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during video upload',
      error: error?.message ?? String(error),
    });
  }
};
