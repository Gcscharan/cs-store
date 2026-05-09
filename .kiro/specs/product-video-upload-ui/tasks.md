# Implementation Plan: Product Video Upload UI

## Overview

This implementation plan integrates the existing VideoUpload component into ProductCreatePage and AdminProductsPage. The VideoUpload component is already complete with all upload, display, replace, and remove functionality. The backend endpoint `/api/admin/upload/video` is fully operational. This plan focuses solely on integrating the component into the product management forms and wiring video metadata to the product save/update flows.

**Execution Strategy:** Get it working first, then test later. Focus on core integration only.

## Tasks

- [x] 1. Create shared VideoMetadata type
  - Create `frontend/src/types/video.ts` file
  - Export VideoMetadata type with fields: url, thumbnail, publicId, hash?, duration?
  - This type will be reused across all components
  - _Requirements: 1.9_

- [x] 2. Integrate VideoUpload into ProductCreatePage
  - [x] 2.1 Add video state to ProductCreatePage form
    - Import VideoUpload component from `@/components/VideoUpload`
    - Import VideoMetadata type from `@/types/video`
    - Add video field to formData state (initialized as null, NOT undefined)
    - Create handleVideoChange handler: `(video: VideoMetadata | null) => setFormData({...formData, video})`
    - _Requirements: 1.1, 1.9, 1.11_
  
  - [x] 2.2 Add VideoUpload component to ProductCreatePage UI
    - Add VideoUpload section between Pricing Card and Images Card
    - Wrap in Card component with title "Product Video"
    - Render VideoUpload component with video={formData.video} and onChange={handleVideoChange}
    - _Requirements: 1.1, 1.3, 1.12_
  
  - [x] 2.3 Update ProductCreatePage submit handler
    - Include video in JSON payload (NOT FormData): `{ ...productData, video: formData.video }`
    - Ensure video is null (not undefined) when no video uploaded
    - Backend accepts JSON, so send video object directly
    - _Requirements: 1.4, 1.9_

- [x] 3. Integrate VideoUpload into AdminProductsPage
  - [x] 3.1 Add video state to AdminProductsPage edit form
    - Import VideoUpload component from `@/components/VideoUpload`
    - Import VideoMetadata type from `@/types/video`
    - Add video field to editFormData state (initialized as null)
    - Create handleVideoChange handler: `(video: VideoMetadata | null) => setEditFormData({...editFormData, video})`
    - _Requirements: 1.1, 1.9, 1.11_
  
  - [x] 3.2 Load existing video when editing product
    - Update handleEditProduct to extract video from product
    - Set editFormData.video to `product.video || null` (ensure null, not undefined)
    - _Requirements: 1.9_
  
  - [x] 3.3 Add VideoUpload component to edit modal
    - Add VideoUpload section in edit modal between weight field and images section
    - Add label "Product Video"
    - Render VideoUpload component with video={editFormData.video} and onChange={handleVideoChange}
    - _Requirements: 1.1, 1.3, 1.12_
  
  - [x] 3.4 Update AdminProductsPage update handler
    - Include video in update payload: `{ ...editFormData, video: editFormData.video }`
    - Ensure video is null (not undefined) when removed
    - _Requirements: 1.4, 1.9_
  
  - [x] 3.5 Reset video state on modal cancel
    - Update handleCancelEdit to reset video to null
    - _Requirements: 1.11_

- [x] 4. Manual testing - Create product with video
  - Open ProductCreatePage
  - Upload a video (mp4, under 20MB)
  - Verify thumbnail appears with duration
  - Fill in other product fields
  - Save product
  - Verify product created successfully
  - Reload page and verify video persists
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.9_

- [x] 5. Manual testing - Edit product video workflows
  - [x] 5.1 Test replace video
    - Open edit modal for product with video
    - Click "Replace Video"
    - Upload new video
    - Save changes
    - Verify video replaced
    - _Requirements: 1.7_
  
  - [x] 5.2 Test remove video
    - Open edit modal for product with video
    - Click "Remove Video"
    - Confirm removal
    - Save changes
    - Verify video removed (field should be null)
    - _Requirements: 1.8_
  
  - [x] 5.3 Test add video to existing product
    - Open edit modal for product without video
    - Upload video
    - Save changes
    - Verify video added
    - _Requirements: 1.1, 1.2, 1.4, 1.9_

## Notes

- **CRITICAL:** Use `null` for empty video, NOT `undefined` (backend logic depends on explicit null)
- **CRITICAL:** Send video as JSON object in payload, NOT as FormData string
- **CRITICAL:** Place VideoUpload between Pricing and Images sections for consistent UX
- The VideoUpload component is already complete and tested - no component development needed
- The backend endpoint `/api/admin/upload/video` is fully operational - no backend changes needed
- Focus on getting it working first - automated tests can be added later
- Manual testing validates all core workflows before moving to automated tests
