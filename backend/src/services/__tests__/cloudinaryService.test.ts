/**
 * CloudinaryService Unit Tests
 * 
 * Unit tests for the CloudinaryService class, focusing on:
 * - Video upload with compression and thumbnail generation
 * - Thumbnail extraction from eager transformation
 * - Fallback to transformation API
 * - Video and thumbnail deletion
 * - Error handling for upload failures
 * 
 * Validates Requirements: 3.9, 3.10
 */

import { CloudinaryService, VideoMetadata, DeletionResult } from '../cloudinaryService';
import { v2 as cloudinary } from 'cloudinary';

// Mock cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
    url: jest.fn(),
    api: {
      resource: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

describe('CloudinaryService', () => {
  let service: CloudinaryService;
  let mockUploadStream: jest.Mock;
  let mockDestroy: jest.Mock;
  let mockUrl: jest.Mock;
  let mockResource: jest.Mock;

  beforeEach(() => {
    service = new CloudinaryService();
    mockUploadStream = cloudinary.uploader.upload_stream as jest.Mock;
    mockDestroy = cloudinary.uploader.destroy as jest.Mock;
    mockUrl = cloudinary.url as jest.Mock;
    mockResource = cloudinary.api.resource as jest.Mock;

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('uploadVideo', () => {
    it('should upload video and return correct metadata structure', async () => {
      // Arrange
      const mockFile = Buffer.from('fake-video-data');
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/abc123.mp4',
        public_id: 'products/videos/abc123',
        duration: 15.5,
        eager: [
          { secure_url: 'https://res.cloudinary.com/demo/video/upload/c_limit,h_360,w_640/v1234567890/products/videos/abc123.mp4' },
          { secure_url: 'https://res.cloudinary.com/demo/video/upload/c_fill,h_360,w_640/v1234567890/products/videos/abc123.jpg' },
        ],
      };

      // Mock upload_stream to call callback with result
      mockUploadStream.mockImplementation((options: any, callback: any) => {
        const stream = {
          end: jest.fn((buffer: Buffer) => {
            callback(null, mockResult);
          }),
        };
        return stream;
      });

      // Act
      const result = await service.uploadVideo(mockFile);

      // Assert
      expect(result).toEqual({
        url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/abc123.mp4',
        thumbnail: 'https://res.cloudinary.com/demo/video/upload/c_fill,h_360,w_640/v1234567890/products/videos/abc123.jpg',
        publicId: 'products/videos/abc123',
        duration: 15.5,
      });

      // Verify upload_stream was called with correct options
      expect(mockUploadStream).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: 'video',
          folder: 'products/videos',
          eager: [
            { width: 640, height: 360, crop: 'limit', format: 'mp4' },
            { width: 640, height: 360, crop: 'fill', format: 'jpg' },
          ],
          eager_async: false,
          transformation: [
            { quality: 'auto', fetch_format: 'auto' },
          ],
        }),
        expect.any(Function)
      );
    });

    it('should extract thumbnail from eager transformation (CRITICAL IMPROVEMENT 2)', async () => {
      // Arrange
      const mockFile = Buffer.from('fake-video-data');
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/test.mp4',
        public_id: 'products/videos/test',
        duration: 10.0,
        eager: [
          { secure_url: 'https://res.cloudinary.com/demo/video/upload/c_limit,h_360,w_640/v1234567890/products/videos/test.mp4' },
          { secure_url: 'https://res.cloudinary.com/demo/video/upload/c_fill,h_360,w_640/v1234567890/products/videos/test.jpg' },
        ],
      };

      mockUploadStream.mockImplementation((options: any, callback: any) => {
        const stream = {
          end: jest.fn((buffer: Buffer) => {
            callback(null, mockResult);
          }),
        };
        return stream;
      });

      // Act
      const result = await service.uploadVideo(mockFile);

      // Assert - Thumbnail should be from eager[1].secure_url
      expect(result.thumbnail).toBe('https://res.cloudinary.com/demo/video/upload/c_fill,h_360,w_640/v1234567890/products/videos/test.jpg');
      expect(mockUrl).not.toHaveBeenCalled(); // Should not fallback to transformation API
    });

    it('should fallback to transformation API when eager transformation fails', async () => {
      // Arrange
      const mockFile = Buffer.from('fake-video-data');
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/fallback.mp4',
        public_id: 'products/videos/fallback',
        duration: 12.0,
        eager: [], // Empty eager array - transformation failed
      };

      const fallbackThumbnailUrl = 'https://res.cloudinary.com/demo/video/upload/c_fill,h_360,w_640/products/videos/fallback.jpg';

      mockUploadStream.mockImplementation((options: any, callback: any) => {
        const stream = {
          end: jest.fn((buffer: Buffer) => {
            callback(null, mockResult);
          }),
        };
        return stream;
      });

      mockUrl.mockReturnValue(fallbackThumbnailUrl);

      // Act
      const result = await service.uploadVideo(mockFile);

      // Assert - Should use transformation API fallback
      expect(result.thumbnail).toBe(fallbackThumbnailUrl);
      expect(mockUrl).toHaveBeenCalledWith('products/videos/fallback', {
        resource_type: 'video',
        format: 'jpg',
        transformation: [
          { width: 640, height: 360, crop: 'fill' }
        ]
      });
    });

    it('should fallback to transformation API when eager has no thumbnail', async () => {
      // Arrange
      const mockFile = Buffer.from('fake-video-data');
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/no-thumb.mp4',
        public_id: 'products/videos/no-thumb',
        duration: 8.0,
        eager: [
          { secure_url: 'https://res.cloudinary.com/demo/video/upload/c_limit,h_360,w_640/v1234567890/products/videos/no-thumb.mp4' },
          // Missing second eager transformation
        ],
      };

      const fallbackThumbnailUrl = 'https://res.cloudinary.com/demo/video/upload/c_fill,h_360,w_640/products/videos/no-thumb.jpg';

      mockUploadStream.mockImplementation((options: any, callback: any) => {
        const stream = {
          end: jest.fn((buffer: Buffer) => {
            callback(null, mockResult);
          }),
        };
        return stream;
      });

      mockUrl.mockReturnValue(fallbackThumbnailUrl);

      // Act
      const result = await service.uploadVideo(mockFile);

      // Assert - Should use transformation API fallback
      expect(result.thumbnail).toBe(fallbackThumbnailUrl);
      expect(mockUrl).toHaveBeenCalled();
    });

    it('should handle upload with custom folder and publicId options', async () => {
      // Arrange
      const mockFile = Buffer.from('fake-video-data');
      const customOptions = {
        folder: 'custom/folder',
        publicId: 'custom-id-123',
      };

      const mockResult = {
        secure_url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/custom/folder/custom-id-123.mp4',
        public_id: 'custom/folder/custom-id-123',
        duration: 20.0,
        eager: [
          { secure_url: 'https://res.cloudinary.com/demo/video/upload/c_limit,h_360,w_640/v1234567890/custom/folder/custom-id-123.mp4' },
          { secure_url: 'https://res.cloudinary.com/demo/video/upload/c_fill,h_360,w_640/v1234567890/custom/folder/custom-id-123.jpg' },
        ],
      };

      mockUploadStream.mockImplementation((options: any, callback: any) => {
        const stream = {
          end: jest.fn((buffer: Buffer) => {
            callback(null, mockResult);
          }),
        };
        return stream;
      });

      // Act
      const result = await service.uploadVideo(mockFile, customOptions);

      // Assert
      expect(result.publicId).toBe('custom/folder/custom-id-123');
      expect(mockUploadStream).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: 'custom/folder',
          public_id: 'custom-id-123',
        }),
        expect.any(Function)
      );
    });

    it('should handle missing duration in upload result', async () => {
      // Arrange
      const mockFile = Buffer.from('fake-video-data');
      const mockResult = {
        secure_url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/no-duration.mp4',
        public_id: 'products/videos/no-duration',
        // duration is missing
        eager: [
          { secure_url: 'https://res.cloudinary.com/demo/video/upload/c_limit,h_360,w_640/v1234567890/products/videos/no-duration.mp4' },
          { secure_url: 'https://res.cloudinary.com/demo/video/upload/c_fill,h_360,w_640/v1234567890/products/videos/no-duration.jpg' },
        ],
      };

      mockUploadStream.mockImplementation((options: any, callback: any) => {
        const stream = {
          end: jest.fn((buffer: Buffer) => {
            callback(null, mockResult);
          }),
        };
        return stream;
      });

      // Act
      const result = await service.uploadVideo(mockFile);

      // Assert - Duration should default to 0
      expect(result.duration).toBe(0);
    });

    it('should handle error during upload', async () => {
      // Arrange
      const mockFile = Buffer.from('fake-video-data');
      const uploadError = new Error('Cloudinary upload failed: Network error');

      mockUploadStream.mockImplementation((options: any, callback: any) => {
        const stream = {
          end: jest.fn((buffer: Buffer) => {
            callback(uploadError, null);
          }),
        };
        return stream;
      });

      // Act & Assert
      await expect(service.uploadVideo(mockFile)).rejects.toThrow('Cloudinary upload failed: Network error');
    });

    it('should handle null result from upload', async () => {
      // Arrange
      const mockFile = Buffer.from('fake-video-data');

      mockUploadStream.mockImplementation((options: any, callback: any) => {
        const stream = {
          end: jest.fn((buffer: Buffer) => {
            callback(null, null); // Null result
          }),
        };
        return stream;
      });

      // Act & Assert
      await expect(service.uploadVideo(mockFile)).rejects.toThrow('Cloudinary upload returned no result');
    });
  });

  describe('deleteVideo', () => {
    it('should delete both video and thumbnail successfully', async () => {
      // Arrange
      const publicId = 'products/videos/test123';
      mockDestroy.mockResolvedValue({ result: 'ok' });

      // Act
      const result = await service.deleteVideo(publicId);

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockDestroy).toHaveBeenCalledTimes(2);
      expect(mockDestroy).toHaveBeenNthCalledWith(1, publicId, { resource_type: 'video' });
      expect(mockDestroy).toHaveBeenNthCalledWith(2, publicId, { resource_type: 'image' });
    });

    it('should succeed even if thumbnail deletion fails', async () => {
      // Arrange
      const publicId = 'products/videos/test456';
      mockDestroy
        .mockResolvedValueOnce({ result: 'ok' }) // Video deletion succeeds
        .mockRejectedValueOnce(new Error('Thumbnail not found')); // Thumbnail deletion fails

      // Act
      const result = await service.deleteVideo(publicId);

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockDestroy).toHaveBeenCalledTimes(2);
    });

    it('should return error when video deletion fails', async () => {
      // Arrange
      const publicId = 'products/videos/fail789';
      const deleteError = new Error('Cloudinary API error');
      mockDestroy.mockRejectedValue(deleteError);

      // Act
      const result = await service.deleteVideo(publicId);

      // Assert
      expect(result).toEqual({
        success: false,
        error: 'Cloudinary API error',
      });
      expect(mockDestroy).toHaveBeenCalledWith(publicId, { resource_type: 'video' });
    });

    it('should handle publicId with file extension', async () => {
      // Arrange
      const publicId = 'products/videos/test.mp4';
      mockDestroy.mockResolvedValue({ result: 'ok' });

      // Act
      const result = await service.deleteVideo(publicId);

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockDestroy).toHaveBeenCalledWith(publicId, { resource_type: 'video' });
      expect(mockDestroy).toHaveBeenCalledWith(publicId, { resource_type: 'image' });
    });
  });

  describe('getVideoMetadata', () => {
    it('should retrieve video metadata successfully', async () => {
      // Arrange
      const publicId = 'products/videos/metadata-test';
      const mockApiResult = {
        secure_url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/metadata-test.mp4',
        public_id: publicId,
        duration: 18.5,
      };

      const thumbnailUrl = 'https://res.cloudinary.com/demo/video/upload/c_fill,h_360,w_640/products/videos/metadata-test.jpg';

      mockResource.mockResolvedValue(mockApiResult);
      mockUrl.mockReturnValue(thumbnailUrl);

      // Act
      const result = await service.getVideoMetadata(publicId);

      // Assert
      expect(result).toEqual({
        url: mockApiResult.secure_url,
        thumbnail: thumbnailUrl,
        publicId: publicId,
        duration: 18.5,
      });

      expect(mockResource).toHaveBeenCalledWith(publicId, { resource_type: 'video' });
      expect(mockUrl).toHaveBeenCalledWith(publicId, {
        resource_type: 'video',
        format: 'jpg',
        transformation: [
          { width: 640, height: 360, crop: 'fill' }
        ]
      });
    });

    it('should handle missing duration in metadata', async () => {
      // Arrange
      const publicId = 'products/videos/no-duration-meta';
      const mockApiResult = {
        secure_url: 'https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/no-duration-meta.mp4',
        public_id: publicId,
        // duration is missing
      };

      const thumbnailUrl = 'https://res.cloudinary.com/demo/video/upload/c_fill,h_360,w_640/products/videos/no-duration-meta.jpg';

      mockResource.mockResolvedValue(mockApiResult);
      mockUrl.mockReturnValue(thumbnailUrl);

      // Act
      const result = await service.getVideoMetadata(publicId);

      // Assert
      expect(result?.duration).toBe(0);
    });

    it('should return null when video not found', async () => {
      // Arrange
      const publicId = 'products/videos/not-found';
      mockResource.mockRejectedValue(new Error('Resource not found'));

      // Act
      const result = await service.getVideoMetadata(publicId);

      // Assert
      expect(result).toBeNull();
      expect(mockResource).toHaveBeenCalledWith(publicId, { resource_type: 'video' });
    });

    it('should return null on API error', async () => {
      // Arrange
      const publicId = 'products/videos/api-error';
      mockResource.mockRejectedValue(new Error('Cloudinary API error'));

      // Act
      const result = await service.getVideoMetadata(publicId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty buffer upload', async () => {
      // Arrange
      const emptyBuffer = Buffer.from('');
      const uploadError = new Error('Invalid file');

      mockUploadStream.mockImplementation((options: any, callback: any) => {
        const stream = {
          end: jest.fn((buffer: Buffer) => {
            callback(uploadError, null);
          }),
        };
        return stream;
      });

      // Act & Assert
      await expect(service.uploadVideo(emptyBuffer)).rejects.toThrow('Invalid file');
    });

    it('should handle very long publicId', async () => {
      // Arrange
      const longPublicId = 'products/videos/' + 'a'.repeat(200);
      mockDestroy.mockResolvedValue({ result: 'ok' });

      // Act
      const result = await service.deleteVideo(longPublicId);

      // Assert
      expect(result).toEqual({ success: true });
      expect(mockDestroy).toHaveBeenCalledWith(longPublicId, { resource_type: 'video' });
    });

    it('should handle special characters in publicId', async () => {
      // Arrange
      const specialPublicId = 'products/videos/test-video_123@special';
      mockDestroy.mockResolvedValue({ result: 'ok' });

      // Act
      const result = await service.deleteVideo(specialPublicId);

      // Assert
      expect(result).toEqual({ success: true });
    });
  });
});
