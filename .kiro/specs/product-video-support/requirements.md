# Requirements Document: Product Video Support

## Introduction

The Product Video Support system enables e-commerce products to include video content, transforming the catalog from basic images to rich multimedia experiences. This system provides video upload, processing, storage, and display capabilities while maintaining strict performance, cost, and UX standards. Videos are processed through cloud services for compression and thumbnail generation, then lazy-loaded in the UI to ensure optimal performance.

## Glossary

- **Product**: A catalog item with properties like name, description, price, images, category, and status
- **Video_Upload_System**: Separate service responsible for handling video file uploads to cloud storage
- **Video_Processing**: Cloud-based compression, thumbnail generation, and format optimization
- **Video_Metadata**: Structured data containing video URL, thumbnail URL, publicId, duration, and hash
- **Video_Hash**: SHA-256 hash of video file content used for duplicate detection
- **PublicId**: Unique identifier assigned by Cloudinary for reliable video deletion operations
- **Orphan_Upload**: Video uploaded to cloud storage but not associated with any saved product
- **Fallback_Thumbnail**: Default placeholder image used when video thumbnail generation fails
- **Product_Model**: Existing MongoDB schema for products
- **Admin_UI**: Administrative interface for managing products
- **User_UI**: Customer-facing interface for viewing products
- **Cloudinary**: Preferred cloud service for video storage with auto-compression and streaming
- **Lazy_Loading**: Performance optimization where video loads only when user interacts with it
- **Version_Control_System**: Existing system that tracks product changes and enables rollback
- **Snapshot**: Complete copy of product data including video metadata for version control
- **CDN**: Content Delivery Network for optimized video delivery
- **Adaptive_Bitrate**: Video streaming technique that adjusts quality based on network conditions
- **Soft_Delete**: Marking a resource for deletion with a timestamp instead of immediate removal
- **Hard_Delete**: Permanent removal of a resource from storage
- **Deletion_Grace_Period**: Time window (24 hours) between soft delete and hard delete for rollback safety
- **Cleanup_Job**: Scheduled background process that performs hard deletes on soft-deleted resources
- **Video_Registry**: Database collection tracking unique videos by hash with reference counting for deduplication

## Requirements

### Requirement 1: Product Data Model Extension

**User Story:** As a system architect, I want the Product model to support video metadata, so that products can store video information without breaking existing functionality.

#### Acceptance Criteria

1. THE Product_Model SHALL include an optional video field with structure: { url: string, thumbnail: string, publicId: string, hash?: string, duration?: number }
2. THE Product_Model SHALL allow the video field to be null or undefined for products without videos
3. WHEN a Product is saved with video metadata, THE Product_Model SHALL validate that url is a non-empty string
4. WHEN a Product is saved with video metadata, THE Product_Model SHALL validate that thumbnail is a non-empty string
5. WHEN a Product is saved with video metadata, THE Product_Model SHALL validate that publicId is a non-empty string
6. WHEN a Product is saved with video metadata AND duration is provided, THE Product_Model SHALL validate that duration is a positive number
7. WHEN a Product is saved with video metadata AND hash is provided, THE Product_Model SHALL validate that hash is a non-empty string
8. THE Product_Model SHALL maintain backward compatibility with existing products that have no video field

### Requirement 2: Video Upload Endpoint

**User Story:** As an admin user, I want to upload product videos through a dedicated endpoint, so that videos are processed and stored before being associated with products.

#### Acceptance Criteria

1. THE Video_Upload_System SHALL provide a POST endpoint at /upload/video that accepts video file uploads
2. WHEN a video file is uploaded, THE Video_Upload_System SHALL calculate a SHA-256 hash of the file content
3. WHEN a video hash is calculated, THE Video_Upload_System SHALL check if a video with the same hash already exists in the system
4. IF a video with the same hash exists, THEN THE Video_Upload_System SHALL return the existing video metadata without uploading to Cloudinary
5. IF a video with the same hash exists, THEN THE Video_Upload_System SHALL return HTTP 200 status with JSON containing the existing { url: string, thumbnail: string, publicId: string, hash: string, duration: number }
6. WHEN a video file is uploaded, THE Video_Upload_System SHALL validate that the file size does not exceed 20MB
7. IF the file size exceeds 20MB, THEN THE Video_Upload_System SHALL return HTTP 400 status with message "Video file size exceeds 20MB limit"
8. WHEN a video file is uploaded, THE Video_Upload_System SHALL validate that the file format is mp4
9. IF the file format is not mp4, THEN THE Video_Upload_System SHALL return HTTP 400 status with message "Only mp4 format is supported"
10. WHEN a video file is uploaded, THE Video_Upload_System SHALL validate that the video duration does not exceed 30 seconds
11. IF the video duration exceeds 30 seconds, THEN THE Video_Upload_System SHALL return HTTP 400 status with message "Video duration exceeds 30 seconds limit"
12. WHEN a valid video with a unique hash is uploaded, THE Video_Upload_System SHALL upload the file to Cloudinary
13. WHEN Cloudinary processes the video, THE Video_Upload_System SHALL receive the video URL, thumbnail URL, publicId, and duration
14. WHEN video processing completes, THE Video_Upload_System SHALL store the video hash with the video metadata
15. WHEN video processing completes, THE Video_Upload_System SHALL return HTTP 200 status with JSON containing { url: string, thumbnail: string, publicId: string, hash: string, duration: number }
16. THE Video_Upload_System SHALL require admin role authentication for video uploads
17. IF an unauthenticated request is made, THEN THE Video_Upload_System SHALL return HTTP 401 status

### Requirement 3: Cloud Video Processing

**User Story:** As a system administrator, I want videos automatically compressed and optimized, so that storage costs and bandwidth usage are minimized.

#### Acceptance Criteria

1. WHEN a video is uploaded to Cloudinary, THE Video_Processing SHALL automatically compress the video for web delivery
2. WHEN a video is uploaded to Cloudinary, THE Video_Processing SHALL automatically generate a thumbnail image
3. WHEN a video is uploaded to Cloudinary, THE Video_Processing SHALL extract the video duration in seconds
4. WHEN a video is uploaded to Cloudinary, THE Video_Processing SHALL return the publicId for deletion operations
5. IF thumbnail generation fails, THEN THE Video_Processing SHALL return a fallback thumbnail URL
6. THE Video_Processing SHALL configure videos for streaming-ready delivery
7. WHERE adaptive bitrate streaming is available, THE Video_Processing SHALL enable it for optimal playback
8. THE Video_Processing SHALL store videos in a CDN-enabled location for fast global delivery
9. WHEN video processing fails, THE Video_Upload_System SHALL return HTTP 500 status with message "Video processing failed"
10. THE Video_Processing SHALL provide a default fallback thumbnail when thumbnail generation fails

### Requirement 4: Product Video Association

**User Story:** As an admin user, I want to associate uploaded videos with products, so that customers can view product videos.

#### Acceptance Criteria

1. WHEN an admin user updates a Product with video metadata, THE Product_Model SHALL store the video URL, thumbnail URL, publicId, and duration
2. THE Product_Model SHALL enforce a maximum of 1 video per product
3. IF an admin user attempts to add a second video, THEN THE Product_Model SHALL replace the existing video metadata with the new video metadata
4. WHEN a Product is updated with new video metadata, THE Product_Model SHALL preserve the existing video metadata until the update is saved
5. WHEN a Product video is replaced, THE Product_Model SHALL use the publicId to delete the old video from cloud storage
6. WHEN a Product is deleted, THE Product_Model SHALL use the publicId to delete the associated video from cloud storage

### Requirement 5: Admin UI Video Management

**User Story:** As an admin user, I want to manage product videos through the admin interface, so that I can add, replace, and remove videos easily.

#### Acceptance Criteria

1. THE Admin_UI SHALL display a "Product Video" section above the images section in the product form
2. WHEN a Product has no video, THE Admin_UI SHALL display an upload button labeled "Upload Video"
3. WHEN an admin user clicks the upload button, THE Admin_UI SHALL open a file picker restricted to mp4 files
4. WHEN an admin user selects a video file, THE Admin_UI SHALL display a progress bar showing upload progress
5. WHEN video upload is in progress, THE Admin_UI SHALL disable the upload button to prevent multiple simultaneous uploads
6. WHEN video upload is in progress, THE Admin_UI SHALL display "Uploading..." text
7. WHEN video upload completes successfully, THE Admin_UI SHALL display the video thumbnail with a play icon overlay
8. IF the video thumbnail is unavailable, THEN THE Admin_UI SHALL display a fallback placeholder thumbnail
9. WHEN a Product has a video, THE Admin_UI SHALL display the video thumbnail with options to "Replace Video" or "Remove Video"
10. WHEN an admin user clicks "Remove Video", THE Admin_UI SHALL clear the video metadata from the Product
11. WHEN an admin user clicks "Replace Video", THE Admin_UI SHALL open the file picker to select a new video
12. IF video upload fails, THEN THE Admin_UI SHALL display an error message with the failure reason

### Requirement 6: User UI Video Display

**User Story:** As a customer, I want to view product videos without impacting page load performance, so that I can see products in action while maintaining a fast browsing experience.

#### Acceptance Criteria

1. WHEN a Product has a video, THE User_UI SHALL display the video thumbnail in the product detail view
2. IF the video thumbnail is unavailable, THEN THE User_UI SHALL display a fallback placeholder thumbnail
3. THE User_UI SHALL display a play icon overlay on the video thumbnail
4. WHERE a video has duration metadata, THE User_UI SHALL display the duration in seconds (e.g., "▶ 12s")
5. THE User_UI SHALL NOT autoplay videos
6. THE User_UI SHALL NOT load video files until the user interacts with the video thumbnail
7. WHEN a user taps the video thumbnail, THE User_UI SHALL load the video player
8. WHEN the video player loads, THE User_UI SHALL display video controls (play, pause, seek, volume)
9. WHEN the video player loads, THE User_UI SHALL use the compressed video URL from Cloudinary
10. WHERE adaptive bitrate streaming is available, THE User_UI SHALL use it for optimal playback quality
11. THE User_UI SHALL deliver videos through CDN for fast loading
12. WHEN a user closes the video player, THE User_UI SHALL unload the video to free memory

### Requirement 7: Version Control Integration

**User Story:** As an admin user, I want video changes tracked in version history, so that I can see when videos were added or changed and rollback if needed.

#### Acceptance Criteria

1. WHEN a Product snapshot is created, THE Version_Control_System SHALL include the video metadata in the snapshot
2. WHEN a Product video is added, THE Version_Control_System SHALL record "video" in the changedFields array
3. WHEN a Product video is replaced, THE Version_Control_System SHALL record "video" in the changedFields array
4. WHEN a Product video is removed, THE Version_Control_System SHALL record "video" in the changedFields array
5. WHEN a Product is rolled back to a previous version, THE Version_Control_System SHALL restore the video metadata from that version's snapshot
6. WHEN a Product is rolled back to a version with no video, THE Version_Control_System SHALL clear the current video metadata
7. WHEN a Product is rolled back to a version with a different video, THE Version_Control_System SHALL replace the current video metadata with the snapshot video metadata

### Requirement 8: Video Cleanup and Cost Control

**User Story:** As a system administrator, I want unused videos automatically deleted from cloud storage with a safety window for rollback, so that storage costs are minimized while maintaining operational safety.

#### Acceptance Criteria

1. WHEN a Product video is replaced, THE Video_Upload_System SHALL mark the old video for deletion with a timestamp
2. WHEN a Product is deleted, THE Video_Upload_System SHALL mark the associated video for deletion with a timestamp
3. THE Video_Upload_System SHALL store deletion markers in a pending_deletions collection with fields: publicId, markedForDeletionAt, reason, productId
4. THE Video_Upload_System SHALL run a Cleanup_Job every 24 hours to identify videos marked for deletion
5. WHEN the Cleanup_Job identifies a video marked for deletion for more than 24 hours, THE Video_Upload_System SHALL perform a hard delete using the publicId
6. WHEN performing a hard delete, THE Video_Upload_System SHALL delete the video file from Cloudinary using the publicId
7. WHEN performing a hard delete, THE Video_Upload_System SHALL delete the thumbnail file from Cloudinary using the publicId
8. WHEN a hard delete completes, THE Video_Upload_System SHALL remove the deletion marker from the pending_deletions collection
9. THE Video_Upload_System SHALL log all soft delete operations with productId, publicId, markedForDeletionAt, and reason
10. THE Video_Upload_System SHALL log all hard delete operations with publicId, deletedAt, and originalMarkTimestamp
11. IF video deletion fails, THEN THE Video_Upload_System SHALL log the error and retry on the next cleanup cycle
12. IF video deletion fails 3 consecutive times, THEN THE Video_Upload_System SHALL log a critical error for manual investigation
13. THE Video_Upload_System SHALL implement rate limiting to prevent excessive video uploads (maximum 10 uploads per admin user per hour)
14. WHEN a Product is rolled back to a version with a video marked for deletion, THE Version_Control_System SHALL remove the deletion marker to restore the video

### Requirement 9: Validation and Error Handling

**User Story:** As an admin user, I want clear error messages when video operations fail, so that I can understand and resolve issues.

#### Acceptance Criteria

1. IF a video file exceeds 20MB, THEN THE Video_Upload_System SHALL return error message "Video file size exceeds 20MB limit"
2. IF a video duration exceeds 30 seconds, THEN THE Video_Upload_System SHALL return error message "Video duration exceeds 30 seconds limit"
3. IF a video format is not mp4, THEN THE Video_Upload_System SHALL return error message "Only mp4 format is supported"
4. IF video upload to Cloudinary fails, THEN THE Video_Upload_System SHALL return error message "Video upload failed: [reason]"
5. IF video processing fails, THEN THE Video_Upload_System SHALL return error message "Video processing failed: [reason]"
6. IF an admin user attempts to upload without authentication, THEN THE Video_Upload_System SHALL return error message "Authentication required"
7. IF a non-admin user attempts to upload, THEN THE Video_Upload_System SHALL return error message "Admin access required"

### Requirement 10: Performance Requirements

**User Story:** As a system administrator, I want video features to maintain system performance standards, so that the application remains fast and responsive.

#### Acceptance Criteria

1. WHEN a video is uploaded, THE Video_Upload_System SHALL return a response within 10 seconds for videos up to 20MB
2. WHEN a Product with video is loaded in the User_UI, THE User_UI SHALL load the page within 2 seconds (excluding video file)
3. WHEN a user taps a video thumbnail, THE User_UI SHALL start video playback within 3 seconds
4. THE Video_Upload_System SHALL process video uploads asynchronously to avoid blocking other operations
5. THE Admin_UI SHALL display upload progress updates at least every 500 milliseconds
6. THE User_UI SHALL use lazy loading to defer video file loading until user interaction
7. THE User_UI SHALL preload only the video thumbnail (not the video file) when displaying product details

### Requirement 11: Orphan Upload Prevention

**User Story:** As a system administrator, I want to prevent orphaned video uploads from accumulating in cloud storage, so that storage costs do not leak from abandoned uploads.

#### Acceptance Criteria

1. WHEN a video is uploaded, THE Video_Upload_System SHALL mark the upload with a temporary status
2. WHEN a Product is saved with video metadata, THE Video_Upload_System SHALL mark the video as permanent
3. THE Video_Upload_System SHALL run a cleanup job every 24 hours to identify temporary uploads older than 2 hours
4. WHEN the cleanup job identifies orphaned uploads, THE Video_Upload_System SHALL delete them from Cloudinary using their publicId
5. THE Video_Upload_System SHALL log all orphan cleanup operations with publicId, upload timestamp, and deletion timestamp
6. IF an admin user navigates away before saving a Product, THE Video_Upload_System SHALL automatically clean up the temporary upload after 2 hours
7. THE Video_Upload_System SHALL track upload metadata in a temporary uploads collection with fields: publicId, uploadedAt, status, uploadedBy

### Requirement 12: Product Listing Video Indicators

**User Story:** As a customer browsing products, I want to see which products have videos, so that I can prioritize viewing products with rich media content.

#### Acceptance Criteria

1. WHEN a Product has a video, THE User_UI SHALL display a video indicator icon on the product card in listing views
2. THE User_UI SHALL position the video indicator icon in the top-right corner of the product image
3. WHERE a video has duration metadata, THE User_UI SHALL display the duration next to the video indicator (e.g., "▶ 12s")
4. THE User_UI SHALL use a visually distinct icon (play button) to indicate video availability
5. WHEN a user hovers over a product card with video, THE User_UI SHALL display a tooltip "Video available"
6. THE User_UI SHALL NOT load video files or thumbnails in listing views to maintain performance

### Requirement 13: Video Deduplication and Storage Optimization

**User Story:** As a system administrator, I want duplicate videos detected and prevented from uploading, so that storage costs are minimized when the same video is used for multiple products.

#### Acceptance Criteria

1. WHEN a video file is uploaded, THE Video_Upload_System SHALL calculate a SHA-256 Video_Hash of the file content
2. THE Video_Upload_System SHALL store video hashes in a video_registry collection with fields: hash, publicId, url, thumbnail, duration, uploadedAt, referenceCount
3. WHEN a video hash is calculated, THE Video_Upload_System SHALL query the video_registry for an existing entry with the same hash
4. IF a matching hash is found, THEN THE Video_Upload_System SHALL increment the referenceCount for that video entry
5. IF a matching hash is found, THEN THE Video_Upload_System SHALL return the existing video metadata without uploading to Cloudinary
6. IF no matching hash is found, THEN THE Video_Upload_System SHALL upload the video to Cloudinary and create a new video_registry entry
7. WHEN a new video_registry entry is created, THE Video_Upload_System SHALL set referenceCount to 1
8. WHEN a Product video is marked for deletion, THE Video_Upload_System SHALL decrement the referenceCount in the video_registry
9. WHEN referenceCount reaches 0, THE Video_Upload_System SHALL mark the video for deletion in the pending_deletions collection
10. WHILE referenceCount is greater than 0, THE Video_Upload_System SHALL NOT mark the video for deletion
11. THE Video_Upload_System SHALL log all deduplication events with hash, existingPublicId, and savedStorageBytes
12. THE Video_Upload_System SHALL calculate savedStorageBytes as the file size of the deduplicated video
