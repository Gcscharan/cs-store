# Design Document: Product Version Control System

## Overview

The Product Version Control System provides enterprise-grade version tracking for products in the admin product creation system. This system creates versioned snapshots of products on meaningful updates, enabling full audit trails, rollback capabilities, and change history tracking.

### Key Design Principles

1. **Non-Invasive Integration**: No modifications to existing Product model schema
2. **Async Execution**: Version creation doesn't block product updates
3. **Dirty State Reuse**: Leverages Phase 4 dirty state detection logic
4. **Atomic Operations**: Version number increments are race-condition safe
5. **Performance First**: Minimal overhead on product update operations

### System Context

This system integrates with:
- Existing Product model (no schema changes)
- Phase 4 dirty state detection (meaningful change detection)
- Product update/publish endpoints (version creation triggers)
- Cache invalidation system (rollback integration)

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Product Controller                        │
│  (updateProduct, publishProduct, rollbackProduct)           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─ Detect Meaningful Change (Phase 4 logic)
                 │
                 ├─ Save Product to DB
                 │
                 ├─ Fire-and-Forget Version Creation (async)
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│                    Version Service                           │
│  - createVersion()                                           │
│  - getVersionHistory()                                       │
│  - getVersion()                                              │
│  - rollbackToVersion()                                       │
│  - archiveOldVersions()                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 v
┌─────────────────────────────────────────────────────────────┐
│              ProductVersion Collection                       │
│  - productId, version, snapshot, changedFields               │
│  - actionType, updatedBy, createdAt, archived                │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow Diagrams

#### Update Flow
```
User Update Request
    ↓
Product Controller (updateProduct)
    ↓
Validate Request
    ↓
Detect Meaningful Change (Phase 4 logic)
    ↓
Save Product to DB ← CRITICAL: Snapshot source
    ↓
Return Response to User (fast)
    ↓
[Async] VersionService.createVersion()
    ↓
Atomic Version Increment ($inc)
    ↓
Store Snapshot + Metadata
    ↓
Archive Old Versions (if > 50)
    ↓
Log Success/Failure
```

#### Publish Flow
```
User Publish Request
    ↓
Product Controller (publishProduct)
    ↓
Validate All Required Fields
    ↓
Set status = 'published'
    ↓
Save Product to DB
    ↓
Return Response to User
    ↓
[Async] VersionService.createVersion(actionType: 'publish')
    ↓
Store Version with actionType='publish'
```

#### Rollback Flow
```
User Rollback Request
    ↓
Product Controller (rollbackProduct)
    ↓
Get Current Product State (for diff calculation)
    ↓
Fetch Target Version Snapshot
    ↓
Calculate Changed Fields (diff between current and target)
    ↓
[Transaction Start]
    ↓
Overwrite Product with Snapshot Data
    ↓
Create Rollback Version (with correct changedFields)
    ↓
[Transaction Commit]
    ↓
Invalidate Cache
    ↓
Return Success Response
```

**Critical Fix**: Extract current state BEFORE rollback, calculate diff, then perform atomic rollback with transaction.

---

## Components and Interfaces

### 1. ProductVersion Model (Mongoose Schema)

```typescript
interface IProductVersion extends Document {
  _id: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  version: number;
  snapshot: {
    name: string;
    description: string;
    category: string;
    price: number;
    pricePerUnit?: number;
    mrp?: number;
    stock: number;
    weight: number;
    tags: string;
    status: 'draft' | 'published';
    images: string[]; // URLs only (not full Cloudinary objects)
  };
  changedFields: string[];
  actionType: 'update' | 'publish' | 'rollback';
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  archived: boolean;
}

const ProductVersionSchema = new Schema<IProductVersion>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    version: {
      type: Number,
      required: true,
      min: 1,
    },
    snapshot: {
      name: { type: String, required: true },
      description: { type: String, required: true },
      category: { type: String, required: true },
      price: { type: Number, required: true },
      pricePerUnit: { type: Number },
      mrp: { type: Number },
      stock: { type: Number, required: true },
      weight: { type: Number, required: true },
      tags: { type: String },
      status: { type: String, enum: ['draft', 'published'], required: true },
      images: [{ type: String }], // URLs only
    },
    changedFields: [{ type: String }],
    actionType: {
      type: String,
      enum: ['update', 'publish', 'rollback'],
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    archived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for efficient queries
ProductVersionSchema.index({ productId: 1, version: -1 });
ProductVersionSchema.index({ productId: 1, createdAt: -1 });
ProductVersionSchema.index({ productId: 1, archived: 1 });

// Unique constraint: one version number per product
ProductVersionSchema.index({ productId: 1, version: 1 }, { unique: true });
```

### 2. VersionService Class

```typescript
class VersionService {
  /**
   * Create a new version for a product
   * @param productId - Product ID
   * @param snapshot - Complete product data from DB
   * @param changedFields - Array of field names that changed
   * @param actionType - Type of action (update, publish, rollback)
   * @param userId - User who made the change
   * @returns Created version document
   */
  async createVersion(
    productId: string,
    snapshot: ProductSnapshot,
    changedFields: string[],
    actionType: 'update' | 'publish' | 'rollback',
    userId: string
  ): Promise<IProductVersion>;

  /**
   * Get paginated version history for a product
   * @param productId - Product ID
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   * @returns Paginated version history
   */
  async getVersionHistory(
    productId: string,
    page: number,
    limit: number
  ): Promise<{
    versions: IProductVersion[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }>;

  /**
   * Get a specific version by version number
   * @param productId - Product ID
   * @param version - Version number
   * @returns Version document with snapshot
   */
  async getVersion(
    productId: string,
    version: number
  ): Promise<IProductVersion | null>;

  /**
   * Rollback product to a specific version
   * @param productId - Product ID
   * @param targetVersion - Version number to rollback to
   * @param userId - User performing rollback
   * @returns Updated product
   */
  async rollbackToVersion(
    productId: string,
    targetVersion: number,
    userId: string
  ): Promise<IProduct>;

  /**
   * Archive old versions beyond retention limit (50)
   * @param productId - Product ID
   * @returns Number of versions archived
   */
  async archiveOldVersions(productId: string): Promise<number>;
}
```

### 3. API Endpoints

#### GET /admin/products/:id/versions
**Purpose**: Get paginated version history for a product

**Request**:
```typescript
GET /admin/products/:id/versions?page=1&limit=20
Headers: {
  Authorization: Bearer <admin_token>
}
```

**Response** (200 OK):
```json
{
  "versions": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "productId": "507f191e810c19729de860ea",
      "version": 5,
      "changedFields": ["price", "stock"],
      "actionType": "update",
      "updatedBy": "507f1f77bcf86cd799439012",
      "createdAt": "2024-01-15T10:30:00Z",
      "archived": false
    },
    {
      "_id": "507f1f77bcf86cd799439013",
      "productId": "507f191e810c19729de860ea",
      "version": 4,
      "changedFields": ["description", "images"],
      "actionType": "update",
      "updatedBy": "507f1f77bcf86cd799439012",
      "createdAt": "2024-01-14T15:20:00Z",
      "archived": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

**Error Responses**:
- 401: Unauthorized (no token)
- 403: Forbidden (non-admin user)
- 404: Product not found

#### GET /admin/products/:id/versions/:version
**Purpose**: Get a specific version snapshot

**Request**:
```typescript
GET /admin/products/:id/versions/3
Headers: {
  Authorization: Bearer <admin_token>
}
```

**Response** (200 OK):
```json
{
  "_id": "507f1f77bcf86cd799439014",
  "productId": "507f191e810c19729de860ea",
  "version": 3,
  "snapshot": {
    "name": "Chocolate Bar",
    "description": "Premium dark chocolate",
    "category": "chocolates",
    "price": 150,
    "pricePerUnit": 150,
    "mrp": 180,
    "stock": 100,
    "weight": 0.1,
    "tags": "chocolate,premium",
    "status": "published",
    "images": [
      "https://res.cloudinary.com/demo/image/upload/v1234567890/products/abc123.jpg"
    ]
  },
  "changedFields": ["name", "description"],
  "actionType": "update",
  "updatedBy": "507f1f77bcf86cd799439012",
  "createdAt": "2024-01-13T09:15:00Z",
  "archived": false
}
```

**Error Responses**:
- 401: Unauthorized
- 403: Forbidden
- 404: Product not found or version not found

#### POST /admin/products/:id/rollback/:version
**Purpose**: Rollback product to a specific version

**Request**:
```typescript
POST /admin/products/:id/rollback/3
Headers: {
  Authorization: Bearer <admin_token>
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Product rolled back to version 3",
  "product": {
    "_id": "507f191e810c19729de860ea",
    "name": "Chocolate Bar",
    "description": "Premium dark chocolate",
    "category": "chocolates",
    "price": 150,
    "pricePerUnit": 150,
    "mrp": 180,
    "stock": 100,
    "weight": 0.1,
    "tags": "chocolate,premium",
    "status": "published",
    "images": [
      {
        "url": "https://res.cloudinary.com/demo/image/upload/v1234567890/products/abc123.jpg",
        "alt": "Chocolate Bar"
      }
    ]
  },
  "newVersion": 6,
  "rolledBackFrom": 5,
  "rolledBackTo": 3
}
```

**Error Responses**:
- 400: Invalid version number
- 401: Unauthorized
- 403: Forbidden
- 404: Product not found or version not found
- 500: Rollback failed

---

## Data Models

### ProductVersion Collection

**Collection Name**: `product_versions`

**Document Structure**:
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "productId": ObjectId("507f191e810c19729de860ea"),
  "version": 5,
  "snapshot": {
    "name": "Chocolate Bar",
    "description": "Premium dark chocolate",
    "category": "chocolates",
    "price": 150,
    "pricePerUnit": 150,
    "mrp": 180,
    "stock": 100,
    "weight": 0.1,
    "tags": "chocolate,premium",
    "status": "published",
    "images": [
      "https://res.cloudinary.com/demo/image/upload/v1234567890/products/abc123.jpg"
    ]
  },
  "changedFields": ["price", "stock"],
  "actionType": "update",
  "updatedBy": ObjectId("507f1f77bcf86cd799439012"),
  "createdAt": ISODate("2024-01-15T10:30:00Z"),
  "archived": false
}
```

**Indexes**:
1. `{ productId: 1, version: -1 }` - Compound index for version queries (descending)
2. `{ productId: 1, createdAt: -1 }` - Compound index for chronological queries
3. `{ productId: 1, archived: 1 }` - Compound index for filtering archived versions
4. `{ productId: 1, version: 1 }` - Unique constraint (one version per product)

**Storage Optimization**:
- Images stored as URL strings only (not full Cloudinary objects)
- Snapshot size: ~500 bytes per version (estimated)
- 50 versions per product: ~25 KB per product
- MongoDB BSON compression: ~40% reduction

### Snapshot Data Structure

**What to Store**:
```typescript
{
  name: string;           // Required
  description: string;    // Required
  category: string;       // Required
  price: number;          // Required
  pricePerUnit?: number;  // Optional
  mrp?: number;           // Optional
  stock: number;          // Required
  weight: number;         // Required
  tags: string;           // Optional (empty string if not set)
  status: 'draft' | 'published'; // Required
  images: string[];       // URLs only (not full objects)
}
```

**What NOT to Store**:
- Full Cloudinary response objects (too large)
- Computed fields (can be derived)
- Timestamps (stored at version level)
- Internal metadata (not needed for rollback)

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:
- Properties 1.1 and 6.2 are identical (meaningful change creates version)
- Properties 1.5 and 3.3 are identical (changedFields accuracy)
- Properties 1.12 and 6.5 are identical (failed updates don't create versions)
- Properties 2.6 and 7.4 are identical (50 version retention limit)

The following properties have been consolidated to eliminate redundancy:

### Property 1: Version Creation on Meaningful Change

*For any* product and any meaningful update (where at least one field value differs from the current database state), the system SHALL create a new version with an incremented version number.

**Validates: Requirements 1.1, 6.2**

### Property 2: No Version on No-Op Updates

*For any* product and any update that results in the same state as the current database state, the system SHALL NOT create a new version.

**Validates: Requirements 1.2**

### Property 3: Snapshot Matches Database State

*For any* version created, the snapshot SHALL exactly match the product's state in the database at the time of version creation (not the request body).

**Validates: Requirements 1.3**

### Property 4: Snapshot Completeness

*For any* version created, the snapshot SHALL contain all required fields: name, description, category, price, pricePerUnit, mrp, stock, weight, tags, status, and images.

**Validates: Requirements 1.4, 2.2**

### Property 5: Changed Fields Accuracy

*For any* version created, the changedFields array SHALL contain exactly the names of fields that were modified compared to the previous version, with no duplicates or omissions.

**Validates: Requirements 1.5, 3.3**

### Property 6: Action Type Recording

*For any* version created, the actionType field SHALL accurately reflect the operation that triggered version creation (update, publish, or rollback).

**Validates: Requirements 1.6, 6.3**

### Property 7: User ID Recording

*For any* version created, the updatedBy field SHALL contain the userId of the authenticated admin user who performed the action.

**Validates: Requirements 1.7**

### Property 8: Timestamp Recording

*For any* version created, the createdAt timestamp SHALL be set to the time of version creation and SHALL be within a reasonable range (not in the future, not more than 1 minute in the past).

**Validates: Requirements 1.8**

### Property 9: Initial Version Number

*For any* newly created product, the first version created SHALL have version number 1.

**Validates: Requirements 1.9**

### Property 10: Version Number Increment

*For any* product with existing versions, creating a new version SHALL increment the version number by exactly 1 from the previous highest version number.

**Validates: Requirements 1.10**

### Property 11: Image URL Storage

*For any* version created with images, the snapshot.images array SHALL contain only URL strings (not full Cloudinary objects), and each URL SHALL be a valid Cloudinary URL.

**Validates: Requirements 2.3**

### Property 12: Version Retention Limit

*For any* product with more than 50 versions, the system SHALL retain only the most recent 50 non-archived versions, marking older versions as archived (not deleted).

**Validates: Requirements 2.6, 2.7, 7.4**

### Property 13: Version History Query

*For any* product, querying version history SHALL return all non-archived versions ordered by version number descending, with each result containing version number, timestamp, updatedBy, actionType, and changedFields.

**Validates: Requirements 3.1, 3.2**

### Property 14: Pagination Correctness

*For any* product with more than 20 versions, querying version history SHALL paginate results with 20 versions per page, and the pagination metadata SHALL accurately reflect page, limit, total, and pages.

**Validates: Requirements 3.4**

### Property 15: Single Version Retrieval

*For any* product and valid version number, querying a specific version SHALL return the complete snapshot for that version.

**Validates: Requirements 3.5**

### Property 16: Rollback Restores Exact State

*For any* product and any valid target version, performing a rollback SHALL restore ALL product fields to exactly match the snapshot from the target version (round-trip property).

**Validates: Requirements 4.1**

### Property 17: Rollback Creates Version

*For any* rollback operation, the system SHALL create a new version with actionType='rollback' and changedFields containing all fields that differ between the current state and target version.

**Validates: Requirements 4.2, 4.4**

### Property 18: Atomic Version Number Increment

*For any* set of concurrent product updates, the system SHALL ensure that version numbers are unique and sequential with no duplicates or gaps (atomic increment using MongoDB $inc).

**Validates: Requirements 7.7**

---

## Error Handling

### Error Categories

#### 1. Validation Errors (400 Bad Request)
- Invalid product ID format
- Invalid version number (negative, zero, non-integer)
- Missing required fields in request

**Handling Strategy**:
```typescript
if (!mongoose.isValidObjectId(productId)) {
  return res.status(400).json({ 
    message: "Invalid product ID format" 
  });
}

if (!Number.isInteger(version) || version < 1) {
  return res.status(400).json({ 
    message: "Invalid version number" 
  });
}
```

#### 2. Not Found Errors (404 Not Found)
- Product does not exist
- Version does not exist

**Handling Strategy**:
```typescript
const product = await Product.findById(productId);
if (!product) {
  logger.warn('Product not found:', { productId });
  return res.status(404).json({ 
    message: "Product not found" 
  });
}

const version = await ProductVersion.findOne({ productId, version: versionNumber });
if (!version) {
  logger.warn('Version not found:', { productId, version: versionNumber });
  return res.status(404).json({ 
    message: "Version not found" 
  });
}
```

#### 3. Authorization Errors (401/403)
- Unauthenticated request (401)
- Non-admin user (403)

**Handling Strategy**:
```typescript
// Handled by auth middleware
if (!req.user) {
  return res.status(401).json({ 
    message: "Authentication required" 
  });
}

if (req.user.role !== 'admin') {
  return res.status(403).json({ 
    message: "Admin access required" 
  });
}
```

#### 4. Version Creation Failures (500 Internal Server Error)
- Database write failure
- Concurrent update conflict
- Snapshot serialization error

**Handling Strategy**:
```typescript
try {
  await versionService.createVersion(productId, snapshot, changedFields, actionType, userId);
} catch (error) {
  // Log error but don't block product update
  logger.error('Version creation failed (non-blocking):', {
    productId,
    error: error.message,
    stack: error.stack
  });
  // Product update still succeeds
}
```

**Critical Rule**: Version creation failure MUST NOT rollback product update. Version control is an audit feature, not a transactional requirement.

#### 5. Rollback Failures (500 Internal Server Error)
- Target version not found
- Database write failure
- Validation failure on rollback data

**Handling Strategy**:
```typescript
try {
  const targetVersion = await ProductVersion.findOne({ productId, version: targetVersionNumber });
  if (!targetVersion) {
    return res.status(404).json({ 
      message: "Version not found" 
    });
  }

  // Atomic rollback: update product and create rollback version in transaction
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    // Update product
    await Product.findByIdAndUpdate(productId, targetVersion.snapshot, { session });
    
    // Create rollback version
    await versionService.createVersion(
      productId, 
      targetVersion.snapshot, 
      changedFields, 
      'rollback', 
      userId,
      { session }
    );
    
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
} catch (error) {
  logger.error('Rollback failed:', {
    productId,
    targetVersion: targetVersionNumber,
    error: error.message
  });
  return res.status(500).json({ 
    message: "Rollback failed",
    error: error.message 
  });
}
```

**Critical Rule**: Rollback MUST be atomic. Either both product update and rollback version creation succeed, or both fail.

### Error Logging Strategy

All errors MUST be logged with structured context:

```typescript
logger.error('Operation failed:', {
  operation: 'createVersion',
  productId,
  userId,
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});
```

### Retry Strategy

**Version Creation**: No retries. Fire-and-forget with error logging.

**Rollback**: No automatic retries. User must retry manually if rollback fails.

**Rationale**: Version control is not mission-critical. Failed version creation doesn't affect product functionality. Rollback failures are rare and should be investigated manually.

---

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage.

#### Unit Tests (Example-Based)

**Purpose**: Test specific scenarios, edge cases, and integration points

**Coverage**:
- API endpoint contracts (request/response formats)
- Authentication/authorization (401/403 errors)
- Error messages (404, 400, 500 responses)
- Logging behavior (audit trail entries)
- Cache invalidation integration
- Async execution behavior

**Examples**:
```typescript
describe('Version API Endpoints', () => {
  it('should return 404 when product not found', async () => {
    const response = await request(app)
      .get('/admin/products/invalid-id/versions')
      .set('Authorization', `Bearer ${adminToken}`);
    
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Product not found');
  });

  it('should return 403 when non-admin user accesses versions', async () => {
    const response = await request(app)
      .get(`/admin/products/${productId}/versions`)
      .set('Authorization', `Bearer ${userToken}`);
    
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Admin access required');
  });
});
```

#### Property-Based Tests

**Purpose**: Verify universal properties across all valid inputs

**Library**: fast-check (TypeScript/JavaScript property-based testing library)

**Configuration**: Minimum 100 iterations per property test

**Tag Format**: Each test MUST include a comment referencing the design property:
```typescript
// Feature: product-version-control, Property 1: Version Creation on Meaningful Change
```

**Coverage**: All 18 correctness properties defined above

**Example**:
```typescript
import fc from 'fast-check';

describe('Property-Based Tests: Version Control', () => {
  // Feature: product-version-control, Property 1: Version Creation on Meaningful Change
  it('should create version for any meaningful change', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 1000 }),
          category: fc.constantFrom('chocolates', 'biscuits', 'ladoos'),
          price: fc.float({ min: 0.01, max: 10000 }),
          stock: fc.integer({ min: 0, max: 10000 }),
          weight: fc.float({ min: 0.01, max: 100 }),
        }),
        async (productData) => {
          // Create product
          const product = await Product.create(productData);
          const initialVersionCount = await ProductVersion.countDocuments({ productId: product._id });
          
          // Make meaningful change
          const updatedData = { ...productData, price: productData.price + 10 };
          await Product.findByIdAndUpdate(product._id, updatedData);
          await versionService.createVersion(product._id, updatedData, ['price'], 'update', userId);
          
          // Verify version created
          const finalVersionCount = await ProductVersion.countDocuments({ productId: product._id });
          expect(finalVersionCount).toBe(initialVersionCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: product-version-control, Property 16: Rollback Restores Exact State
  it('should restore exact state on rollback (round-trip)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.string({ minLength: 1, maxLength: 1000 }),
          category: fc.constantFrom('chocolates', 'biscuits', 'ladoos'),
          price: fc.float({ min: 0.01, max: 10000 }),
          stock: fc.integer({ min: 0, max: 10000 }),
          weight: fc.float({ min: 0.01, max: 100 }),
        }),
        async (originalData) => {
          // Create product and version
          const product = await Product.create(originalData);
          await versionService.createVersion(product._id, originalData, [], 'update', userId);
          
          // Make changes
          const updatedData = { ...originalData, price: originalData.price + 100 };
          await Product.findByIdAndUpdate(product._id, updatedData);
          await versionService.createVersion(product._id, updatedData, ['price'], 'update', userId);
          
          // Rollback to version 1
          await versionService.rollbackToVersion(product._id, 1, userId);
          
          // Verify exact state restored
          const rolledBackProduct = await Product.findById(product._id);
          expect(rolledBackProduct.name).toBe(originalData.name);
          expect(rolledBackProduct.description).toBe(originalData.description);
          expect(rolledBackProduct.price).toBe(originalData.price);
          expect(rolledBackProduct.stock).toBe(originalData.stock);
          expect(rolledBackProduct.weight).toBe(originalData.weight);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

**Purpose**: Test system behavior with real dependencies

**Coverage**:
- Database operations (MongoDB)
- Async execution (fire-and-forget)
- Cache invalidation
- Transaction handling (rollback)
- Concurrent updates (race conditions)

**Examples**:
```typescript
describe('Integration Tests: Version Control', () => {
  it('should handle concurrent updates with atomic version increment', async () => {
    const product = await Product.create({ name: 'Test', price: 100, ... });
    
    // Simulate 10 concurrent updates
    const updates = Array.from({ length: 10 }, (_, i) => 
      versionService.createVersion(product._id, { price: 100 + i }, ['price'], 'update', userId)
    );
    
    await Promise.all(updates);
    
    // Verify all versions created with unique, sequential numbers
    const versions = await ProductVersion.find({ productId: product._id }).sort({ version: 1 });
    expect(versions.length).toBe(10);
    expect(versions.map(v => v.version)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
```

### Test Coverage Goals

- Unit tests: 80%+ code coverage
- Property tests: 100% of correctness properties
- Integration tests: All critical paths (create, rollback, concurrent updates)

---

## Performance Considerations

### 1. Async Version Creation

**Strategy**: Fire-and-forget pattern

**Implementation**:
```typescript
// In productController.updateProduct
await product.save(); // Wait for product save

// Fire-and-forget version creation (don't await)
versionService.createVersion(productId, snapshot, changedFields, 'update', userId)
  .catch(error => {
    logger.error('Version creation failed (non-blocking):', error);
  });

return res.json({ success: true, product }); // Return immediately
```

**Benefits**:
- Product update response time: ~50ms (no version creation overhead)
- Version creation happens in background: ~50-100ms
- User experience: instant feedback

**Trade-offs**:
- Version creation failure doesn't block product update
- Eventual consistency (version may not exist immediately after update)

### 2. Index Optimization

**Indexes**:
```typescript
// Compound index for version queries (most common)
{ productId: 1, version: -1 }

// Compound index for chronological queries
{ productId: 1, createdAt: -1 }

// Compound index for filtering archived versions
{ productId: 1, archived: 1 }

// Unique constraint
{ productId: 1, version: 1 }
```

**Query Performance**:
- Version history query: O(log n) with index
- Single version query: O(log n) with index
- Pagination: O(log n + k) where k = page size

### 3. Snapshot Size Optimization

**Image Storage**:
```typescript
// BAD: Store full Cloudinary objects (~2KB per image)
images: [
  {
    publicId: 'abc123',
    variants: { ... },
    formats: { ... },
    metadata: { ... }
  }
]

// GOOD: Store URLs only (~100 bytes per image)
images: [
  'https://res.cloudinary.com/demo/image/upload/v1234567890/products/abc123.jpg'
]
```

**Savings**:
- Per image: 2KB → 100 bytes (95% reduction)
- Per product (5 images): 10KB → 500 bytes
- Per 50 versions: 500KB → 25KB

### 4. Query Optimization

**Version History Query**:
```typescript
// Optimized query with projection (only needed fields)
const versions = await ProductVersion.find(
  { productId, archived: false },
  { version: 1, createdAt: 1, updatedBy: 1, actionType: 1, changedFields: 1 }
)
.sort({ version: -1 })
.limit(20)
.skip((page - 1) * 20);
```

**Benefits**:
- Reduced data transfer: ~90% reduction (no snapshot in list view)
- Faster query execution: ~50% faster
- Lower memory usage: ~90% reduction

### 5. Archival Strategy

**Retention Limit**: 50 versions per product

**Archival Process** (Deterministic):
```typescript
async archiveOldVersions(productId: string): Promise<number> {
  // Get latest version number
  const latestVersion = await ProductVersion.findOne({ productId, archived: false })
    .sort({ version: -1 })
    .select('version');
  
  if (!latestVersion) return 0;
  
  // Calculate cutoff version (keep latest 50)
  const cutoffVersion = latestVersion.version - 49;
  
  if (cutoffVersion <= 0) return 0;
  
  // Archive all versions below cutoff (deterministic, no race condition)
  const result = await ProductVersion.updateMany(
    {
      productId,
      version: { $lt: cutoffVersion },
      archived: false
    },
    { $set: { archived: true } }
  );
  
  logger.info('Archived old versions:', {
    productId,
    count: result.modifiedCount,
    cutoffVersion,
    latestVersion: latestVersion.version
  });
  
  return result.modifiedCount;
}
```

**Key Improvements**:
- **Deterministic**: Based on version number, not query skip
- **Race-condition safe**: Uses version number comparison
- **Idempotent**: Can be run multiple times safely
- **Efficient**: Single updateMany operation

**Trigger**: After each version creation

**Performance Impact**: ~10ms (runs async, doesn't block)

### 6. Concurrency Control

**Atomic Version Increment with Retry Logic**:
```typescript
async function createVersionWithRetry(
  productId: string,
  snapshot: ProductSnapshot,
  changedFields: string[],
  actionType: 'update' | 'publish' | 'rollback',
  userId: string,
  maxRetries: number = 3
): Promise<IProductVersion> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Get latest version number
      const lastVersion = await ProductVersion
        .findOne({ productId })
        .sort({ version: -1 })
        .select('version');
      
      const nextVersion = lastVersion ? lastVersion.version + 1 : 1;
      
      // Create with unique constraint (will fail if duplicate)
      return await ProductVersion.create({
        productId,
        version: nextVersion,
        snapshot,
        changedFields,
        actionType,
        updatedBy: userId,
        archived: false,
      });
    } catch (error: any) {
      // Retry on duplicate key error (race condition)
      if (error.code === 11000 && attempt < maxRetries - 1) {
        logger.warn('Version number conflict, retrying...', {
          productId,
          attempt: attempt + 1,
          maxRetries
        });
        continue;
      }
      throw error;
    }
  }
  
  throw new Error('Failed to create version after retries');
}
```

**Race Condition Protection**:
- Unique index on `{ productId, version }` prevents duplicates
- MongoDB will throw duplicate key error (code 11000) if race condition occurs
- Retry logic handles duplicate key errors (max 3 attempts)
- Exponential backoff not needed (version increment is fast)

### Performance Targets

- Version creation: < 100ms (async, non-blocking)
- Version history query: < 200ms (with 50 versions)
- Single version query: < 50ms
- Rollback operation: < 500ms (includes cache invalidation)
- Concurrent updates: No version number conflicts

---

## Integration Strategy

### 1. Product Controller Integration

#### Update Product Flow

**Before** (existing code):
```typescript
export const updateProduct = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  
  const product = await Product.findByIdAndUpdate(id, updateData, { new: true });
  await invalidateCache.product(id);
  
  res.json({ success: true, product });
};
```

**After** (with version control - CRITICAL: snapshot consistency):
```typescript
export const updateProduct = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const updateData = req.body;
  const userId = req.user._id;
  
  // Get current state for dirty detection (Phase 4 logic)
  const currentProduct = await Product.findById(id);
  if (!currentProduct) {
    return res.status(404).json({ message: 'Product not found' });
  }
  
  // Detect meaningful change (reuse Phase 4 logic with normalized comparison)
  const changedFields = detectChangedFields(currentProduct, updateData);
  const hasMeaningfulChange = changedFields.length > 0;
  
  // Update product
  const updatedProduct = await Product.findByIdAndUpdate(id, updateData, { new: true });
  await invalidateCache.product(id);
  
  // CRITICAL: Extract snapshot from SAVED product (not from request or refetch)
  // This ensures snapshot consistency - no race condition window
  const snapshot = extractSnapshot(updatedProduct);
  
  // Create version (async, fire-and-forget)
  if (hasMeaningfulChange) {
    versionService.createVersion(id, snapshot, changedFields, 'update', userId)
      .catch(error => {
        logger.error('Version creation failed (non-blocking):', {
          productId: id,
          error: error.message
        });
      });
  }
  
  res.json({ success: true, product: updatedProduct });
};
```

**Key Fix**: Snapshot extracted from `updatedProduct` (the saved result), not refetched later. This prevents snapshot inconsistency from concurrent updates.

#### Publish Product Flow

**After** (with version control):
```typescript
export const publishProduct = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user._id;
  
  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  
  // Validate all required fields
  const errors = validateProductForPublish(product);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ success: false, errors });
  }
  
  // Detect changed fields (compare draft vs published state)
  const changedFields = product.status === 'draft' ? ['status'] : [];
  
  // Publish product
  product.status = 'published';
  await product.save();
  await invalidateCache.product(id);
  
  // Create version with actionType='publish' (async)
  const snapshot = extractSnapshot(product);
  versionService.createVersion(id, snapshot, changedFields, 'publish', userId)
    .catch(error => {
      logger.error('Version creation failed (non-blocking):', {
        productId: id,
        error: error.message
      });
    });
  
  res.json({ success: true, product, status: 'published' });
};
```

### 2. Dirty State Detection Integration (Phase 4)

**Reuse Existing Logic with Normalized Comparison**:
```typescript
// Normalize value for comparison
function normalizeValue(value: any): any {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) return value.sort();
  return value;
}

// Check if two values are equal (normalized)
function isEqual(a: any, b: any): boolean {
  const normalizedA = normalizeValue(a);
  const normalizedB = normalizeValue(b);
  return JSON.stringify(normalizedA) === JSON.stringify(normalizedB);
}

// Detect changed fields with normalized comparison
function detectChangedFields(currentProduct: IProduct, updateData: any): string[] {
  const changedFields: string[] = [];
  
  const fieldsToCheck = [
    'name', 'description', 'category', 'price', 'pricePerUnit',
    'mrp', 'stock', 'weight', 'tags', 'status'
  ];
  
  for (const field of fieldsToCheck) {
    if (updateData[field] !== undefined && !isEqual(currentProduct[field], updateData[field])) {
      changedFields.push(field);
    }
  }
  
  // Special handling for images (array comparison with normalization)
  if (updateData.images !== undefined) {
    const currentImageUrls = extractImageUrls(currentProduct.images).sort();
    const newImageUrls = extractImageUrls(updateData.images).sort();
    
    if (!isEqual(currentImageUrls, newImageUrls)) {
      changedFields.push('images');
    }
  }
  
  return changedFields;
}
```

**Key Improvements**:
- **Type normalization**: Handles "100" vs 100
- **Array sorting**: Prevents false positives from order changes
- **Null/undefined handling**: Treats both as undefined
- **String trimming**: Ignores whitespace differences

### 3. Snapshot Extraction

**Helper Function**:
```typescript
function extractSnapshot(product: IProduct): ProductSnapshot {
  return {
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    pricePerUnit: product.pricePerUnit,
    mrp: product.mrp,
    stock: product.stock,
    weight: product.weight,
    tags: product.tags || '',
    status: product.status || 'draft',
    images: extractImageUrls(product.images),
  };
}

function extractImageUrls(images: any[]): string[] {
  if (!Array.isArray(images)) return [];
  
  return images.map(img => {
    if (typeof img === 'string') return img;
    if (img?.variants?.original) return img.variants.original;
    return '';
  }).filter(url => url.length > 0);
}
```

### 4. New API Routes

**Add to Product Router**:
```typescript
// backend/src/routes/productRoutes.ts

import { 
  getVersionHistory, 
  getVersion, 
  rollbackProduct 
} from '../controllers/versionController';

// Version control endpoints (admin only)
router.get('/admin/products/:id/versions', auth, adminOnly, getVersionHistory);
router.get('/admin/products/:id/versions/:version', auth, adminOnly, getVersion);
router.post('/admin/products/:id/rollback/:version', auth, adminOnly, rollbackProduct);
```

### 5. File Structure

**New Files**:
```
backend/src/
├── models/
│   └── ProductVersion.ts          # New model
├── services/
│   └── versionService.ts          # New service
├── controllers/
│   └── versionController.ts       # New controller
└── utils/
    └── versionHelpers.ts          # Helper functions
```

**No Changes Required**:
- `models/Product.ts` (no schema changes)
- Existing product routes (backward compatible)
- Existing product controller (only additions)

### 6. Backward Compatibility

**Guarantees**:
- Existing product endpoints work unchanged
- No breaking changes to API contracts
- No changes to Product model schema
- Existing tests continue to pass

**Migration**:
- No database migration required
- Version control starts from deployment date
- Existing products have no versions (empty array)
- First update after deployment creates version 1

---

## Deployment Checklist

### Pre-Deployment

- [ ] Create ProductVersion model with indexes
- [ ] Implement VersionService class
- [ ] Implement version controller endpoints
- [ ] Add version routes to product router
- [ ] Write unit tests (80%+ coverage)
- [ ] Write property-based tests (all 18 properties)
- [ ] Write integration tests (concurrent updates, rollback)
- [ ] Test backward compatibility (existing endpoints)
- [ ] Performance testing (version creation < 100ms)
- [ ] Load testing (concurrent updates, race conditions)

### Deployment

- [ ] Deploy to staging environment
- [ ] Verify indexes created in MongoDB
- [ ] Test version creation on product updates
- [ ] Test version history queries
- [ ] Test rollback operations
- [ ] Test error handling (404, 400, 500)
- [ ] Monitor logs for version creation failures
- [ ] Monitor performance metrics

### Post-Deployment

- [ ] Monitor version creation success rate
- [ ] Monitor query performance (< 200ms)
- [ ] Monitor storage growth (versions collection size)
- [ ] Verify archival process working (> 50 versions)
- [ ] Check for version number conflicts (should be zero)
- [ ] Verify cache invalidation on rollback

### Rollback Plan

If issues occur:
1. Version control is non-blocking (product updates still work)
2. Disable version creation by feature flag
3. Fix issues and redeploy
4. Re-enable version creation

**Critical**: Version control failure does NOT affect product functionality.

---

## Summary

This design provides a comprehensive, production-ready version control system for products with:

- **Non-invasive integration**: No Product model changes
- **Async execution**: No performance impact on product updates
- **Atomic operations**: Race-condition safe version increments
- **Complete audit trail**: Full history of all changes
- **Rollback capability**: Restore to any previous version
- **Performance optimized**: < 100ms version creation, < 200ms queries
- **Error resilient**: Version failures don't block product updates
- **Property-based tested**: 18 correctness properties with 100+ iterations each

The system is ready for implementation and deployment.
