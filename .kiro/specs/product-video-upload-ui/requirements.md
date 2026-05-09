# Requirements Document: Product Video Upload UI

## Introduction

The Product Video Upload UI feature adds a separate video upload section to the e-commerce admin product management interface. This feature enables admin users to upload, display, replace, and remove product videos through a dedicated UI component that is completely separate from the existing image upload functionality. The video upload flow differs from images: only one video per product is allowed, and videos go through a distinct Upload → Process → Attach → Display workflow using Cloudinary processing and the existing `/api/admin/upload/video` backend endpoint.

## Glossary

- **Admin_Product_Form**: The administrative interface for creating and editing products
- **Video_Upload_Section**: A dedicated UI section for video management, separate from image uploads
- **Video_Upload_Button**: UI button that opens a file picker restricted to video/mp4 files
- **Video_Thumbnail_Display**: UI component showing the uploaded video's thumbnail with duration and action buttons
- **Video_Metadata**: Data structure containing { url, thumbnail, publicId, hash, duration }
- **Upload_Handler**: Frontend function that calls /api/admin/upload/video endpoint
- **Progress_Indicator**: Visual feedback showing upload progress percentage
- **Replace_Video_Action**: UI action that allows replacing the current video with a new one
- **Remove_Video_Action**: UI action that clears the video metadata from the product
- **Product_Model**: Backend data model that stores product information including optional video field
- **Cloudinary**: Cloud service that processes videos and generates thumbnails with metadata
- **Backend_Video_Endpoint**: Existing API endpoint at /api/admin/upload/video that handles video processing

## Requirements

### Requirement 1: Separate Video Upload Section

**User Story:** As an admin user, I want a dedicated video upload section separate from images, so that I can manage product videos independently from product images.

#### Acceptance Criteria

1. THE Admin_Product_Form SHALL display a "Product Video" section above the "Add Images" section
2. THE Video_Upload_Section SHALL be visually distinct from the image upload section
3. THE Video_Upload_Section SHALL include a label "Product Video (Optional)"
4. WHEN a product has no video, THE Video_Upload_Section SHALL display only the Video_Upload_Button
5. WHEN a product has a video, THE Video_Upload_Section SHALL display the Video_Thumbnail_Display with action buttons
6. THE Video_Upload_Section SHALL NOT interfere with existing image upload functionality

### Requirement 2: Video File Picker

**User Story:** As an admin user, I want to select video files through a file picker, so that I can upload videos from my device.

#### Acceptance Criteria

1. THE Video_Upload_Button SHALL display the text "Upload Video"
2. WHEN an admin user clicks the Video_Upload_Button, THE Admin_Product_Form SHALL open a file picker
3. THE file picker SHALL accept only video/mp4 files (accept="video/mp4")
4. THE file picker SHALL NOT accept image files or other video formats
5. WHEN an admin user selects a video file, THE Admin_Product_Form SHALL trigger the Upload_Handler
6. WHEN an admin user cancels the file picker, THE Admin_Product_Form SHALL take no action

### Requirement 3: Single Video Constraint

**User Story:** As an admin user, I want to upload only one video per product, so that the product page remains focused and performant.

#### Acceptance Criteria

1. THE Admin_Product_Form SHALL enforce a maximum of 1 video per product
2. WHEN a product has no video, THE Admin_Product_Form SHALL display the Video_Upload_Button
3. WHEN a product has a video, THE Admin_Product_Form SHALL hide the Video_Upload_Button
4. WHEN a product has a video, THE Admin_Product_Form SHALL display Replace_Video_Action and Remove_Video_Action buttons
5. THE Admin_Product_Form SHALL NOT allow multiple video uploads simultaneously

### Requirement 4: Video Upload Handler

**User Story:** As an admin user, I want videos uploaded to the backend for processing, so that videos are compressed and thumbnails are generated.

#### Acceptance Criteria

1. THE Upload_Handler SHALL send a POST request to /api/admin/upload/video
2. THE Upload_Handler SHALL include the video file in a multipart/form-data request body
3. THE Upload_Handler SHALL include the admin authentication token in the request headers
4. WHEN the upload starts, THE Upload_Handler SHALL display a Progress_Indicator
5. WHEN the upload completes successfully, THE Upload_Handler SHALL receive Video_Metadata from the backend
6. WHEN the upload completes successfully, THE Upload_Handler SHALL store the Video_Metadata in the product form state
7. WHEN the upload fails, THE Upload_Handler SHALL display an error message to the admin user
8. THE Upload_Handler SHALL disable the Video_Upload_Button during upload to prevent duplicate uploads

### Requirement 5: Upload Progress Feedback

**User Story:** As an admin user, I want to see upload progress, so that I know the upload is working and how long it will take.

#### Acceptance Criteria

1. WHEN a video upload starts, THE Admin_Product_Form SHALL display a Progress_Indicator
2. THE Progress_Indicator SHALL show the upload percentage (0% to 100%)
3. THE Progress_Indicator SHALL update at least every 500 milliseconds
4. THE Progress_Indicator SHALL display "Uploading..." text alongside the percentage
5. WHEN the upload reaches 100%, THE Progress_Indicator SHALL display "Processing..." text
6. WHEN the upload completes, THE Admin_Product_Form SHALL hide the Progress_Indicator
7. WHEN the upload fails, THE Admin_Product_Form SHALL hide the Progress_Indicator and display an error message

### Requirement 6: Video Thumbnail Display

**User Story:** As an admin user, I want to see a thumbnail of the uploaded video, so that I can verify the correct video was uploaded.

#### Acceptance Criteria

1. WHEN a video upload completes, THE Admin_Product_Form SHALL display the Video_Thumbnail_Display
2. THE Video_Thumbnail_Display SHALL show the thumbnail image from Video_Metadata.thumbnail
3. THE Video_Thumbnail_Display SHALL display a play icon overlay on the thumbnail
4. WHERE Video_Metadata.duration is available, THE Video_Thumbnail_Display SHALL display the duration in seconds (e.g., "15s")
5. THE Video_Thumbnail_Display SHALL display the duration in the bottom-right corner of the thumbnail
6. THE Video_Thumbnail_Display SHALL be sized appropriately for the admin interface (e.g., 200px width)
7. IF Video_Metadata.thumbnail is unavailable, THEN THE Admin_Product_Form SHALL display a fallback placeholder image

### Requirement 7: Replace Video Action

**User Story:** As an admin user, I want to replace an existing video, so that I can update product videos when needed.

#### Acceptance Criteria

1. WHEN a product has a video, THE Video_Thumbnail_Display SHALL display a "Replace Video" button
2. WHEN an admin user clicks "Replace Video", THE Admin_Product_Form SHALL open the file picker
3. WHEN an admin user selects a new video file, THE Upload_Handler SHALL upload the new video
4. WHEN the new video upload completes, THE Admin_Product_Form SHALL replace the existing Video_Metadata with the new Video_Metadata
5. WHEN the product is saved with the new video, THE Product_Model SHALL mark the old video for deletion
6. THE Admin_Product_Form SHALL display the new video thumbnail after replacement

### Requirement 8: Remove Video Action

**User Story:** As an admin user, I want to remove a video from a product, so that I can delete videos that are no longer needed.

#### Acceptance Criteria

1. WHEN a product has a video, THE Video_Thumbnail_Display SHALL display a "Remove Video" button
2. WHEN an admin user clicks "Remove Video", THE Admin_Product_Form SHALL display a confirmation dialog
3. THE confirmation dialog SHALL ask "Are you sure you want to remove this video?"
4. WHEN the admin user confirms removal, THE Admin_Product_Form SHALL clear the Video_Metadata from the product form state
5. WHEN the admin user confirms removal, THE Admin_Product_Form SHALL hide the Video_Thumbnail_Display
6. WHEN the admin user confirms removal, THE Admin_Product_Form SHALL display the Video_Upload_Button
7. WHEN the product is saved without video, THE Product_Model SHALL mark the video for deletion
8. WHEN the admin user cancels removal, THE Admin_Product_Form SHALL take no action

### Requirement 9: Video Metadata Storage

**User Story:** As an admin user, I want video metadata stored with the product, so that the video is associated with the product and displayed to customers.

#### Acceptance Criteria

1. WHEN an admin user saves a product with video, THE Admin_Product_Form SHALL include Video_Metadata in the product save request
2. THE Video_Metadata SHALL include url, thumbnail, publicId, hash, and duration fields
3. THE Product_Model SHALL store the Video_Metadata in the product.video field
4. WHEN an admin user saves a product without video, THE Admin_Product_Form SHALL set product.video to null or undefined
5. WHEN a product is loaded for editing, THE Admin_Product_Form SHALL display the Video_Thumbnail_Display if product.video exists
6. WHEN a product is loaded for editing without video, THE Admin_Product_Form SHALL display the Video_Upload_Button

### Requirement 10: Error Handling and Validation

**User Story:** As an admin user, I want clear error messages when video operations fail, so that I can understand and resolve issues.

#### Acceptance Criteria

1. IF a video file exceeds 20MB, THEN THE Admin_Product_Form SHALL display error message "Video file size exceeds 20MB limit"
2. IF a video duration exceeds 30 seconds, THEN THE Admin_Product_Form SHALL display error message "Video duration exceeds 30 seconds limit"
3. IF a video format is not mp4, THEN THE Admin_Product_Form SHALL display error message "Only mp4 format is supported"
4. IF the upload request fails with network error, THEN THE Admin_Product_Form SHALL display error message "Upload failed. Please check your connection and try again"
5. IF the backend returns an error response, THEN THE Admin_Product_Form SHALL display the error message from the response
6. THE Admin_Product_Form SHALL display error messages in a visually distinct error notification component
7. THE Admin_Product_Form SHALL automatically dismiss error messages after 5 seconds or when the user clicks a dismiss button

### Requirement 11: UI State Management

**User Story:** As an admin user, I want the video upload UI to respond correctly to my actions, so that the interface is intuitive and predictable.

#### Acceptance Criteria

1. WHEN a video upload is in progress, THE Video_Upload_Button SHALL be disabled
2. WHEN a video upload is in progress, THE Video_Upload_Button SHALL display "Uploading..." text
3. WHEN a video upload completes, THE Video_Upload_Button SHALL be re-enabled
4. WHEN a product has a video, THE Video_Upload_Button SHALL be hidden
5. WHEN a product has no video, THE Replace_Video_Action and Remove_Video_Action buttons SHALL be hidden
6. WHEN the admin user navigates away from the product form, THE Admin_Product_Form SHALL warn if there is an unsaved video upload
7. THE Admin_Product_Form SHALL maintain video state when switching between form tabs or sections

### Requirement 12: Responsive Design

**User Story:** As an admin user, I want the video upload UI to work on different screen sizes, so that I can manage videos from any device.

#### Acceptance Criteria

1. THE Video_Upload_Section SHALL be responsive and adapt to screen widths from 320px to 1920px
2. WHEN viewed on mobile devices (width < 768px), THE Video_Thumbnail_Display SHALL scale to fit the screen width
3. WHEN viewed on mobile devices, THE action buttons SHALL stack vertically if needed
4. WHEN viewed on desktop (width >= 768px), THE Video_Thumbnail_Display SHALL maintain a fixed width (e.g., 200px)
5. THE Video_Upload_Section SHALL maintain consistent spacing and alignment across all screen sizes

### Requirement 13: Accessibility

**User Story:** As an admin user with accessibility needs, I want the video upload UI to be accessible, so that I can manage videos using assistive technologies.

#### Acceptance Criteria

1. THE Video_Upload_Button SHALL have an accessible label "Upload product video"
2. THE Replace_Video_Action button SHALL have an accessible label "Replace current video"
3. THE Remove_Video_Action button SHALL have an accessible label "Remove current video"
4. THE Video_Thumbnail_Display SHALL have alt text describing the video thumbnail
5. THE Progress_Indicator SHALL announce progress updates to screen readers
6. THE error messages SHALL be announced to screen readers when displayed
7. THE file picker SHALL be keyboard accessible (can be triggered with Enter or Space key)
8. THE action buttons SHALL be keyboard accessible and have visible focus indicators
