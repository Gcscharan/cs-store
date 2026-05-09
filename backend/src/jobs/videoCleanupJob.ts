import cron from 'node-cron';
import { videoService } from '../services/videoService';
import { logger } from '../utils/logger';

/**
 * Video Cleanup Cron Job
 * Runs daily at midnight (00:00) to clean up orphaned and pending deletion videos
 * 
 * Schedule: 0 0 * * * (every day at 00:00)
 */
export function startVideoCleanupJob() {
  // Run daily at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('🧹 [VideoCleanupJob] Starting daily video cleanup...');
    
    try {
      // Step 1: Clean up orphaned temporary uploads (>2 hours old)
      const orphansDeleted = await videoService.cleanupOrphans();
      logger.info('🧹 [VideoCleanupJob] Orphan cleanup complete', { 
        deleted: orphansDeleted 
      });

      // Step 2: Execute pending deletions (>24 hours old)
      // This deletes from Cloudinary and marks as soft-deleted in DB
      const pendingDeleted = await videoService.executePendingDeletions();
      logger.info('🧹 [VideoCleanupJob] Pending deletion cleanup complete', { 
        deleted: pendingDeleted 
      });

      // Step 3: Clean up soft-deleted entries from DB (>1 hour after Cloudinary deletion)
      // Separate step ensures Cloudinary deletion completes first
      const softDeletedCleaned = await videoService.cleanupSoftDeleted();
      logger.info('🧹 [VideoCleanupJob] Soft-deleted cleanup complete', { 
        cleaned: softDeletedCleaned 
      });

      logger.info('✅ [VideoCleanupJob] Daily cleanup complete', {
        orphansDeleted,
        pendingDeleted,
        softDeletedCleaned,
        totalProcessed: orphansDeleted + pendingDeleted + softDeletedCleaned,
      });
    } catch (error: any) {
      logger.error('❌ [VideoCleanupJob] Daily cleanup failed', { 
        error: error.message 
      });
    }
  });

  logger.info('✅ [VideoCleanupJob] Cron job scheduled (daily at 00:00)');
}
