import mongoose from 'mongoose';
import { VideoRegistry } from '../VideoRegistry';
import { TemporaryUpload } from '../TemporaryUpload';
import { PendingDeletion } from '../PendingDeletion';

describe('Video Data Models', () => {
  afterEach(async () => {
    await VideoRegistry.deleteMany({});
    await TemporaryUpload.deleteMany({});
    await PendingDeletion.deleteMany({});
  });

  describe('VideoRegistry Model', () => {
    it('should create a video registry entry with all required fields', async () => {
      const videoData = {
        hash: 'a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7',
        publicId: 'products/videos/test123',
        url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test123.mp4',
        thumbnail: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test123.jpg',
        duration: 15.5,
      };

      const video = await VideoRegistry.create(videoData);

      expect(video.hash).toBe(videoData.hash);
      expect(video.publicId).toBe(videoData.publicId);
      expect(video.url).toBe(videoData.url);
      expect(video.thumbnail).toBe(videoData.thumbnail);
      expect(video.duration).toBe(videoData.duration);
      expect(video.referenceCount).toBe(1); // Default value
      expect(video.uploadedAt).toBeInstanceOf(Date);
    });

    it('should enforce unique hash constraint', async () => {
      const videoData = {
        hash: 'unique_hash_123',
        publicId: 'products/videos/test1',
        url: 'https://example.com/video1.mp4',
        thumbnail: 'https://example.com/thumb1.jpg',
        duration: 10,
      };

      await VideoRegistry.create(videoData);

      // Attempt to create duplicate with same hash
      await expect(
        VideoRegistry.create({
          ...videoData,
          publicId: 'products/videos/test2', // Different publicId
        })
      ).rejects.toThrow();
    });

    it('should enforce unique publicId constraint', async () => {
      const videoData = {
        hash: 'hash_123',
        publicId: 'products/videos/unique_public_id',
        url: 'https://example.com/video1.mp4',
        thumbnail: 'https://example.com/thumb1.jpg',
        duration: 10,
      };

      await VideoRegistry.create(videoData);

      // Attempt to create duplicate with same publicId
      await expect(
        VideoRegistry.create({
          ...videoData,
          hash: 'different_hash_456', // Different hash
        })
      ).rejects.toThrow();
    });

    it('should validate non-empty string fields', async () => {
      const invalidData = {
        hash: '',
        publicId: 'products/videos/test',
        url: 'https://example.com/video.mp4',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: 10,
      };

      await expect(VideoRegistry.create(invalidData)).rejects.toThrow();
    });

    it('should validate duration is non-negative', async () => {
      const invalidData = {
        hash: 'hash_123',
        publicId: 'products/videos/test',
        url: 'https://example.com/video.mp4',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: -5,
      };

      await expect(VideoRegistry.create(invalidData)).rejects.toThrow();
    });

    it('should prevent negative referenceCount', async () => {
      const video = await VideoRegistry.create({
        hash: 'hash_123',
        publicId: 'products/videos/test',
        url: 'https://example.com/video.mp4',
        thumbnail: 'https://example.com/thumb.jpg',
        duration: 10,
        referenceCount: 1,
      });

      video.referenceCount = -1;
      await expect(video.save()).rejects.toThrow();
    });
  });

  describe('TemporaryUpload Model', () => {
    it('should create a temporary upload entry with all required fields', async () => {
      const userId = new mongoose.Types.ObjectId();
      const uploadData = {
        publicId: 'products/videos/temp123',
        uploadedBy: userId,
      };

      const upload = await TemporaryUpload.create(uploadData);

      expect(upload.publicId).toBe(uploadData.publicId);
      expect(upload.uploadedBy.toString()).toBe(userId.toString());
      expect(upload.status).toBe('temporary'); // Default value
      expect(upload.uploadedAt).toBeInstanceOf(Date);
    });

    it('should enforce unique publicId constraint', async () => {
      const userId = new mongoose.Types.ObjectId();
      const uploadData = {
        publicId: 'products/videos/unique_temp',
        uploadedBy: userId,
      };

      await TemporaryUpload.create(uploadData);

      // Attempt to create duplicate
      await expect(TemporaryUpload.create(uploadData)).rejects.toThrow();
    });

    it('should validate status enum values', async () => {
      const userId = new mongoose.Types.ObjectId();
      const invalidData = {
        publicId: 'products/videos/temp',
        uploadedBy: userId,
        status: 'invalid_status' as any,
      };

      await expect(TemporaryUpload.create(invalidData)).rejects.toThrow();
    });

    it('should allow status to be updated from temporary to permanent', async () => {
      const userId = new mongoose.Types.ObjectId();
      const upload = await TemporaryUpload.create({
        publicId: 'products/videos/temp',
        uploadedBy: userId,
      });

      expect(upload.status).toBe('temporary');

      upload.status = 'permanent';
      await upload.save();

      const updated = await TemporaryUpload.findById(upload._id);
      expect(updated?.status).toBe('permanent');
    });

    it('should validate non-empty publicId', async () => {
      const userId = new mongoose.Types.ObjectId();
      const invalidData = {
        publicId: '',
        uploadedBy: userId,
      };

      await expect(TemporaryUpload.create(invalidData)).rejects.toThrow();
    });
  });

  describe('PendingDeletion Model', () => {
    it('should create a pending deletion entry with all required fields', async () => {
      const productId = new mongoose.Types.ObjectId();
      const deletionData = {
        publicId: 'products/videos/delete123',
        reason: 'video_replaced' as const,
        productId,
      };

      const deletion = await PendingDeletion.create(deletionData);

      expect(deletion.publicId).toBe(deletionData.publicId);
      expect(deletion.reason).toBe(deletionData.reason);
      expect(deletion.productId?.toString()).toBe(productId.toString());
      expect(deletion.retryCount).toBe(0); // Default value
      expect(deletion.markedForDeletionAt).toBeInstanceOf(Date);
    });

    it('should enforce unique publicId constraint', async () => {
      const deletionData = {
        publicId: 'products/videos/unique_delete',
        reason: 'product_deleted' as const,
      };

      await PendingDeletion.create(deletionData);

      // Attempt to create duplicate
      await expect(PendingDeletion.create(deletionData)).rejects.toThrow();
    });

    it('should validate reason enum values', async () => {
      const invalidData = {
        publicId: 'products/videos/delete',
        reason: 'invalid_reason' as any,
      };

      await expect(PendingDeletion.create(invalidData)).rejects.toThrow();
    });

    it('should allow all valid reason values', async () => {
      const reasons: Array<'product_deleted' | 'video_replaced' | 'orphan_cleanup'> = [
        'product_deleted',
        'video_replaced',
        'orphan_cleanup',
      ];

      for (const reason of reasons) {
        const deletion = await PendingDeletion.create({
          publicId: `products/videos/delete_${reason}`,
          reason,
        });
        expect(deletion.reason).toBe(reason);
      }
    });

    it('should validate non-negative retryCount', async () => {
      const invalidData = {
        publicId: 'products/videos/delete',
        reason: 'product_deleted' as const,
        retryCount: -1,
      };

      await expect(PendingDeletion.create(invalidData)).rejects.toThrow();
    });

    it('should allow productId to be optional', async () => {
      const deletion = await PendingDeletion.create({
        publicId: 'products/videos/delete',
        reason: 'orphan_cleanup',
        // No productId provided
      });

      expect(deletion.productId).toBeUndefined();
    });

    it('should validate non-empty publicId', async () => {
      const invalidData = {
        publicId: '',
        reason: 'product_deleted' as const,
      };

      await expect(PendingDeletion.create(invalidData)).rejects.toThrow();
    });
  });

  describe('Index Verification', () => {
    it('should have correct indexes on VideoRegistry', async () => {
      const indexes = await VideoRegistry.collection.getIndexes();
      
      expect(indexes).toHaveProperty('hash_1');
      expect(indexes).toHaveProperty('publicId_1');
      expect(indexes).toHaveProperty('referenceCount_1');
    });

    it('should have correct indexes on TemporaryUpload', async () => {
      const indexes = await TemporaryUpload.collection.getIndexes();
      
      expect(indexes).toHaveProperty('publicId_1');
      expect(indexes).toHaveProperty('status_1_uploadedAt_1');
    });

    it('should have correct indexes on PendingDeletion', async () => {
      const indexes = await PendingDeletion.collection.getIndexes();
      
      expect(indexes).toHaveProperty('publicId_1');
      expect(indexes).toHaveProperty('markedForDeletionAt_1');
    });
  });
});
