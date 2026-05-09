import crypto from 'crypto';
import { VideoRegistry } from '../models/VideoRegistry';
import { TemporaryUpload } from '../models/TemporaryUpload';
import { PendingDeletion } from '../models/PendingDeletion';
import { cloudinaryService } from './cloudinaryService';
import { logger } from '../utils/logger';

export interface VideoUploadResult {
  url: string;
  thumbnail: string;
  publicId: string;
  hash: string;
  duration: number;
  deduplicated: boolean;
}

export class VideoService {
  /**
   * Process video upload with deduplication
   * Simple version - gets the job done
   */
  async processUpload(file: Buffer, userId: string): Promise<VideoUploadResult> {
    try {
      // Step 1: Calculate SHA-256 hash
      const hash = crypto.createHash('sha256').update(file).digest('hex');
      logger.info('Video hash calculated', { hash });

      // Step 2: Check if video already exists in registry
      const existingVideo = await VideoRegistry.findOne({ hash });

      if (existingVideo) {
        // Video already exists - increment reference count and return
        logger.info('Video already exists - deduplicating', { hash, publicId: existingVideo.publicId });
        
        await VideoRegistry.findByIdAndUpdate(
          existingVideo._id,
          { $inc: { referenceCount: 1 } }
        );

        return {
          url: existingVideo.url,
          thumbnail: existingVideo.thumbnail,
          publicId: existingVideo.publicId,
          hash: existingVideo.hash,
          duration: existingVideo.duration,
          deduplicated: true,
        };
      }

      // Step 3: Upload to Cloudinary (new video)
      logger.info('Uploading new video to Cloudinary', { hash });
      const cloudinaryResult = await cloudinaryService.uploadVideo(file);

      // Step 4: Save to VideoRegistry
      const registryEntry = await VideoRegistry.create({
        hash,
        publicId: cloudinaryResult.publicId,
        url: cloudinaryResult.url,
        thumbnail: cloudinaryResult.thumbnail,
        duration: cloudinaryResult.duration,
        uploadedAt: new Date(),
        referenceCount: 1,
      });

      logger.info('Video saved to registry', { publicId: registryEntry.publicId });

      // Step 5: Create TemporaryUpload entry
      await TemporaryUpload.create({
        publicId: cloudinaryResult.publicId,
        uploadedAt: new Date(),
        status: 'temporary',
        uploadedBy: userId,
      });

      logger.info('Temporary upload entry created', { publicId: cloudinaryResult.publicId });

      return {
        url: cloudinaryResult.url,
        thumbnail: cloudinaryResult.thumbnail,
        publicId: cloudinaryResult.publicId,
        hash,
        duration: cloudinaryResult.duration,
        deduplicated: false,
      };
    } catch (error: any) {
      logger.error('Video upload processing failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Mark video as permanent when product is saved
   */
  async markPermanent(publicId: string): Promise<void> {
    try {
      await TemporaryUpload.findOneAndUpdate(
        { publicId },
        { status: 'permanent' }
      );
      logger.info('Video marked as permanent', { publicId });
    } catch (error: any) {
      logger.error('Failed to mark video as permanent', { publicId, error: error.message });
      throw error;
    }
  }

  /**
   * Mark video for deletion (decrement refCount, create pending deletion if 0)
   * Uses atomic operations to prevent race conditions
   */
  async markForDeletion(
    publicId: string,
    reason: 'video_replaced' | 'product_deleted',
    productId?: string
  ): Promise<void> {
    try {
      // Atomic decrement - only if refCount > 0
      const registry = await VideoRegistry.findOneAndUpdate(
        { publicId, referenceCount: { $gt: 0 } },
        { $inc: { referenceCount: -1 } },
        { new: true }
      );

      if (!registry) {
        logger.warn('Video not found or refCount already 0', { publicId });
        return;
      }

      logger.info('Video refCount decremented', { 
        publicId, 
        newRefCount: registry.referenceCount 
      });

      // Only mark for deletion if no one is using it
      if (registry.referenceCount === 0) {
        await PendingDeletion.create({
          publicId,
          reason,
          productId,
          markedForDeletionAt: new Date(),
          retryCount: 0,
        });

        logger.info('Video marked for deletion', { publicId, reason });
      }
    } catch (error: any) {
      logger.error('Failed to mark video for deletion', { 
        publicId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Clean up orphaned temporary uploads (>2 hours old)
   * Batch size limited to 100 to prevent server spikes
   */
  async cleanupOrphans(): Promise<number> {
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const BATCH_SIZE = 100;

    try {
      const orphans = await TemporaryUpload.find({
        status: 'temporary',
        uploadedAt: { $lt: new Date(Date.now() - TWO_HOURS) }
      }).limit(BATCH_SIZE);

      logger.info('Starting orphan cleanup', { found: orphans.length });

      let deleted = 0;
      for (const upload of orphans) {
        try {
          await cloudinaryService.deleteVideo(upload.publicId);
          await TemporaryUpload.deleteOne({ _id: upload._id });
          deleted++;
          logger.info('Deleted orphan video', { publicId: upload.publicId });
        } catch (error: any) {
          logger.error('Failed to delete orphan', { 
            publicId: upload.publicId, 
            error: error.message 
          });
        }
      }

      logger.info('Orphan cleanup complete', { deleted, total: orphans.length });
      return deleted;
    } catch (error: any) {
      logger.error('Orphan cleanup failed', { error: error.message });
      return 0;
    }
  }

  /**
   * Execute hard deletes for videos marked >24 hours ago
   * Batch size limited to 100 to prevent server spikes
   * Uses atomic locking to prevent race conditions during deletion
   * Uses soft delete marker for audit trail and consistency
   */
  async executePendingDeletions(): Promise<number> {
    const DAY = 24 * 60 * 60 * 1000;
    const BATCH_SIZE = 100;

    try {
      const items = await PendingDeletion.find({
        markedForDeletionAt: { $lt: new Date(Date.now() - DAY) }
      }).limit(BATCH_SIZE);

      logger.info('Starting pending deletion cleanup', { found: items.length });

      let deleted = 0;
      let cancelled = 0;
      
      for (const item of items) {
        try {
          // ATOMIC LOCK: Acquire deletion lock only if refCount = 0
          // This prevents race conditions where refCount changes between check and delete
          const registry = await VideoRegistry.findOneAndUpdate(
            { 
              publicId: item.publicId, 
              referenceCount: 0,
              lockedForDeletion: { $ne: true } // Not already locked
            },
            { $set: { lockedForDeletion: true } },
            { new: true }
          );
          
          if (!registry) {
            // Either: video doesn't exist, refCount > 0, or already locked
            // Check if video exists to determine reason
            const existingVideo = await VideoRegistry.findOne({ publicId: item.publicId });
            
            if (!existingVideo) {
              // Video already deleted manually - clean up pending entry
              await PendingDeletion.deleteOne({ _id: item._id });
              logger.info('Video already deleted, removing from pending', { 
                publicId: item.publicId 
              });
            } else if (existingVideo.referenceCount > 0) {
              // Video was restored (refCount incremented) - cancel deletion
              await PendingDeletion.deleteOne({ _id: item._id });
              cancelled++;
              logger.info('Video restored, cancelling deletion', { 
                publicId: item.publicId,
                refCount: existingVideo.referenceCount,
                reason: item.reason
              });
            } else if (existingVideo.lockedForDeletion) {
              // Already being processed by another cleanup run - skip
              logger.info('Video already locked for deletion, skipping', { 
                publicId: item.publicId 
              });
            }
            continue;
          }
          
          // Lock acquired - proceed with deletion
          // Step 1: Delete from Cloudinary
          await cloudinaryService.deleteVideo(item.publicId);
          
          // Step 2: Mark as deleted in DB (soft delete for audit trail)
          // This ensures consistency even if subsequent operations fail
          await VideoRegistry.findOneAndUpdate(
            { publicId: item.publicId },
            { 
              $set: { 
                deletedAt: new Date(),
                lockedForDeletion: false // Release lock
              } 
            }
          );
          
          // Step 3: Clean up pending deletion entry
          await PendingDeletion.deleteOne({ _id: item._id });
          
          deleted++;
          logger.info('Hard deleted video from Cloudinary, marked in DB', { 
            publicId: item.publicId, 
            reason: item.reason 
          });
        } catch (error: any) {
          logger.error('Failed to hard delete video', { 
            publicId: item.publicId, 
            error: error.message 
          });
          
          // Release lock on failure
          await VideoRegistry.findOneAndUpdate(
            { publicId: item.publicId },
            { $set: { lockedForDeletion: false } }
          );
          
          // Increment retry count
          await PendingDeletion.findByIdAndUpdate(item._id, {
            $inc: { retryCount: 1 }
          });

          // Alert on 3rd failure
          if (item.retryCount >= 2) {
            logger.error('CRITICAL: Video deletion failed 3 times', { 
              publicId: item.publicId 
            });
          }
        }
      }

      logger.info('Pending deletion cleanup complete', { 
        deleted, 
        cancelled,
        total: items.length 
      });
      return deleted;
    } catch (error: any) {
      logger.error('Pending deletion cleanup failed', { error: error.message });
      return 0;
    }
  }

  /**
   * Clean up soft-deleted entries from VideoRegistry
   * Runs after executePendingDeletions to remove DB entries
   * Separate step ensures Cloudinary deletion completes first
   */
  async cleanupSoftDeleted(): Promise<number> {
    const BATCH_SIZE = 100;

    try {
      // Find videos marked as deleted >1 hour ago (grace period for verification)
      const ONE_HOUR = 60 * 60 * 1000;
      const softDeleted = await VideoRegistry.find({
        deletedAt: { $exists: true, $lt: new Date(Date.now() - ONE_HOUR) }
      }).limit(BATCH_SIZE);

      logger.info('Starting soft-deleted cleanup', { found: softDeleted.length });

      let cleaned = 0;
      for (const video of softDeleted) {
        try {
          await VideoRegistry.deleteOne({ _id: video._id });
          cleaned++;
          logger.info('Removed soft-deleted video from DB', { 
            publicId: video.publicId 
          });
        } catch (error: any) {
          logger.error('Failed to remove soft-deleted video', { 
            publicId: video.publicId, 
            error: error.message 
          });
        }
      }

      logger.info('Soft-deleted cleanup complete', { cleaned, total: softDeleted.length });
      return cleaned;
    } catch (error: any) {
      logger.error('Soft-deleted cleanup failed', { error: error.message });
      return 0;
    }
  }
}

// Export singleton instance
export const videoService = new VideoService();
