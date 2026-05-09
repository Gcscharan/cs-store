import { Request, Response } from 'express';
import { videoService } from '../services/videoService';
import { logger } from '../utils/logger';

// Simple in-memory rate limiter (10 uploads/hour/admin)
// Map<userId, { count: number, resetAt: Date }>
const uploadRateLimits = new Map<string, { count: number; resetAt: Date }>();

const RATE_LIMIT = 10; // uploads per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

/**
 * Check and update rate limit for user
 * Returns true if allowed, false if rate limit exceeded
 */
function checkRateLimit(userId: string): boolean {
  const now = new Date();
  const userLimit = uploadRateLimits.get(userId);

  // No previous uploads or window expired
  if (!userLimit || now > userLimit.resetAt) {
    uploadRateLimits.set(userId, {
      count: 1,
      resetAt: new Date(now.getTime() + RATE_WINDOW),
    });
    return true;
  }

  // Within window - check count
  if (userLimit.count >= RATE_LIMIT) {
    return false; // Rate limit exceeded
  }

  // Increment count
  userLimit.count++;
  return true;
}

/**
 * POST /api/admin/upload/video
 * Upload video file with validation and deduplication
 */
export const uploadVideo = async (req: Request, res: Response) => {
  try {
    // Auth check (handled by middleware)
    const user = (req as any).user;
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Rate limiting check
    if (!checkRateLimit(user._id.toString())) {
      logger.warn('Rate limit exceeded for video upload', { userId: user._id });
      return res.status(429).json({ 
        message: 'Upload rate limit exceeded. Maximum 10 uploads per hour.',
        retryAfter: '1 hour'
      });
    }

    // File validation
    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    // Size validation (20MB)
    const MAX_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_SIZE) {
      return res.status(400).json({ 
        message: 'Video file size exceeds 20MB limit' 
      });
    }

    // Format validation (mp4 only)
    if (file.mimetype !== 'video/mp4') {
      return res.status(400).json({ 
        message: 'Only mp4 format is supported' 
      });
    }

    logger.info('Processing video upload', { 
      userId: user._id, 
      fileSize: file.size,
      mimetype: file.mimetype 
    });

    // Process upload (with deduplication)
    const result = await videoService.processUpload(file.buffer, user._id);

    logger.info('Video upload successful', { 
      userId: user._id, 
      publicId: result.publicId,
      deduplicated: result.deduplicated 
    });

    return res.status(200).json(result);
  } catch (error: any) {
    logger.error('Video upload failed', { 
      error: error.message, 
      userId: (req as any).user?._id 
    });
    
    return res.status(500).json({ 
      message: 'Video upload failed',
      error: error.message 
    });
  }
};
