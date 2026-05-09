# Implementation Plan: Product Video Support

## Overview

This implementation plan transforms the e-commerce catalog with production-grade video support including deduplication, soft delete with 24-hour grace period, orphan cleanup, and version control integration. The system uses TypeScript with MongoDB, Cloudinary for video processing, and includes 5 critical production improvements for reliability and scalability.

Implementation follows a three-phase approach: Backend Core → Admin UI → User UI, ensuring each layer is fully functional before building the next.

## Tasks

### Phase 1: Backend Core - Data Models and Services

- [x] 1. Set up video data models and database schema
  - Create VideoRegistry model with hash-based deduplication (hash, publicId, url, thumbnail, duration, referenceCount)
  - Create TemporaryUpload model for orphan prevention (publicId, uploadedAt, status, uploadedBy)
  - Create PendingDeletion model for soft delete (publicId, markedForDeletionAt, reason, productId, retryCount)
  - Add unique indexes: VideoRegistry.hash, VideoRegistry.publicId, TemporaryUpload.publicId, PendingDeletion.publicId
  - Add compound index: TemporaryUpload (status, uploadedAt)
  - Add time-based index: PendingDeletion.markedForDeletionAt
  - _Requirements: 11.7, 13.2, 8.3_

- [x] 1.1 Write property test for VideoRegistry schema validation
  - **Property 1: Video Metadata String Validation**
  - **Validates: Requirements 1.3, 1.4, 1.5, 1.7**
  - Test that url, thumbnail, publicId reject empty/whitespace-only strings
  - Test that duration (if provided) must be positive number
  - Test that hash (if provided) must be non-empty string
  - Run 100 iterations with fast-check

- [x] 2. Extend Product model with optional video field
  - Add video field to IProduct interface: { url, thumbnail, publicId, hash?, duration? }
  - Add Mongoose schema validation for video field (conditional required, non-empty strings)
  - Add validation: url, thumbnail, publicId required when video exists
  - Add validation: duration must be positive if provided
  - Add validation: hash must be non-empty if provided
  - Ensure backward compatibility (video field optional)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2.1 Write unit tests for Product model video validation
  - Test video field is optional (null/undefined allowed)
  - Test validation errors for empty strings
  - Test validation errors for negative duration
  - Test backward compatibility with existing products
  - _Requirements: 1.2, 1.8_

- [x] 3. Implement CloudinaryService class
  - Configure Cloudinary with environment variables (cloud_name, api_key, api_secret)
  - Implement uploadVideo() method with eager transformations for reliable thumbnails
  - Use eager transformation: [{ width: 640, height: 360, crop: 'limit', format: 'mp4' }, { width: 640, height: 360, crop: 'fill', format: 'jpg' }]
  - Extract thumbnail from eager[1].secure_url (CRITICAL IMPROVEMENT 2)
  - Fallback to cloudinary.url() transformation API if eager fails
  - Return { url, thumbnail, publicId, duration }
  - Implement deleteVideo() method (delete video + thumbnail)
  - Implement getVideoMetadata() method
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 3.8_

- [x] 3.1 Write unit tests for CloudinaryService
  - Mock Cloudinary API calls
  - Test uploadVideo returns correct metadata structure
  - Test thumbnail extraction from eager transformation
  - Test fallback to transformation API
  - Test deleteVideo calls destroy for video and thumbnail
  - Test error handling for upload failures
  - _Requirements: 3.9, 3.10_

- [-] 4. Implement VideoService core business logic
  - Implement processUpload() with SHA-256 hash calculation (buffer-based for 20MB limit)
  - Implement deduplication: check VideoRegistry by hash before upload (CRITICAL IMPROVEMENT 3)
  - Use atomic operations with unique index + retry pattern for race condition prevention
  - Pattern: Try insert → catch duplicate error (code 11000) → fetch existing + atomic $inc refCount
  - If hash exists: increment refCount atomically, return existing metadata with deduplicated=true
  - If hash not found: upload to Cloudinary, create VideoRegistry entry (refCount=1), create TemporaryUpload (status=temporary)
  - Document upgrade path to stream-based hashing for future (CRITICAL IMPROVEMENT 1)
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.12, 2.13, 2.14, 2.15, 13.1, 13.3, 13.4, 13.5, 13.6, 13.7, 11.1_

- [ ] 4.1 Write property test for hash calculation and registry lookup
  - **Property 2: Hash Calculation and Registry Lookup**
  - **Validates: Requirements 2.2, 2.3, 13.1, 13.3**
  - Test that any video file upload calculates SHA-256 hash and queries registry
  - Run 100 iterations with random video data

- [ ] 4.2 Write property test for deduplication behavior
  - **Property 3: Deduplication Returns Existing Metadata**
  - **Validates: Requirements 2.4, 13.4, 13.5**
  - Test that duplicate hash returns existing metadata without Cloudinary upload
  - Test that refCount increments atomically
  - Run 100 iterations with random video data

- [ ] 5. Implement VideoService deletion and cleanup methods
  - Implement markPermanent() to update TemporaryUpload status to 'permanent'
  - Implement markForDeletion() with atomic refCount decrement (CRITICAL IMPROVEMENT 4)
  - Use findOneAndUpdate with condition { referenceCount: { $gt: 0 } } to prevent negative values
  - If refCount reaches 0: create PendingDeletion entry
  - If refCount > 0: do not mark for deletion
  - Add validation to prevent refCount going negative
  - Implement replaceVideo() to mark old video for deletion and new video as permanent
  - _Requirements: 11.2, 4.5, 4.6, 8.1, 8.2, 13.8, 13.9, 13.10_

- [ ] 5.1 Write property test for reference count safety
  - **Property 21: Reference Count Decrement on Deletion**
  - **Property 22: Deletion Trigger at Zero References**
  - **Validates: Requirements 13.8, 13.9, 13.10**
  - Test that refCount decrements atomically
  - Test that video marked for deletion only when refCount = 0
  - Test that refCount never goes negative
  - Run 100 iterations with varying refCount values

- [ ] 6. Implement VideoService cleanup jobs with batch safety
  - Implement cleanupOrphans() with BATCH_SIZE = 100 limit (CRITICAL IMPROVEMENT 5)
  - Query TemporaryUpload where status='temporary' AND uploadedAt < 2 hours ago
  - Use .limit(100) to prevent server spikes
  - Delete from Cloudinary, then delete TemporaryUpload entry
  - Log all cleanup operations
  - Implement executePendingDeletions() with BATCH_SIZE = 100 limit
  - Query PendingDeletion where markedForDeletionAt < 24 hours ago
  - Use .limit(100) to prevent server spikes
  - Delete video from Cloudinary, delete PendingDeletion entry, delete VideoRegistry entry
  - Increment retryCount on failure, log critical error after 3 failures
  - Implement restoreFromDeletion() for rollback support
  - _Requirements: 11.3, 11.4, 11.5, 11.6, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11, 8.12, 8.14_

- [ ] 6.1 Write property test for orphan cleanup by age
  - **Property 15: Orphan Cleanup by Age**
  - **Validates: Requirements 11.4, 11.6**
  - Test that temporary uploads >2 hours old are deleted
  - Test that batch size limit is enforced (max 100 per run)
  - Run 100 iterations with varying upload timestamps

- [ ] 6.2 Write property test for hard delete after grace period
  - **Property 16: Hard Delete After Grace Period**
  - **Validates: Requirements 8.5, 8.8**
  - Test that pending deletions >24 hours old are hard deleted
  - Test that batch size limit is enforced (max 100 per run)
  - Run 100 iterations with varying deletion timestamps

- [ ] 7. Checkpoint - Core services complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 2: Backend Core - API Endpoints and Validation

- [x] 8. Implement video upload endpoint with validation
  - Create POST /api/upload/video endpoint
  - Add authentication middleware (require admin role)
  - Add rate limiting: max 10 uploads per admin user per hour
  - Implement file validation: size ≤ 20MB, format = mp4, duration ≤ 30s
  - Use multer for multipart/form-data handling
  - Calculate video duration using video metadata extraction
  - Call videoService.processUpload() with file buffer and user ID
  - Return { url, thumbnail, publicId, hash, duration, deduplicated }
  - Implement error responses: 400 (validation), 401 (auth), 403 (non-admin), 429 (rate limit), 500 (processing)
  - _Requirements: 2.1, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.16, 2.17, 8.13, 9.1, 9.2, 9.3, 9.6, 9.7_

- [ ] 8.1 Write property test for file size validation
  - **Property 5: File Size Validation**
  - **Validates: Requirements 2.6**
  - Test that files >20MB are rejected with 400 status
  - Run 100 iterations with varying file sizes

- [ ] 8.2 Write property test for file format validation
  - **Property 6: File Format Validation**
  - **Validates: Requirements 2.8**
  - Test that non-mp4 files are rejected with 400 status
  - Run 100 iterations with varying MIME types

- [ ] 8.3 Write property test for duration limit validation
  - **Property 7: Duration Limit Validation**
  - **Validates: Requirements 2.10**
  - Test that videos >30 seconds are rejected with 400 status
  - Run 100 iterations with varying durations

- [ ] 8.4 Write property test for rate limiting enforcement
  - **Property 17: Rate Limiting Enforcement**
  - **Validates: Requirements 8.13**
  - Test that >10 uploads per hour are rejected with 429 status
  - Run 100 iterations with varying upload counts

- [ ] 8.5 Write unit tests for upload endpoint
  - Test authentication required (401 for unauthenticated)
  - Test admin role required (403 for non-admin)
  - Test specific error messages for validation failures
  - Test successful upload returns correct response structure
  - Test deduplication response includes deduplicated=true
  - _Requirements: 2.17, 9.6, 9.7, 9.1, 9.2, 9.3_

- [ ] 9. Implement Product save hooks for video lifecycle
  - Add pre-save hook to mark video as permanent when product saved with video
  - Call videoService.markPermanent(publicId) on product save
  - Add pre-save hook to handle video replacement
  - If video changed: call videoService.replaceVideo(oldPublicId, newPublicId)
  - Add pre-remove hook to mark video for deletion when product deleted
  - Call videoService.markForDeletion(publicId, 'product_deleted', productId)
  - _Requirements: 4.1, 4.3, 4.5, 4.6, 11.2_

- [ ] 9.1 Write property test for video metadata storage
  - **Property 8: Video Metadata Storage**
  - **Validates: Requirements 2.14, 4.1**
  - Test that all video fields are stored in product document
  - Run 100 iterations with random video metadata

- [ ] 9.2 Write property test for video replacement behavior
  - **Property 9: Video Replacement Behavior**
  - **Validates: Requirements 4.3, 4.5**
  - Test that new video replaces old video metadata
  - Test that old video is marked for deletion
  - Run 100 iterations with random video pairs

- [ ] 9.3 Write property test for video deletion on product delete
  - **Property 10: Video Deletion on Product Delete**
  - **Validates: Requirements 4.6**
  - Test that video is marked for deletion when product deleted
  - Run 100 iterations with random products

- [ ] 10. Implement cron job for cleanup operations
  - Set up cron job to run every 24 hours (cron: '0 0 * * *')
  - Call videoService.cleanupOrphans()
  - Call videoService.executePendingDeletions()
  - Log cleanup metrics (orphansDeleted, pendingDeletionsExecuted, duration)
  - _Requirements: 8.4, 11.3_

- [ ] 10.1 Write integration test for cleanup job execution
  - Test orphan cleanup deletes temporary uploads >2 hours old
  - Test pending deletion cleanup deletes videos >24 hours old
  - Test batch size limits are enforced
  - Test retry logic for failed deletions
  - _Requirements: 11.4, 11.6, 8.5, 8.8, 8.11, 8.12_

- [ ] 11. Checkpoint - Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: Version Control Integration

- [ ] 12. Integrate video with version control system
  - Extend version snapshot to include video metadata
  - When creating snapshot: include product.video in snapshot data
  - Track video changes in changedFields array
  - When video added: add "video" to changedFields
  - When video replaced: add "video" to changedFields
  - When video removed: add "video" to changedFields
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 12.1 Write property test for version control snapshot inclusion
  - **Property 11: Version Control Snapshot Inclusion**
  - **Validates: Requirements 7.1**
  - Test that snapshots include complete video metadata
  - Run 100 iterations with random video metadata

- [ ] 12.2 Write property test for version control change tracking
  - **Property 12: Version Control Change Tracking**
  - **Validates: Requirements 7.2, 7.3, 7.4**
  - Test that "video" is recorded in changedFields for add/replace/remove
  - Run 100 iterations with random video operations

- [ ] 13. Implement video rollback functionality
  - Extend rollback logic to restore video metadata from snapshot
  - If target version has video: restore video metadata to product
  - If target version has no video: clear current video metadata
  - If target version has different video: replace current with snapshot video
  - If current video is in PendingDeletion: call videoService.restoreFromDeletion(publicId)
  - Create new version after rollback with restored video state
  - _Requirements: 7.5, 7.6, 7.7, 8.14_

- [ ] 13.1 Write property test for rollback restores video state (round-trip)
  - **Property 13: Rollback Restores Video State (Round-Trip)**
  - **Validates: Requirements 7.5, 7.6, 7.7**
  - Test that rollback restores exact video metadata from snapshot
  - Test round-trip: create → change → rollback → verify exact match
  - Run 100 iterations with random video metadata

- [ ] 13.2 Write property test for rollback cancels pending deletion
  - **Property 23: Rollback Cancels Pending Deletion**
  - **Validates: Requirements 8.14**
  - Test that rollback removes PendingDeletion entry for restored video
  - Run 100 iterations with random rollback scenarios

- [ ] 14. Checkpoint - Version control integration complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 4: Admin UI - Video Upload and Management

- [ ] 15. Create video upload component for admin product form
  - Add "Product Video" section above images section in product form
  - Display upload button when no video: "Upload Video"
  - Restrict file picker to mp4 files only
  - Implement upload progress bar with percentage display
  - Disable upload button during upload, show "Uploading..." text
  - Call POST /api/upload/video with multipart/form-data
  - Handle upload response: store { url, thumbnail, publicId, hash, duration }
  - Display error messages for validation failures (size, format, duration)
  - Display error messages for rate limiting (429)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.12_

- [ ] 15.1 Write unit tests for video upload component
  - Test upload button appears when no video
  - Test file picker restricted to mp4
  - Test progress bar displays during upload
  - Test upload button disabled during upload
  - Test error messages displayed for validation failures
  - _Requirements: 5.2, 5.3, 5.4, 5.5, 5.6, 5.12_

- [ ] 16. Create video preview component for admin product form
  - Display video thumbnail with play icon overlay when video exists
  - Display fallback placeholder if thumbnail unavailable
  - Display video duration in seconds (e.g., "▶ 12s")
  - Add "Replace Video" button to trigger new upload
  - Add "Remove Video" button to clear video metadata
  - Implement replace: open file picker, upload new video, update product video field
  - Implement remove: clear video field from product, mark old video for deletion
  - _Requirements: 5.7, 5.8, 5.9, 5.10, 5.11_

- [ ] 16.1 Write unit tests for video preview component
  - Test thumbnail displays with play icon overlay
  - Test fallback placeholder when thumbnail unavailable
  - Test duration display format
  - Test replace button opens file picker
  - Test remove button clears video metadata
  - _Requirements: 5.7, 5.8, 5.9, 5.10, 5.11_

- [ ] 17. Integrate video upload with product save flow
  - Store video metadata in product state during upload
  - Include video metadata in product save payload
  - Handle video field in product update API
  - Trigger markPermanent() on successful product save
  - Handle video replacement: mark old for deletion, mark new as permanent
  - Display success message after save
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 11.2_

- [ ] 17.1 Write integration test for admin video workflow
  - Test complete flow: upload → preview → save → verify permanent status
  - Test replace flow: upload → save → replace → save → verify old marked for deletion
  - Test remove flow: upload → save → remove → save → verify marked for deletion
  - _Requirements: 4.1, 4.3, 4.5, 4.6_

- [ ] 18. Checkpoint - Admin UI complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 5: User UI - Video Display and Lazy Loading

- [ ] 19. Create video thumbnail component for product detail view
  - Display video thumbnail in product detail view
  - Display fallback placeholder if thumbnail unavailable
  - Display play icon overlay on thumbnail
  - Display video duration in seconds (e.g., "▶ 12s")
  - Do NOT autoplay videos
  - Do NOT load video file until user interaction
  - Implement lazy loading: load video player only on thumbnail tap
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.6, 10.7_

- [ ] 19.1 Write unit tests for video thumbnail component
  - Test thumbnail displays with play icon overlay
  - Test fallback placeholder when thumbnail unavailable
  - Test duration display format
  - Test video file not loaded initially
  - Test video player loads on thumbnail tap
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 6.7_

- [ ] 20. Create video player component with controls
  - Implement video player with controls (play, pause, seek, volume)
  - Use compressed video URL from Cloudinary
  - Enable adaptive bitrate streaming if available
  - Deliver video through CDN for fast loading
  - Implement modal or inline player based on UI design
  - Implement close/dismiss functionality
  - Unload video on close to free memory
  - _Requirements: 6.7, 6.8, 6.9, 6.10, 6.11, 6.12_

- [ ] 20.1 Write unit tests for video player component
  - Test video controls present (play, pause, seek, volume)
  - Test compressed video URL used
  - Test video unloads on close
  - _Requirements: 6.8, 6.9, 6.12_

- [ ] 21. Add video indicator to product listing cards
  - Display video indicator icon (play button) on product cards with video
  - Position indicator in top-right corner of product image
  - Display video duration next to indicator (e.g., "▶ 12s")
  - Add tooltip "Video available" on hover
  - Do NOT load video files or thumbnails in listing views (performance)
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [ ] 21.1 Write unit tests for video indicator component
  - Test indicator displays on product cards with video
  - Test indicator positioned in top-right corner
  - Test duration display format
  - Test tooltip on hover
  - Test video files not loaded in listing view
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [ ] 22. Implement performance optimizations for video display
  - Ensure page load time ≤ 2 seconds (excluding video file)
  - Ensure video playback starts within 3 seconds of tap
  - Preload only thumbnail (not video file) in product detail view
  - Use CDN delivery for all video assets
  - Implement lazy loading for video player component
  - _Requirements: 10.1, 10.2, 10.3, 10.6, 10.7_

- [ ] 22.1 Write integration test for video lazy loading
  - Test page loads without video file
  - Test video file loads only after user interaction
  - Test video playback starts within 3 seconds
  - _Requirements: 10.2, 10.3, 10.6_

- [ ] 23. Checkpoint - User UI complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 6: Testing and Documentation

- [ ] 24. Write remaining property-based tests for edge cases
  - **Property 4: Duration Validation** - Test duration must be positive (Requirements 1.6)
  - **Property 14: Soft Delete with Timestamp** - Test pending deletion entry creation (Requirements 8.1, 8.2)
  - **Property 18: Temporary Status on Upload** - Test temporary upload entry creation (Requirements 11.1)
  - **Property 19: Permanent Status on Product Save** - Test status update to permanent (Requirements 11.2)
  - **Property 20: New Video Registry Entry Initialization** - Test refCount=1 for new videos (Requirements 13.6, 13.7)
  - **Property 24: Storage Savings Calculation** - Test savedStorageBytes calculation (Requirements 13.12)
  - Run all property tests with 100 iterations each
  - Verify all 24 correctness properties are tested

- [ ] 24.1 Write integration tests for critical paths
  - Test complete upload-to-display flow: upload → save → display → verify
  - Test deduplication flow: upload same video twice → verify single storage
  - Test cleanup job flow: create orphan → wait 2h → run cleanup → verify deletion
  - Test soft delete flow: delete product → wait 24h → run cleanup → verify hard delete
  - Test rollback flow: create → change video → rollback → verify restoration
  - Test race condition handling: concurrent uploads of same video → verify single entry

- [ ] 25. Create API documentation for video endpoints
  - Document POST /api/upload/video endpoint (request, response, errors)
  - Document video metadata structure
  - Document rate limiting rules
  - Document validation rules (size, format, duration)
  - Document error codes and messages
  - _Requirements: 2.1, 2.6, 2.8, 2.10, 8.13, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 26. Create deployment checklist and environment setup
  - Document Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
  - Document cron job setup for cleanup operations
  - Document database indexes required
  - Document rate limiting configuration
  - Document monitoring and alerting for cleanup job failures
  - Document upgrade path to stream-based hashing (CRITICAL IMPROVEMENT 1)
  - Document batch size limits for cleanup jobs (CRITICAL IMPROVEMENT 5)

- [ ] 27. Final checkpoint - All tests pass and documentation complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at phase boundaries
- Property tests validate universal correctness properties (24 total)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- Implementation uses TypeScript with MongoDB and Cloudinary
- All 5 critical production improvements are integrated into implementation tasks
- Batch size limits (100) prevent server spikes during cleanup operations
- Atomic operations with unique indexes prevent race conditions
- Stream-based hashing upgrade path documented for future scalability
