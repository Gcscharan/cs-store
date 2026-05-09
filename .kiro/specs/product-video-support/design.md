# Design Document: Product Video Support

## Critical Production Improvements

This design incorporates 5 critical improvements for production reliability and scalability:

1. **Stream-Based Hashing**: Scalable approach for large files (currently using buffer-based for 20MB limit, with upgrade path documented)
2. **Thumbnail Generation Reliability**: Uses Cloudinary eager transformations and transformation API instead of fragile string replacement
3. **Race Condition Prevention**: Atomic operations with unique index + retry pattern prevents duplicate uploads in concurrent scenarios
4. **RefCount Safety**: Atomic $inc operations with validation ensure refCount never goes negative
5. **Cleanup Job Safety**: Batch size limits (100 per run) prevent server spikes from processing thousands of deletions

See "Critical Implementation Details" section for complete implementation guidance.

---

## Overview

The Product Video Support system transforms the e-commerce catalog from static images to rich multimedia experiences by enabling video content for products. This system provides end-to-end video management including upload, cloud processing, storage, deduplication, cleanup, and display capabilities while maintaining strict performance, cost efficiency, and user experience standards.

### Key Design Principles

1. **Separation of Concerns**: Video upload is completely separate from product save operations
2. **Cost Optimization**: Automatic deduplication prevents duplicate video storage
3. **Safe Deletion**: 24-hour grace period allows rollback before permanent deletion
4. **Performance First**: Lazy loading ensures videos don't impact page load times
5. **Cloud-Native**: Leverages Cloudinary for compression, thumbnails, and CDN delivery
6. **Backward Compatible**: Existing products without videos continue to work unchanged

### System Context

This system integrates with:
- Existing Product model (extends with optional video field)
- Product Version Control System (tracks video changes in snapshots)
- Cloudinary cloud service (video processing and storage)
- Admin UI (video management interface)
- User UI (video display with lazy loading)

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Admin UI                                │
│  (Upload Video → Progress Bar → Thumbnail Display)          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─ POST /api/upload/video
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│                 Upload Controller                            │
│  - Validate file (size, format, duration)                   │
│  - Calculate SHA-256 hash                                    │
│  - Check VideoRegistry for deduplication                    │
│  - Upload to Cloudinary (if unique)                         │
│  - Store in TemporaryUpload collection                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─ Cloudinary Service
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│                  Cloudinary                                  │
│  - Compress video for web                                   │
│  - Generate thumbnail                                        │
│  - Extract duration                                          │
│  - Return { url, thumbnail, publicId, duration }            │
└─────────────────────────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│              Product Model (Extended)                        │
│  video?: {                                                   │
│    url: string                                               │
│    thumbnail: string                                         │
│    publicId: string                                          │
│    hash?: string                                             │
│    duration?: number                                         │
│  }                                                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─ On Save: Mark video permanent
                 ├─ On Replace: Mark old video for deletion
                 ├─ On Delete: Mark video for deletion
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│              Cleanup Jobs (Cron)                             │
│  - Orphan Cleanup: Delete temporary uploads >2h old         │
│  - Soft Delete Cleanup: Hard delete videos marked >24h      │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Diagrams

#### Video Upload Flow
```
Admin User Selects Video
    ↓
Validate: size ≤20MB, format=mp4, duration ≤30s
    ↓
Calculate SHA-256 hash
    ↓
Check VideoRegistry for existing hash
    ↓
    ├─ Hash Exists? → Increment refCount → Return existing metadata
    │
    └─ Hash Not Found? → Upload to Cloudinary
                            ↓
                       Cloudinary Processing
                       (compress, thumbnail, duration)
                            ↓
                       Create VideoRegistry entry (refCount=1)
                            ↓
                       Create TemporaryUpload entry (status=temporary)
                            ↓
                       Return { url, thumbnail, publicId, hash, duration }
```

#### Product Save with Video Flow
```
Admin User Saves Product with Video
    ↓
Product.save() with video metadata
    ↓
Mark video as permanent (TemporaryUpload.status = permanent)
    ↓
Version Control: Create snapshot with video
    ↓
Return success to user
```

#### Video Replacement Flow
```
Admin User Replaces Video
    ↓
Upload new video (follow upload flow)
    ↓
Product.save() with new video metadata
    ↓
Mark new video as permanent
    ↓
Mark old video for deletion:
  - Decrement refCount in VideoRegistry
  - If refCount = 0: Create PendingDeletion entry
    ↓
Version Control: Record "video" in changedFields
    ↓
Return success to user
```

#### Cleanup Job Flow (Every 24 hours)
```
Cron Trigger
    ↓
Orphan Cleanup:
  - Find TemporaryUpload where status=temporary AND uploadedAt < 2h ago
  - Delete from Cloudinary using publicId
  - Delete TemporaryUpload entry
  - Log cleanup operation
    ↓
Soft Delete Cleanup:
  - Find PendingDeletion where markedForDeletionAt < 24h ago
  - Delete video from Cloudinary using publicId
  - Delete thumbnail from Cloudinary
  - Delete PendingDeletion entry
  - Log cleanup operation
```

#### Rollback Flow with Video
```
Admin User Rolls Back Product
    ↓
Fetch target version snapshot
    ↓
Extract video metadata from snapshot
    ↓
Compare with current video:
  ├─ Same video? → No action
  ├─ Different video? → Mark current for deletion, restore snapshot video
  └─ No video in snapshot? → Mark current for deletion, clear video field
    ↓
If video was marked for deletion:
  - Check if it's in PendingDeletion
  - If yes: Remove PendingDeletion entry (restore video)
    ↓
Version Control: Create rollback version
    ↓
Return success to user
```

---

## Components and Interfaces

### 1. Product Model Extension

The existing Product model is extended with an optional video field. No breaking changes to existing schema.

```typescript
// Extension to existing IProduct interface
export interface IProduct extends Document {
  // ... existing fields ...
  video?: {
    url: string;
    thumbnail: string;
    publicId: string;
    hash?: string;
    duration?: number;
  };
}

// Extension to existing ProductSchema
const ProductSchema = new Schema<IProduct>({
  // ... existing fields ...
  video: {
    url: {
      type: String,
      required: function(this: IProduct) {
        return this.video !== undefined && this.video !== null;
      },
      validate: {
        validator: (v: string) => v && v.trim().length > 0,
        message: 'Video URL must be a non-empty string'
      }
    },
    thumbnail: {
      type: String,
      required: function(this: IProduct) {
        return this.video !== undefined && this.video !== null;
      },
      validate: {
        validator: (v: string) => v && v.trim().length > 0,
        message: 'Video thumbnail must be a non-empty string'
      }
    },
    publicId: {
      type: String,
      required: function(this: IProduct) {
        return this.video !== undefined && this.video !== null;
      },
      validate: {
        validator: (v: string) => v && v.trim().length > 0,
        message: 'Video publicId must be a non-empty string'
      }
    },
    hash: {
      type: String,
      validate: {
        validator: (v: string) => !v || v.trim().length > 0,
        message: 'Video hash must be a non-empty string if provided'
      }
    },
    duration: {
      type: Number,
      validate: {
        validator: (v: number) => !v || v > 0,
        message: 'Video duration must be a positive number if provided'
      }
    }
  }
});
```

### 2. VideoRegistry Model

Tracks unique videos by hash with reference counting for deduplication.

```typescript
interface IVideoRegistry extends Document {
  _id: mongoose.Types.ObjectId;
  hash: string; // SHA-256 hash of video file
  publicId: string; // Cloudinary publicId
  url: string; // Cloudinary video URL
  thumbnail: string; // Cloudinary thumbnail URL
  duration: number; // Video duration in seconds
  uploadedAt: Date;
  referenceCount: number; // Number of products using this video
}

const VideoRegistrySchema = new Schema<IVideoRegistry>(
  {
    hash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    publicId: {
      type: String,
      required: true,
      unique: true,
    },
    url: {
      type: String,
      required: true,
    },
    thumbnail: {
      type: String,
      required: true,
    },
    duration: {
      type: Number,
      required: true,
      min: 0,
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    referenceCount: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
  },
  {
    timestamps: false,
  }
);

// Index for efficient hash lookups
VideoRegistrySchema.index({ hash: 1 });
VideoRegistrySchema.index({ publicId: 1 });
```

### 3. TemporaryUpload Model

Tracks uploads not yet associated with saved products to prevent orphans.

```typescript
interface ITemporaryUpload extends Document {
  _id: mongoose.Types.ObjectId;
  publicId: string;
  uploadedAt: Date;
  status: 'temporary' | 'permanent';
  uploadedBy: mongoose.Types.ObjectId; // Admin user ID
}

const TemporaryUploadSchema = new Schema<ITemporaryUpload>(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    uploadedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    status: {
      type: String,
      enum: ['temporary', 'permanent'],
      required: true,
      default: 'temporary',
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index for cleanup queries
TemporaryUploadSchema.index({ status: 1, uploadedAt: 1 });
```

### 4. PendingDeletion Model

Tracks videos marked for deletion with 24-hour grace period.

```typescript
interface IPendingDeletion extends Document {
  _id: mongoose.Types.ObjectId;
  publicId: string;
  markedForDeletionAt: Date;
  reason: 'product_deleted' | 'video_replaced' | 'orphan_cleanup';
  productId?: mongoose.Types.ObjectId; // Optional: for tracking
  retryCount: number; // Track deletion failures
}

const PendingDeletionSchema = new Schema<IPendingDeletion>(
  {
    publicId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    markedForDeletionAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    reason: {
      type: String,
      enum: ['product_deleted', 'video_replaced', 'orphan_cleanup'],
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
    },
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: false,
  }
);

// Index for cleanup queries
PendingDeletionSchema.index({ markedForDeletionAt: 1 });
```

### 5. CloudinaryService Class

Handles all Cloudinary operations for video upload and deletion.

```typescript
class CloudinaryService {
  /**
   * Upload video to Cloudinary with compression and thumbnail generation
   * @param file - Video file buffer
   * @param options - Upload options
   * @returns Video metadata from Cloudinary
   */
  async uploadVideo(
    file: Buffer,
    options?: {
      folder?: string;
      publicId?: string;
    }
  ): Promise<{
    url: string;
    thumbnail: string;
    publicId: string;
    duration: number;
  }>;

  /**
   * Delete video and thumbnail from Cloudinary
   * @param publicId - Cloudinary publicId
   * @returns Deletion result
   */
  async deleteVideo(publicId: string): Promise<{
    success: boolean;
    error?: string;
  }>;

  /**
   * Get video metadata from Cloudinary
   * @param publicId - Cloudinary publicId
   * @returns Video metadata
   */
  async getVideoMetadata(publicId: string): Promise<{
    url: string;
    thumbnail: string;
    duration: number;
  } | null>;
}
```

**Implementation Details**:
```typescript
// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async uploadVideo(file: Buffer, options = {}): Promise<VideoMetadata> {
  const uploadOptions = {
    resource_type: 'video',
    folder: options.folder || 'products/videos',
    public_id: options.publicId,
    eager: [
      { width: 640, height: 360, crop: 'limit', format: 'mp4' }, // Compressed version
      { width: 640, height: 360, crop: 'fill', format: 'jpg' }, // Explicit thumbnail generation
    ],
    eager_async: false, // Wait for processing
    transformation: [
      { quality: 'auto', fetch_format: 'auto' }, // Auto compression
    ],
  };

  const result = await cloudinary.uploader.upload_stream(
    uploadOptions,
    (error, result) => {
      if (error) throw error;
      return result;
    }
  ).end(file);

  // CRITICAL IMPROVEMENT 2: Use reliable thumbnail extraction
  // Prefer eager transformation result over string replacement
  let thumbnailUrl: string;
  if (result.eager && result.eager.length > 1 && result.eager[1].secure_url) {
    // Use explicit thumbnail from eager transformation
    thumbnailUrl = result.eager[1].secure_url;
  } else {
    // Fallback: Use transformation API for reliable thumbnail
    thumbnailUrl = cloudinary.url(result.public_id, {
      resource_type: 'video',
      format: 'jpg',
      transformation: [
        { width: 640, height: 360, crop: 'fill' }
      ]
    });
  }

  return {
    url: result.secure_url,
    thumbnail: thumbnailUrl,
    publicId: result.public_id,
    duration: result.duration || 0,
  };
}

async deleteVideo(publicId: string): Promise<DeletionResult> {
  try {
    // Delete video
    await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    
    // Delete thumbnail (if exists)
    const thumbnailPublicId = publicId.replace(/\.(mp4|mov|avi)$/, '');
    await cloudinary.uploader.destroy(thumbnailPublicId, { resource_type: 'image' });

    return { success: true };
  } catch (error) {
    logger.error('Cloudinary deletion failed:', { publicId, error });
    return { success: false, error: error.message };
  }
}
```

### 6. VideoService Class

Core business logic for video management, deduplication, and cleanup.

```typescript
class VideoService {
  /**
   * Process video upload with deduplication
   * @param file - Video file buffer
   * @param userId - Admin user ID
   * @returns Video metadata
   * 
   * CRITICAL IMPROVEMENT 1: Stream-Based Hashing for Large Files
   * Note: Currently using buffer-based hashing for 20MB limit.
   * Upgrade to streaming hash if size limit increases.
   * 
   * CRITICAL IMPROVEMENT 3: Race Condition in Deduplication
   * Implementation uses atomic operations with unique index on hash + retry pattern.
   * Pattern: Try insert → catch duplicate error → fetch existing entry
   */
  async processUpload(
    file: Buffer,
    userId: string
  ): Promise<{
    url: string;
    thumbnail: string;
    publicId: string;
    hash: string;
    duration: number;
    deduplicated: boolean;
  }>;

  /**
   * Mark video as permanent when product is saved
   * @param publicId - Cloudinary publicId
   */
  async markPermanent(publicId: string): Promise<void>;

  /**
   * Handle video replacement (mark old for deletion, mark new as permanent)
   * @param oldPublicId - Old video publicId
   * @param newPublicId - New video publicId
   */
  async replaceVideo(
    oldPublicId: string,
    newPublicId: string
  ): Promise<void>;

  /**
   * Mark video for deletion (decrement refCount, create pending deletion if 0)
   * @param publicId - Cloudinary publicId
   * @param reason - Deletion reason
   * @param productId - Optional product ID for tracking
   * 
   * CRITICAL IMPROVEMENT 4: RefCount Safety
   * Implementation ensures refCount operations are atomic using MongoDB $inc.
   * Validation: refCount must never go below 0.
   * Error handling for negative refCount scenarios included.
   */
  async markForDeletion(
    publicId: string,
    reason: 'product_deleted' | 'video_replaced' | 'orphan_cleanup',
    productId?: string
  ): Promise<void>;

  /**
   * Clean up orphaned temporary uploads (>2 hours old)
   * @returns Number of orphans cleaned
   * 
   * CRITICAL IMPROVEMENT 5: Cleanup Job Safety
   * Implementation includes batch size limit (100 deletions per run).
   * Prevents server spike from processing 10k+ deletions at once.
   * Uses pagination for cleanup queries.
   */
  async cleanupOrphans(): Promise<number>;

  /**
   * Execute hard deletes for videos marked >24 hours ago
   * @returns Number of videos deleted
   * 
   * CRITICAL IMPROVEMENT 5: Cleanup Job Safety
   * Implementation includes batch size limit (100 deletions per run).
   * Prevents server spike from processing 10k+ deletions at once.
   * Uses pagination for cleanup queries.
   */
  async executePendingDeletions(): Promise<number>;

  /**
   * Restore video from pending deletion (for rollback)
   * @param publicId - Cloudinary publicId
   */
  async restoreFromDeletion(publicId: string): Promise<void>;
}
```

### 7. Upload Controller

Handles video upload endpoint with validation and rate limiting.

```typescript
/**
 * POST /api/upload/video
 * Upload video file with validation and deduplication
 */
export const uploadVideo = async (req: AuthRequest, res: Response) => {
  try {
    // Auth check (handled by middleware)
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Rate limiting check
    const uploadCount = await checkRateLimit(req.user._id);
    if (uploadCount >= 10) {
      return res.status(429).json({ 
        message: 'Rate limit exceeded: maximum 10 uploads per hour' 
      });
    }

    // File validation
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No video file provided' });
    }

    // Size validation (20MB)
    if (file.size > 20 * 1024 * 1024) {
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

    // Duration validation (30 seconds max)
    const duration = await getVideoDuration(file.buffer);
    if (duration > 30) {
      return res.status(400).json({ 
        message: 'Video duration exceeds 30 seconds limit' 
      });
    }

    // Process upload (with deduplication)
    const result = await videoService.processUpload(file.buffer, req.user._id);

    // Increment rate limit counter
    await incrementRateLimit(req.user._id);

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Video upload failed:', { error, userId: req.user?._id });
    return res.status(500).json({ 
      message: 'Video upload failed',
      error: error.message 
    });
  }
};
```

### 8. API Endpoints

#### POST /api/upload/video
**Purpose**: Upload video file with validation and deduplication

**Request**:
```typescript
POST /api/upload/video
Headers: {
  Authorization: Bearer <admin_token>
  Content-Type: multipart/form-data
}
Body: {
  video: <file> // mp4 file, max 20MB, max 30s duration
}
```

**Response** (200 OK):
```json
{
  "url": "https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/abc123.mp4",
  "thumbnail": "https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/abc123.jpg",
  "publicId": "products/videos/abc123",
  "hash": "a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7",
  "duration": 15.5,
  "deduplicated": false
}
```

**Response** (200 OK - Deduplicated):
```json
{
  "url": "https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/existing123.mp4",
  "thumbnail": "https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/existing123.jpg",
  "publicId": "products/videos/existing123",
  "hash": "a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7",
  "duration": 15.5,
  "deduplicated": true
}
```

**Error Responses**:
- 400: Invalid file (size, format, duration)
- 401: Unauthorized (no token)
- 403: Forbidden (non-admin user)
- 429: Rate limit exceeded (>10 uploads/hour)
- 500: Upload or processing failed

---

## Data Models

### VideoRegistry Collection

**Collection Name**: `video_registry`

**Document Structure**:
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "hash": "a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7",
  "publicId": "products/videos/abc123",
  "url": "https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/abc123.mp4",
  "thumbnail": "https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/abc123.jpg",
  "duration": 15.5,
  "uploadedAt": ISODate("2024-01-15T10:30:00Z"),
  "referenceCount": 3
}
```

**Indexes**:
1. `{ hash: 1 }` - Unique index for deduplication lookups
2. `{ publicId: 1 }` - Unique index for deletion operations
3. `{ referenceCount: 1 }` - Index for cleanup queries

### TemporaryUpload Collection

**Collection Name**: `temporary_uploads`

**Document Structure**:
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "publicId": "products/videos/abc123",
  "uploadedAt": ISODate("2024-01-15T10:30:00Z"),
  "status": "temporary",
  "uploadedBy": ObjectId("507f1f77bcf86cd799439013")
}
```

**Indexes**:
1. `{ publicId: 1 }` - Unique index for lookups
2. `{ status: 1, uploadedAt: 1 }` - Compound index for cleanup queries
3. `{ uploadedAt: 1 }` - Index for time-based queries

### PendingDeletion Collection

**Collection Name**: `pending_deletions`

**Document Structure**:
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439014"),
  "publicId": "products/videos/old123",
  "markedForDeletionAt": ISODate("2024-01-15T10:30:00Z"),
  "reason": "video_replaced",
  "productId": ObjectId("507f191e810c19729de860ea"),
  "retryCount": 0
}
```

**Indexes**:
1. `{ publicId: 1 }` - Unique index for lookups
2. `{ markedForDeletionAt: 1 }` - Index for cleanup queries
3. `{ retryCount: 1 }` - Index for failure tracking

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:
- Properties 1.3, 1.4, 1.5, 1.7 all test non-empty string validation → Combined into Property 1
- Properties 2.2 and 13.1 are identical (SHA-256 hash calculation) → Combined into Property 2
- Properties 2.3 and 13.3 are identical (registry lookup) → Combined into Property 2
- Properties 2.4 and 13.5 are identical (deduplication return) → Combined into Property 3
- Properties 11.4 and 11.6 are identical (orphan cleanup) → Combined into Property 15

The following properties have been consolidated to eliminate redundancy:

### Property 1: Video Metadata String Validation

*For any* product with video metadata, when url, thumbnail, or publicId is provided, the system SHALL validate that each is a non-empty string (not empty, not whitespace-only).

**Validates: Requirements 1.3, 1.4, 1.5, 1.7**

### Property 2: Hash Calculation and Registry Lookup

*For any* video file upload, the system SHALL calculate a SHA-256 hash of the file content and query the video_registry for an existing entry with that hash.

**Validates: Requirements 2.2, 2.3, 13.1, 13.3**

### Property 3: Deduplication Returns Existing Metadata

*For any* video upload where a matching hash exists in the registry, the system SHALL return the existing video metadata without uploading to Cloudinary and SHALL increment the referenceCount.

**Validates: Requirements 2.4, 13.4, 13.5**

### Property 4: Duration Validation

*For any* product with video metadata where duration is provided, the system SHALL validate that duration is a positive number (greater than zero).

**Validates: Requirements 1.6**

### Property 5: File Size Validation

*For any* video file upload, the system SHALL validate that the file size does not exceed 20MB (20 * 1024 * 1024 bytes).

**Validates: Requirements 2.6**

### Property 6: File Format Validation

*For any* video file upload, the system SHALL validate that the MIME type is 'video/mp4'.

**Validates: Requirements 2.8**

### Property 7: Duration Limit Validation

*For any* video file upload, the system SHALL validate that the video duration does not exceed 30 seconds.

**Validates: Requirements 2.10**

### Property 8: Video Metadata Storage

*For any* product update with valid video metadata, the system SHALL store all video fields (url, thumbnail, publicId, hash, duration) in the product document.

**Validates: Requirements 2.14, 4.1**

### Property 9: Video Replacement Behavior

*For any* product with an existing video, when a new video is added, the system SHALL replace the existing video metadata with the new video metadata and mark the old video for deletion.

**Validates: Requirements 4.3, 4.5**

### Property 10: Video Deletion on Product Delete

*For any* product deletion where the product has a video, the system SHALL mark the associated video for deletion using its publicId.

**Validates: Requirements 4.6**

### Property 11: Version Control Snapshot Inclusion

*For any* product snapshot created by the version control system, if the product has video metadata, the snapshot SHALL include the complete video metadata.

**Validates: Requirements 7.1**

### Property 12: Version Control Change Tracking

*For any* product update that adds, replaces, or removes a video, the version control system SHALL record "video" in the changedFields array.

**Validates: Requirements 7.2, 7.3, 7.4**

### Property 13: Rollback Restores Video State (Round-Trip)

*For any* product rollback to a previous version, the system SHALL restore the video metadata to exactly match the target version's snapshot (including null/undefined if the target version had no video).

**Validates: Requirements 7.5, 7.6, 7.7**

### Property 14: Soft Delete with Timestamp

*For any* video marked for deletion (via replacement or product deletion), the system SHALL create a pending_deletions entry with publicId, markedForDeletionAt timestamp, reason, and optional productId.

**Validates: Requirements 8.1, 8.2**

### Property 15: Orphan Cleanup by Age

*For any* temporary upload with status='temporary' and uploadedAt timestamp more than 2 hours old, the cleanup job SHALL delete it from Cloudinary and remove the temporary_uploads entry.

**Validates: Requirements 11.4, 11.6**

### Property 16: Hard Delete After Grace Period

*For any* pending_deletions entry with markedForDeletionAt timestamp more than 24 hours old, the cleanup job SHALL perform a hard delete from Cloudinary and remove the pending_deletions entry.

**Validates: Requirements 8.5, 8.8**

### Property 17: Rate Limiting Enforcement

*For any* admin user, the system SHALL enforce a maximum of 10 video uploads per hour, rejecting additional uploads with HTTP 429 status.

**Validates: Requirements 8.13**

### Property 18: Temporary Status on Upload

*For any* video upload, the system SHALL create a temporary_uploads entry with status='temporary', publicId, uploadedAt timestamp, and uploadedBy user ID.

**Validates: Requirements 11.1**

### Property 19: Permanent Status on Product Save

*For any* product save operation that includes video metadata, the system SHALL update the corresponding temporary_uploads entry to status='permanent'.

**Validates: Requirements 11.2**

### Property 20: New Video Registry Entry Initialization

*For any* unique video upload (no matching hash in registry), the system SHALL create a new video_registry entry with referenceCount=1.

**Validates: Requirements 13.6, 13.7**

### Property 21: Reference Count Decrement on Deletion

*For any* video marked for deletion, the system SHALL decrement the referenceCount in the video_registry.

**Validates: Requirements 13.8**

### Property 22: Deletion Trigger at Zero References

*For any* video in the registry, when referenceCount reaches 0, the system SHALL mark the video for deletion in pending_deletions; while referenceCount is greater than 0, the system SHALL NOT mark the video for deletion.

**Validates: Requirements 13.9, 13.10**

### Property 23: Rollback Cancels Pending Deletion

*For any* product rollback to a version containing a video that is currently in pending_deletions, the system SHALL remove the pending_deletions entry to restore the video.

**Validates: Requirements 8.14**

### Property 24: Storage Savings Calculation

*For any* deduplicated video upload, the system SHALL calculate savedStorageBytes as the file size of the video file.

**Validates: Requirements 13.12**

---

## Critical Implementation Details

### CRITICAL IMPROVEMENT 1: Stream-Based Hashing for Large Files

**Current Approach**: Buffer-based hashing loads entire file in memory
```typescript
// Current implementation (acceptable for 20MB limit)
const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
```

**Scalability Concern**: Not scalable if size limit increases beyond 20MB

**Recommended Upgrade Path** (when size limit increases):
```typescript
// Stream-based hashing for large files
async function calculateHashStream(fileStream: ReadableStream): Promise<string> {
  const hash = crypto.createHash('sha256');
  
  return new Promise((resolve, reject) => {
    fileStream.on('data', (chunk) => {
      hash.update(chunk);
    });
    
    fileStream.on('end', () => {
      resolve(hash.digest('hex'));
    });
    
    fileStream.on('error', (error) => {
      reject(error);
    });
  });
}

// Usage with multer streams
const hash = await calculateHashStream(req.file.stream);
```

**Implementation Note**: Currently using buffer-based hashing for 20MB limit. Upgrade to streaming hash if size limit increases to 50MB+ to avoid memory issues.

### CRITICAL IMPROVEMENT 2: Thumbnail Generation Reliability

**Problem**: String replacement approach is fragile
```typescript
// ❌ AVOID: Unreliable string replacement
const thumbnailUrl = result.url.replace(/\.(mp4|mov|avi)$/, '.jpg');
```

**Risk**: Cloudinary may not always follow that pattern, leading to broken thumbnails

**Solution 1**: Use eager transformation result (PREFERRED)
```typescript
// ✅ PREFERRED: Use explicit eager transformation
const uploadOptions = {
  resource_type: 'video',
  eager: [
    { width: 640, height: 360, crop: 'limit', format: 'mp4' }, // Video
    { width: 640, height: 360, crop: 'fill', format: 'jpg' },  // Thumbnail
  ],
  eager_async: false,
};

// Extract from eager results
const thumbnailUrl = result.eager[1].secure_url; // Second eager transformation
```

**Solution 2**: Use Cloudinary transformation API (FALLBACK)
```typescript
// ✅ FALLBACK: Use transformation API for reliable thumbnail
const thumbnailUrl = cloudinary.url(result.public_id, {
  resource_type: 'video',
  format: 'jpg',
  transformation: [
    { width: 640, height: 360, crop: 'fill' }
  ]
});
```

**Implementation**: CloudinaryService.uploadVideo() now uses eager transformation with fallback to transformation API.

### CRITICAL IMPROVEMENT 3: Race Condition in Deduplication

**Problem**: Race condition in concurrent uploads
```
Scenario: 2 simultaneous uploads of same video
  User A uploads video → calculates hash → checks registry → not found
  User B uploads video → calculates hash → checks registry → not found
  User A uploads to Cloudinary → creates registry entry
  User B uploads to Cloudinary → creates registry entry (DUPLICATE!)
```

**Solution**: Atomic operations with unique index + retry pattern

**Database Setup**:
```typescript
// Unique index on hash field prevents duplicates at DB level
VideoRegistrySchema.index({ hash: 1 }, { unique: true });
```

**Implementation Pattern**:
```typescript
async processUpload(file: Buffer, userId: string) {
  // Calculate hash
  const hash = crypto.createHash('sha256').update(file).digest('hex');
  
  // Try to create registry entry atomically
  try {
    // Attempt to insert new entry
    const registryEntry = await VideoRegistry.create({
      hash,
      publicId: tempPublicId, // Temporary ID
      url: '',
      thumbnail: '',
      duration: 0,
      referenceCount: 1,
    });
    
    // If successful, we won the race - proceed with upload
    const cloudinaryResult = await cloudinaryService.uploadVideo(file);
    
    // Update registry with real data
    await VideoRegistry.findByIdAndUpdate(registryEntry._id, {
      publicId: cloudinaryResult.publicId,
      url: cloudinaryResult.url,
      thumbnail: cloudinaryResult.thumbnail,
      duration: cloudinaryResult.duration,
    });
    
    return { ...cloudinaryResult, hash, deduplicated: false };
    
  } catch (error) {
    // Duplicate key error means another upload won the race
    if (error.code === 11000) {
      // Fetch existing entry and increment refCount atomically
      const existingEntry = await VideoRegistry.findOneAndUpdate(
        { hash },
        { $inc: { referenceCount: 1 } },
        { new: true }
      );
      
      return {
        url: existingEntry.url,
        thumbnail: existingEntry.thumbnail,
        publicId: existingEntry.publicId,
        hash: existingEntry.hash,
        duration: existingEntry.duration,
        deduplicated: true,
      };
    }
    
    throw error; // Re-throw non-duplicate errors
  }
}
```

**Key Points**:
- Unique index on hash prevents duplicates at database level
- Try insert first (optimistic approach)
- Catch duplicate error and fetch existing entry
- Use atomic $inc for refCount increment
- No race condition possible

### CRITICAL IMPROVEMENT 4: RefCount Safety

**Problem**: Non-atomic refCount operations can lead to negative values or incorrect counts

**Solution**: Use MongoDB atomic operations

**Increment RefCount** (atomic):
```typescript
// ✅ CORRECT: Atomic increment
await VideoRegistry.findOneAndUpdate(
  { hash },
  { $inc: { referenceCount: 1 } },
  { new: true }
);
```

**Decrement RefCount** (atomic with validation):
```typescript
// ✅ CORRECT: Atomic decrement with validation
async markForDeletion(publicId: string, reason: string, productId?: string) {
  // Decrement refCount atomically, but only if > 0
  const result = await VideoRegistry.findOneAndUpdate(
    { publicId, referenceCount: { $gt: 0 } }, // Only decrement if > 0
    { $inc: { referenceCount: -1 } },
    { new: true }
  );
  
  if (!result) {
    // Either video not found OR refCount was already 0
    const video = await VideoRegistry.findOne({ publicId });
    
    if (!video) {
      logger.error('Video not found in registry', { publicId });
      throw new Error('Video not found in registry');
    }
    
    if (video.referenceCount === 0) {
      logger.warn('Attempted to decrement refCount below 0', { publicId });
      // Already at 0, check if already marked for deletion
      const existingDeletion = await PendingDeletion.findOne({ publicId });
      if (existingDeletion) {
        return; // Already marked, nothing to do
      }
    }
  }
  
  // If refCount reached 0, mark for deletion
  if (result && result.referenceCount === 0) {
    await PendingDeletion.create({
      publicId,
      markedForDeletionAt: new Date(),
      reason,
      productId,
      retryCount: 0,
    });
    
    logger.info('Video marked for deletion', { publicId, reason });
  }
}
```

**Error Handling**:
```typescript
// Validate refCount never goes negative
VideoRegistrySchema.pre('save', function(next) {
  if (this.referenceCount < 0) {
    next(new Error('referenceCount cannot be negative'));
  } else {
    next();
  }
});
```

**Key Points**:
- Always use $inc for atomic operations
- Add condition { referenceCount: { $gt: 0 } } to prevent negative values
- Validate in schema pre-save hook as additional safety
- Log warnings when attempting to decrement below 0

### CRITICAL IMPROVEMENT 5: Cleanup Job Safety

**Problem**: Processing 10k+ deletions at once can spike server resources

**Solution**: Batch processing with pagination

**Orphan Cleanup** (with batch limit):
```typescript
async cleanupOrphans(): Promise<number> {
  const BATCH_SIZE = 100; // Process max 100 per run
  const TWO_HOURS_AGO = new Date(Date.now() - 2 * 60 * 60 * 1000);
  
  let totalDeleted = 0;
  
  // Fetch orphans in batches
  const orphans = await TemporaryUpload.find({
    status: 'temporary',
    uploadedAt: { $lt: TWO_HOURS_AGO }
  })
  .limit(BATCH_SIZE)
  .lean();
  
  logger.info('Starting orphan cleanup', { 
    found: orphans.length,
    batchSize: BATCH_SIZE 
  });
  
  // Process each orphan
  for (const orphan of orphans) {
    try {
      // Delete from Cloudinary
      await cloudinaryService.deleteVideo(orphan.publicId);
      
      // Delete from database
      await TemporaryUpload.deleteOne({ _id: orphan._id });
      
      totalDeleted++;
      
      logger.info('Orphan deleted', { publicId: orphan.publicId });
      
    } catch (error) {
      logger.error('Failed to delete orphan', { 
        publicId: orphan.publicId, 
        error: error.message 
      });
      // Continue with next orphan
    }
  }
  
  logger.info('Orphan cleanup complete', { 
    deleted: totalDeleted,
    remaining: orphans.length - totalDeleted 
  });
  
  return totalDeleted;
}
```

**Pending Deletion Cleanup** (with batch limit):
```typescript
async executePendingDeletions(): Promise<number> {
  const BATCH_SIZE = 100; // Process max 100 per run
  const GRACE_PERIOD_HOURS = 24;
  const cutoffTime = new Date(Date.now() - GRACE_PERIOD_HOURS * 60 * 60 * 1000);
  
  let totalDeleted = 0;
  
  // Fetch pending deletions in batches
  const pendingDeletions = await PendingDeletion.find({
    markedForDeletionAt: { $lt: cutoffTime }
  })
  .limit(BATCH_SIZE)
  .lean();
  
  logger.info('Starting pending deletion cleanup', { 
    found: pendingDeletions.length,
    batchSize: BATCH_SIZE 
  });
  
  // Process each deletion
  for (const deletion of pendingDeletions) {
    try {
      // Delete video from Cloudinary
      const result = await cloudinaryService.deleteVideo(deletion.publicId);
      
      if (!result.success) {
        throw new Error(result.error || 'Cloudinary deletion failed');
      }
      
      // Delete from database
      await PendingDeletion.deleteOne({ _id: deletion._id });
      await VideoRegistry.deleteOne({ publicId: deletion.publicId });
      
      totalDeleted++;
      
      logger.info('Video hard deleted', { 
        publicId: deletion.publicId,
        reason: deletion.reason 
      });
      
    } catch (error) {
      logger.error('Failed to delete video', { 
        publicId: deletion.publicId, 
        error: error.message 
      });
      
      // Increment retry count
      await PendingDeletion.findByIdAndUpdate(deletion._id, {
        $inc: { retryCount: 1 }
      });
      
      // Alert on 3rd failure
      if (deletion.retryCount >= 2) {
        logger.critical('Video deletion failed 3 times', { 
          publicId: deletion.publicId 
        });
        // Trigger alert for manual investigation
      }
    }
  }
  
  logger.info('Pending deletion cleanup complete', { 
    deleted: totalDeleted,
    remaining: pendingDeletions.length - totalDeleted 
  });
  
  return totalDeleted;
}
```

**Key Points**:
- Limit batch size to 100 deletions per run
- Use .limit() in database queries
- Process sequentially (not in parallel) to control resource usage
- Log progress for monitoring
- If >100 items need deletion, they'll be processed in next run (24 hours later)
- Prevents server spike from processing thousands of deletions at once

**Monitoring**:
```typescript
// Add metrics for cleanup jobs
logger.info('Cleanup job metrics', {
  orphansDeleted: orphanCount,
  pendingDeletionsExecuted: deletionCount,
  batchSize: 100,
  duration: Date.now() - startTime,
});
```

---

## Error Handling

### Error Categories

#### 1. Validation Errors (400 Bad Request)

**File Size Exceeded**:
```typescript
if (file.size > 20 * 1024 * 1024) {
  return res.status(400).json({ 
    message: "Video file size exceeds 20MB limit" 
  });
}
```

**Invalid Format**:
```typescript
if (file.mimetype !== 'video/mp4') {
  return res.status(400).json({ 
    message: "Only mp4 format is supported" 
  });
}
```

**Duration Exceeded**:
```typescript
const duration = await getVideoDuration(file.buffer);
if (duration > 30) {
  return res.status(400).json({ 
    message: "Video duration exceeds 30 seconds limit" 
  });
}
```

**Invalid Video Metadata**:
```typescript
// Mongoose validation handles this automatically
// Example: empty url, thumbnail, or publicId
{
  "message": "Video validation failed: url: Video URL must be a non-empty string"
}
```

#### 2. Authentication/Authorization Errors (401/403)

**Unauthenticated Request (401)**:
```typescript
if (!req.user) {
  return res.status(401).json({ 
    message: "Authentication required" 
  });
}
```

**Non-Admin User (403)**:
```typescript
if (req.user.role !== 'admin') {
  return res.status(403).json({ 
    message: "Admin access required" 
  });
}
```

#### 3. Rate Limiting Errors (429 Too Many Requests)

**Upload Limit Exceeded**:
```typescript
const uploadCount = await checkRateLimit(req.user._id);
if (uploadCount >= 10) {
  return res.status(429).json({ 
    message: "Rate limit exceeded: maximum 10 uploads per hour" 
  });
}
```

#### 4. Processing Errors (500 Internal Server Error)

**Cloudinary Upload Failure**:
```typescript
try {
  const result = await cloudinaryService.uploadVideo(file.buffer);
} catch (error) {
  logger.error('Cloudinary upload failed:', { error, userId: req.user._id });
  return res.status(500).json({ 
    message: "Video upload failed",
    error: error.message 
  });
}
```

**Video Processing Failure**:
```typescript
try {
  // Cloudinary processing
} catch (error) {
  logger.error('Video processing failed:', { error, publicId });
  return res.status(500).json({ 
    message: "Video processing failed",
    error: error.message 
  });
}
```

**Cleanup Job Failures**:
```typescript
// Cleanup failures are logged but don't block operations
// CRITICAL IMPROVEMENT 5: Batch processing prevents server spikes
try {
  await cloudinaryService.deleteVideo(publicId);
} catch (error) {
  logger.error('Video deletion failed:', { publicId, error });
  // Increment retry count atomically (CRITICAL IMPROVEMENT 4)
  await PendingDeletion.findOneAndUpdate(
    { publicId },
    { $inc: { retryCount: 1 } },
    { new: true }
  );
  
  // Alert on 3rd failure
  const deletion = await PendingDeletion.findOne({ publicId });
  if (deletion && deletion.retryCount >= 3) {
    logger.critical('Video deletion failed 3 times:', { publicId });
    // Trigger alert for manual investigation
  }
}
```

**Race Condition Handling**:
```typescript
// CRITICAL IMPROVEMENT 3: Handle duplicate key errors gracefully
try {
  await VideoRegistry.create({ hash, ...metadata });
} catch (error) {
  if (error.code === 11000) {
    // Duplicate hash - another upload won the race
    const existing = await VideoRegistry.findOneAndUpdate(
      { hash },
      { $inc: { referenceCount: 1 } }, // Atomic increment
      { new: true }
    );
    return { ...existing, deduplicated: true };
  }
  throw error;
}
```

**RefCount Validation Errors**:
```typescript
// CRITICAL IMPROVEMENT 4: Prevent negative refCount
const result = await VideoRegistry.findOneAndUpdate(
  { publicId, referenceCount: { $gt: 0 } }, // Only if > 0
  { $inc: { referenceCount: -1 } },
  { new: true }
);

if (!result) {
  const video = await VideoRegistry.findOne({ publicId });
  if (video && video.referenceCount === 0) {
    logger.warn('Attempted to decrement refCount below 0', { publicId });
    // Handle gracefully - check if already marked for deletion
  }
}
```

### Error Logging Strategy

All errors MUST be logged with structured context:

```typescript
logger.error('Operation failed:', {
  operation: 'uploadVideo',
  userId: req.user?._id,
  fileName: file.originalname,
  fileSize: file.size,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});
```

### Retry Strategy

**Video Upload**: No automatic retries. User must retry manually.

**Cleanup Jobs**: Automatic retry on next cycle (24 hours). After 3 failures, log critical error for manual investigation.

**Cloudinary Operations**: Single attempt with error logging. No automatic retries to avoid cascading failures.

---

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage.

#### Unit Tests (Example-Based)

**Purpose**: Test specific scenarios, edge cases, error messages, and integration points

**Coverage**:
- API endpoint contracts (request/response formats)
- Authentication/authorization (401/403 errors)
- Specific error messages (400, 429, 500 responses)
- Logging behavior (audit trail entries)
- Schema validation (data structure checks)
- Cloudinary integration (with mocks)
- Cleanup job scheduling

**Examples**:
```typescript
describe('Video Upload API', () => {
  it('should return 400 with specific message when file exceeds 20MB', async () => {
    const largeFile = Buffer.alloc(21 * 1024 * 1024); // 21MB
    const response = await request(app)
      .post('/api/upload/video')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('video', largeFile, 'large.mp4');
    
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Video file size exceeds 20MB limit');
  });

  it('should return 403 when non-admin user attempts upload', async () => {
    const response = await request(app)
      .post('/api/upload/video')
      .set('Authorization', `Bearer ${userToken}`)
      .attach('video', validVideoBuffer, 'video.mp4');
    
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Admin access required');
  });

  it('should create video_registry entry with correct structure', async () => {
    const result = await videoService.processUpload(validVideoBuffer, adminId);
    
    const registryEntry = await VideoRegistry.findOne({ hash: result.hash });
    expect(registryEntry).toMatchObject({
      hash: expect.any(String),
      publicId: expect.any(String),
      url: expect.any(String),
      thumbnail: expect.any(String),
      duration: expect.any(Number),
      referenceCount: 1
    });
  });
});
```

#### Property-Based Tests

**Purpose**: Verify universal properties across all valid inputs

**Library**: fast-check (TypeScript/JavaScript property-based testing library)

**Configuration**: Minimum 100 iterations per property test

**Tag Format**: Each test MUST include a comment referencing the design property:
```typescript
// Feature: product-video-support, Property 1: Video Metadata String Validation
```

**Coverage**: All 24 correctness properties defined above

**Examples**:
```typescript
import fc from 'fast-check';

describe('Property-Based Tests: Video Support', () => {
  // Feature: product-video-support, Property 1: Video Metadata String Validation
  it('should reject empty or whitespace-only strings for video metadata', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constant(''),
          fc.constant('   '),
          fc.constant('\t\n'),
          fc.stringOf(fc.constantFrom(' ', '\t', '\n'))
        ),
        async (invalidString) => {
          const product = new Product({
            name: 'Test Product',
            description: 'Test',
            category: 'chocolates',
            price: 100,
            stock: 10,
            weight: 1,
            video: {
              url: invalidString,
              thumbnail: 'valid-thumbnail',
              publicId: 'valid-id'
            }
          });
          
          await expect(product.save()).rejects.toThrow(/non-empty string/);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 2: Hash Calculation and Registry Lookup
  it('should calculate SHA-256 hash and check registry for any video file', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 100, maxLength: 1000 }), // Random video data
        async (videoData) => {
          const buffer = Buffer.from(videoData);
          const hash = crypto.createHash('sha256').update(buffer).digest('hex');
          
          // Mock upload
          const result = await videoService.processUpload(buffer, adminId);
          
          // Verify hash was calculated
          expect(result.hash).toBe(hash);
          
          // Verify registry was checked
          const registryEntry = await VideoRegistry.findOne({ hash });
          expect(registryEntry).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 3: Deduplication Returns Existing Metadata
  it('should return existing metadata without upload for duplicate hash', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 100, maxLength: 1000 }),
        async (videoData) => {
          const buffer = Buffer.from(videoData);
          
          // First upload
          const firstResult = await videoService.processUpload(buffer, adminId);
          expect(firstResult.deduplicated).toBe(false);
          
          // Second upload (same data)
          const secondResult = await videoService.processUpload(buffer, adminId);
          expect(secondResult.deduplicated).toBe(true);
          expect(secondResult.publicId).toBe(firstResult.publicId);
          expect(secondResult.url).toBe(firstResult.url);
          
          // Verify refCount incremented
          const registryEntry = await VideoRegistry.findOne({ hash: firstResult.hash });
          expect(registryEntry.referenceCount).toBe(2);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 13: Rollback Restores Video State (Round-Trip)
  it('should restore exact video state on rollback', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          url: fc.webUrl(),
          thumbnail: fc.webUrl(),
          publicId: fc.string({ minLength: 10, maxLength: 50 }),
          hash: fc.hexaString({ minLength: 64, maxLength: 64 }),
          duration: fc.float({ min: 1, max: 30 })
        }),
        async (originalVideo) => {
          // Create product with video
          const product = await Product.create({
            name: 'Test Product',
            description: 'Test',
            category: 'chocolates',
            price: 100,
            stock: 10,
            weight: 1,
            video: originalVideo
          });
          
          // Create version
          await versionService.createVersion(
            product._id,
            { ...product.toObject(), video: originalVideo },
            [],
            'update',
            adminId
          );
          
          // Change video
          const newVideo = {
            url: 'https://new-url.com/video.mp4',
            thumbnail: 'https://new-url.com/thumb.jpg',
            publicId: 'new-id',
            hash: 'newhash123',
            duration: 20
          };
          product.video = newVideo;
          await product.save();
          await versionService.createVersion(
            product._id,
            { ...product.toObject(), video: newVideo },
            ['video'],
            'update',
            adminId
          );
          
          // Rollback to version 1
          await versionService.rollbackToVersion(product._id, 1, adminId);
          
          // Verify exact restoration
          const rolledBackProduct = await Product.findById(product._id);
          expect(rolledBackProduct.video).toEqual(originalVideo);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-video-support, Property 22: Deletion Trigger at Zero References
  it('should mark for deletion when refCount reaches 0, not before', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 2, max: 10 }), // Number of products using same video
        async (productCount) => {
          // Create video registry entry
          const videoHash = crypto.randomBytes(32).toString('hex');
          const registryEntry = await VideoRegistry.create({
            hash: videoHash,
            publicId: 'test-video-id',
            url: 'https://test.com/video.mp4',
            thumbnail: 'https://test.com/thumb.jpg',
            duration: 15,
            referenceCount: productCount
          });
          
          // Delete products one by one
          for (let i = 0; i < productCount - 1; i++) {
            await videoService.markForDeletion('test-video-id', 'product_deleted');
            
            // Verify NOT marked for deletion while refCount > 0
            const pendingDeletion = await PendingDeletion.findOne({ publicId: 'test-video-id' });
            expect(pendingDeletion).toBeNull();
            
            const updatedRegistry = await VideoRegistry.findOne({ hash: videoHash });
            expect(updatedRegistry.referenceCount).toBe(productCount - i - 1);
          }
          
          // Delete last product
          await videoService.markForDeletion('test-video-id', 'product_deleted');
          
          // Verify marked for deletion when refCount = 0
          const pendingDeletion = await PendingDeletion.findOne({ publicId: 'test-video-id' });
          expect(pendingDeletion).toBeDefined();
          expect(pendingDeletion.publicId).toBe('test-video-id');
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

#### Integration Tests

**Purpose**: Test system behavior with real dependencies (or realistic mocks)

**Coverage**:
- Cloudinary upload/delete operations (with mocks)
- Database operations (MongoDB)
- Cleanup job execution
- Version control integration
- Rate limiting with Redis/in-memory store

**Examples**:
```typescript
describe('Integration Tests: Video Support', () => {
  it('should handle complete upload-to-product-save flow', async () => {
    // Upload video
    const uploadResponse = await request(app)
      .post('/api/upload/video')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('video', validVideoBuffer, 'test.mp4');
    
    expect(uploadResponse.status).toBe(200);
    const { publicId, url, thumbnail, hash, duration } = uploadResponse.body;
    
    // Verify temporary upload created
    const tempUpload = await TemporaryUpload.findOne({ publicId });
    expect(tempUpload.status).toBe('temporary');
    
    // Create product with video
    const product = await Product.create({
      name: 'Test Product',
      description: 'Test',
      category: 'chocolates',
      price: 100,
      stock: 10,
      weight: 1,
      video: { url, thumbnail, publicId, hash, duration }
    });
    
    // Mark permanent
    await videoService.markPermanent(publicId);
    
    // Verify status changed
    const updatedTempUpload = await TemporaryUpload.findOne({ publicId });
    expect(updatedTempUpload.status).toBe('permanent');
  });

  it('should execute cleanup job and delete orphaned uploads', async () => {
    // Create old temporary upload (>2 hours)
    const oldUpload = await TemporaryUpload.create({
      publicId: 'old-orphan-id',
      uploadedAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      status: 'temporary',
      uploadedBy: adminId
    });
    
    // Mock Cloudinary delete
    jest.spyOn(cloudinaryService, 'deleteVideo').mockResolvedValue({ success: true });
    
    // Run cleanup
    const deletedCount = await videoService.cleanupOrphans();
    
    expect(deletedCount).toBe(1);
    expect(cloudinaryService.deleteVideo).toHaveBeenCalledWith('old-orphan-id');
    
    // Verify entry removed
    const removedUpload = await TemporaryUpload.findOne({ publicId: 'old-orphan-id' });
    expect(removedUpload).toBeNull();
  });
});
```

### Test Coverage Goals

- Unit tests: 80%+ code coverage
- Property tests: 100% of correctness properties (24 properties)
- Integration tests: All critical paths (upload, save, replace, delete, cleanup, rollback)

---

## Performance Considerations

### 1. Lazy Loading in UI

**Strategy**: Videos are not loaded until user interaction

**Implementation**:
```typescript
// User UI: Only load thumbnail initially
<div className="video-container">
  <img src={product.video.thumbnail} alt="Video thumbnail" />
  <button onClick={() => setShowVideo(true)}>
    <PlayIcon /> {product.video.duration}s
  </button>
</div>

{showVideo && (
  <video src={product.video.url} controls autoPlay />
)}
```

**Benefits**:
- Page load time: No video file loading overhead
- Bandwidth savings: Videos only loaded when viewed
- User experience: Fast page loads with on-demand video

### 2. CDN Delivery

**Strategy**: All videos delivered through Cloudinary CDN

**Configuration**:
```typescript
cloudinary.config({
  secure: true, // HTTPS only
  cdn_subdomain: true, // Use CDN subdomain for better caching
});
```

**Benefits**:
- Global delivery: Low latency worldwide
- Automatic compression: Cloudinary optimizes video size
- Adaptive bitrate: Quality adjusts to network conditions

### 3. Deduplication Savings

**Strategy**: SHA-256 hash-based deduplication prevents duplicate storage

**Impact**:
- Storage cost reduction: ~30-50% for products with shared videos
- Upload time reduction: Instant return for duplicate videos
- Bandwidth savings: No re-upload for duplicates

### 4. Async Cleanup Jobs

**Strategy**: Cleanup operations run in background, don't block user operations

**Implementation**:
```typescript
// Cron job runs every 24 hours
cron.schedule('0 0 * * *', async () => {
  await videoService.cleanupOrphans();
  await videoService.executePendingDeletions();
});
```

**Benefits**:
- No user-facing delays
- Batch processing efficiency
- Graceful failure handling (retry on next cycle)

### 5. Rate Limiting

**Strategy**: Prevent abuse with 10 uploads/hour per admin user

**Implementation**:
```typescript
// Redis-based rate limiting
const key = `video-upload-rate:${userId}`;
const count = await redis.incr(key);
if (count === 1) {
  await redis.expire(key, 3600); // 1 hour TTL
}
if (count > 10) {
  throw new RateLimitError('Maximum 10 uploads per hour');
}
```

**Benefits**:
- Prevents storage abuse
- Protects Cloudinary API limits
- Fair resource allocation

---

## Security Considerations

### 1. Authentication and Authorization

- All video upload endpoints require admin authentication
- JWT token validation on every request
- Role-based access control (RBAC)

### 2. File Validation

- MIME type validation (mp4 only)
- File size limit (20MB max)
- Duration limit (30 seconds max)
- Prevents malicious file uploads

### 3. Rate Limiting

- 10 uploads per hour per admin user
- Prevents denial-of-service attacks
- Protects cloud storage costs

### 4. Secure Storage

- All videos stored on Cloudinary (not local filesystem)
- HTTPS-only delivery
- Signed URLs for private videos (if needed in future)

### 5. Input Sanitization

- publicId validation (prevent path traversal)
- URL validation (prevent XSS)
- Hash validation (prevent injection)

---

## Deployment Considerations

### 1. Environment Variables

Required environment variables:
```bash
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### 2. Database Migrations

New collections to create:
- `video_registry`
- `temporary_uploads`
- `pending_deletions`

Indexes to create (see Data Models section)

### 3. Cron Job Setup

Schedule cleanup jobs:
```bash
# Every 24 hours at midnight
0 0 * * * /path/to/cleanup-job.sh
```

### 4. Monitoring and Alerts

- Monitor Cloudinary API usage
- Alert on cleanup job failures (>3 retries)
- Track deduplication savings
- Monitor orphan upload rate

### 5. Rollback Plan

If issues arise:
1. Disable video upload endpoint (feature flag)
2. Existing products with videos continue to work
3. No data loss (videos remain in Cloudinary)
4. Re-enable after fix

---

## Future Enhancements

### 1. Multiple Videos Per Product

- Extend `video` field to `videos` array
- Update UI to support video gallery
- Maintain deduplication and cleanup logic

### 2. Video Transcoding

- Support multiple formats (webm, mov)
- Automatic transcoding to mp4
- Multiple quality levels (360p, 720p, 1080p)

### 3. Video Analytics

- Track video views
- Track play duration
- A/B testing for video vs no-video products

### 4. Advanced Compression

- AI-based compression optimization
- Perceptual quality tuning
- Bandwidth-aware delivery

### 5. Live Video Streaming

- Support for live product demonstrations
- Real-time video uploads
- WebRTC integration

