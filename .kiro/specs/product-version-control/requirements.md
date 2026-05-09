# Requirements Document: Product Version Control System

## Introduction

The Product Version Control System provides enterprise-grade version tracking for products in the admin product creation system. Every product update creates a versioned snapshot, enabling full audit trails, rollback capabilities, and change history tracking. This system addresses the current limitation where the last change overwrites everything with no history preservation.

## Glossary

- **Product**: A catalog item with properties like name, description, price, images, and status (draft or published)
- **Version**: A numbered snapshot of a product's complete state at a specific point in time
- **Version_Control_System**: The system responsible for creating, storing, and managing product versions
- **Version_Storage**: MongoDB collection that stores versioned product snapshots
- **Rollback**: The operation of restoring a product to a previous version's state
- **Audit_Trail**: Complete chronological record of all product changes and who made them
- **Snapshot**: Complete copy of all product data at a specific version, taken from the final saved database state
- **Meaningful_Change**: A product update where at least one field value differs from the previous saved state
- **Changed_Fields**: Array of field names that were modified in a version update
- **Action_Type**: Classification of version creation trigger (update, publish, rollback)
- **Admin_User**: Authenticated user with administrative privileges to manage products
- **Auto_Save_System**: Existing system that automatically saves draft changes every 2 seconds
- **Draft_System**: Existing system that allows saving work-in-progress products
- **Product_Model**: Existing MongoDB schema for products with fields like name, description, price, images, status

## Requirements

### Requirement 1: Version Creation on Product Updates

**User Story:** As an admin user, I want meaningful product updates to create new versions automatically, so that I have a complete history of significant changes made to products.

#### Acceptance Criteria

1. WHEN an Admin_User updates a Product through the update endpoint AND a Meaningful_Change is detected, THE Version_Control_System SHALL create a new Version with an incremented version number
2. THE Version_Control_System SHALL NOT create a Version if no Meaningful_Change occurred (i.e., updated data matches current database state)
3. WHEN a Version is created, THE Version_Control_System SHALL capture the Snapshot from the final saved Product state in the database (not from the request body)
4. WHEN a Version is created, THE Version_Control_System SHALL store the Snapshot including all fields (name, description, price, images URLs only, category, stock, weight, tags, status)
5. WHEN a Version is created, THE Version_Control_System SHALL record the Changed_Fields array listing which fields were modified
6. WHEN a Version is created, THE Version_Control_System SHALL record the Action_Type (update, publish, or rollback)
7. WHEN a Version is created, THE Version_Control_System SHALL record the userId of the Admin_User who made the change
8. WHEN a Version is created, THE Version_Control_System SHALL record the timestamp of the change
9. WHEN a Product is first created, THE Version_Control_System SHALL create Version 1
10. WHEN a Product is updated, THE Version_Control_System SHALL increment the version number by 1 from the previous highest version
11. THE Version_Control_System SHALL create a Version ONLY AFTER the Product update operation succeeds and is committed to the database
12. IF the Product update operation fails, THEN THE Version_Control_System SHALL NOT create a Version

### Requirement 2: Version Storage and Data Integrity

**User Story:** As a system administrator, I want product versions stored efficiently with data integrity guarantees, so that version history is reliable and doesn't degrade system performance.

#### Acceptance Criteria

1. THE Version_Storage SHALL store each Version as a document in the product_versions collection
2. WHEN storing a Version, THE Version_Storage SHALL include fields: productId, version (number), snapshot (product data from database), changedFields (array of field names), actionType (update|publish|rollback), updatedBy (userId), createdAt (timestamp)
3. WHEN storing image data in the Snapshot, THE Version_Storage SHALL store only image URLs and minimal metadata (not full Cloudinary response objects)
4. THE Version_Storage SHALL create a compound index on productId and version for efficient queries
5. THE Version_Storage SHALL create an index on productId and createdAt for chronological queries
6. WHEN a Product has more than 50 Versions, THE Version_Storage SHALL retain only the most recent 50 versions
7. WHEN Version limit is exceeded, THE Version_Storage SHALL mark the oldest Version as archived (soft delete) rather than hard deleting it
8. THE Version_Storage SHALL log when a Version is archived with productId, version number, and timestamp

### Requirement 3: Version Retrieval and Listing

**User Story:** As an admin user, I want to view the complete version history of a product, so that I can see what changes were made and when.

#### Acceptance Criteria

1. WHEN an Admin_User requests version history for a Product, THE Version_Control_System SHALL return all non-archived Versions for that Product ordered by version number descending
2. WHEN returning version history, THE Version_Control_System SHALL include version number, timestamp, updatedBy userId, actionType, and changedFields array
3. THE changedFields array SHALL contain the names of fields that were modified in that version (e.g., ["price", "stock", "description"])
4. WHERE version history exceeds 20 versions, THE Version_Control_System SHALL paginate results with 20 versions per page
5. WHEN an Admin_User requests a specific Version, THE Version_Control_System SHALL return the complete snapshot for that Version
6. IF a Product has no versions, THEN THE Version_Control_System SHALL return an empty array
7. WHEN comparing two Versions, THE Version_Control_System SHALL identify which fields changed between versions by comparing the changedFields arrays

### Requirement 4: Rollback Operations

**User Story:** As an admin user, I want to restore a product to any previous version, so that I can undo mistakes or revert unwanted changes.

#### Acceptance Criteria

1. WHEN an Admin_User initiates a rollback to a specific Version, THE Version_Control_System SHALL restore ALL Product fields (including status) to match the snapshot from that Version
2. WHEN a rollback is performed, THE Version_Control_System SHALL create a new Version with actionType "rollback" (not delete history)
3. WHEN a rollback is performed, THE Version_Control_System SHALL record the rollback operation in the Audit_Trail with the source version number
4. WHEN a rollback is performed, THE Version_Control_System SHALL set changedFields to all fields that differ between current state and target version
5. IF the target Version does not exist, THEN THE Version_Control_System SHALL return an error and not modify the Product
6. WHEN a rollback completes successfully, THE Version_Control_System SHALL invalidate the product cache

### Requirement 5: API Endpoints for Version Control

**User Story:** As a frontend developer, I want RESTful API endpoints for version operations, so that I can integrate version control into the admin UI.

#### Acceptance Criteria

1. THE Version_Control_System SHALL provide a GET endpoint at /admin/products/:id/versions that returns paginated version history
2. THE Version_Control_System SHALL provide a GET endpoint at /admin/products/:id/versions/:version that returns a specific version snapshot
3. THE Version_Control_System SHALL provide a POST endpoint at /admin/products/:id/rollback/:version that restores a product to a specific version
4. WHEN an endpoint is called, THE Version_Control_System SHALL validate that the Admin_User has admin role authorization
5. IF the Product does not exist, THEN THE Version_Control_System SHALL return HTTP 404 status
6. IF the Version does not exist, THEN THE Version_Control_System SHALL return HTTP 404 status with descriptive error message
7. WHEN an endpoint returns version data, THE Version_Control_System SHALL normalize image data using the existing normalizeProductImages function

### Requirement 6: Integration with Existing Systems

**User Story:** As a system architect, I want version control to integrate seamlessly with existing product systems, so that current functionality is not disrupted.

#### Acceptance Criteria

1. THE Version_Control_System SHALL integrate with the existing Product_Model without modifying its schema
2. WHEN the Auto_Save_System updates a Product AND a Meaningful_Change is detected, THE Version_Control_System SHALL create a Version
3. WHEN the Draft_System publishes a Product, THE Version_Control_System SHALL create a Version with actionType "publish"
4. THE Version_Control_System SHALL maintain backward compatibility with existing product update endpoints
5. WHEN a Product update fails validation, THE Version_Control_System SHALL NOT create a Version
6. WHEN a Product update succeeds but version creation fails, THE Version_Control_System SHALL log the error but not rollback the Product update
7. THE Version_Control_System SHALL use the existing invalidateCache utility to clear product caches after rollback
8. THE Version_Control_System SHALL reuse the existing dirty state detection logic from Phase 4 to determine Meaningful_Change

### Requirement 7: Performance and Scalability

**User Story:** As a system administrator, I want version control to have minimal performance impact, so that product updates remain fast and responsive.

#### Acceptance Criteria

1. WHEN creating a Version, THE Version_Control_System SHALL complete the operation within 100 milliseconds
2. WHEN querying version history, THE Version_Control_System SHALL return results within 200 milliseconds for products with 50 versions
3. THE Version_Control_System SHALL use database indexes to optimize version queries by productId
4. THE Version_Control_System SHALL limit version history to 50 versions per Product to prevent unbounded growth
5. WHEN storing Versions, THE Version_Control_System SHALL use MongoDB's native BSON compression for snapshot data
6. THE Version_Control_System SHALL execute version creation asynchronously to avoid blocking product update responses
7. WHEN creating a new Version, THE Version_Control_System SHALL ensure atomic increment of version number per product to prevent version conflicts from concurrent updates

### Requirement 8: Security and Access Control

**User Story:** As a security administrator, I want version control operations restricted to authorized users, so that product history cannot be tampered with.

#### Acceptance Criteria

1. THE Version_Control_System SHALL require admin role authentication for all version endpoints
2. IF an unauthenticated request is made, THEN THE Version_Control_System SHALL return HTTP 401 status
3. IF a non-admin user attempts version operations, THEN THE Version_Control_System SHALL return HTTP 403 status
4. WHEN recording a Version, THE Version_Control_System SHALL store the authenticated userId from the request
5. THE Version_Control_System SHALL validate productId format using mongoose.isValidObjectId before queries
6. THE Version_Control_System SHALL log all rollback operations with userId, productId, source version, and timestamp

### Requirement 9: Audit Trail and Logging

**User Story:** As a compliance officer, I want complete audit logs of all version operations, so that I can track who made changes and when.

#### Acceptance Criteria

1. WHEN a Version is created, THE Version_Control_System SHALL log the operation with productId, version number, actionType, changedFields, userId, and timestamp
2. WHEN a rollback is performed, THE Version_Control_System SHALL log the operation with productId, target version, source version, userId, and timestamp
3. WHEN version history is queried, THE Version_Control_System SHALL include the updatedBy userId, actionType, and changedFields in the response
4. THE Version_Control_System SHALL use the existing logger utility for all audit logging
5. WHEN a Version is archived due to retention limits, THE Version_Control_System SHALL log the archival with productId, version number, and timestamp

### Requirement 10: Error Handling and Validation

**User Story:** As an admin user, I want clear error messages when version operations fail, so that I can understand and resolve issues.

#### Acceptance Criteria

1. IF a Product does not exist, THEN THE Version_Control_System SHALL return error message "Product not found"
2. IF a Version does not exist, THEN THE Version_Control_System SHALL return error message "Version not found"
3. IF a rollback target version is invalid, THEN THE Version_Control_System SHALL return error message "Invalid version number"
4. IF version creation fails, THEN THE Version_Control_System SHALL log the error and return HTTP 500 status with message "Failed to create version"
5. IF rollback operation fails, THEN THE Version_Control_System SHALL not modify the Product and return HTTP 500 status with message "Rollback failed"
6. WHEN validation fails, THE Version_Control_System SHALL return descriptive error messages in JSON format

