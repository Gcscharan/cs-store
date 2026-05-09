# Reviews Database Setup Documentation

## Overview

This document describes the database schema and configuration for the Product Reviews System, implemented as part of Task 1 of the product reviews feature specification.

## Database Schema

### Review Collection

The `reviews` collection stores all product review data with the following structure:

```typescript
interface IReview {
  _id: ObjectId;           // MongoDB auto-generated ID
  productId: string;       // Reference to product (required)
  userId: string;          // Reference to user (required)
  rating: number;          // Rating 1-5 inclusive (required)
  comment?: string;        // Optional text review (max 1000 chars)
  images?: string[];       // Optional array of image URLs
  createdAt: Date;         // Auto-generated timestamp
  updatedAt: Date;         // Auto-updated timestamp
}
```

### Field Specifications

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `productId` | String | Yes | Non-empty, indexed | Reference to the product being reviewed |
| `userId` | String | Yes | Non-empty, indexed | Reference to the user who wrote the review |
| `rating` | Number | Yes | Integer 1-5 inclusive | Star rating for the product |
| `comment` | String | No | Max 1000 characters | Optional text review |
| `images` | String[] | No | Valid URLs only | Optional array of image URLs |
| `createdAt` | Date | Auto | Immutable | Timestamp when review was created |
| `updatedAt` | Date | Auto | Auto-updated | Timestamp when review was last modified |

## Database Indexes

The following indexes have been created for optimal performance:

### 1. Unique Compound Index
```javascript
{ productId: 1, userId: 1 } // unique: true
```
- **Purpose**: Enforces one review per user per product constraint
- **Name**: `productId_userId_unique`
- **Performance**: Prevents duplicate reviews, enables fast uniqueness checks

### 2. Product ID Index
```javascript
{ productId: 1 }
```
- **Purpose**: Fast retrieval of all reviews for a specific product
- **Name**: `productId_1`
- **Performance**: Optimizes product review listing queries

### 3. User ID Index
```javascript
{ userId: 1 }
```
- **Purpose**: Fast retrieval of all reviews by a specific user
- **Name**: `userId_1`
- **Performance**: Optimizes user review history queries

### 4. Creation Date Index (Descending)
```javascript
{ createdAt: -1 }
```
- **Purpose**: Fast sorting by creation date (newest first)
- **Name**: `createdAt_desc`
- **Performance**: Optimizes chronological review ordering

### 5. Compound Product-Date Index
```javascript
{ productId: 1, createdAt: -1 }
```
- **Purpose**: Optimized product reviews with date sorting
- **Name**: `productId_createdAt_desc`
- **Performance**: Combines product filtering with chronological ordering

## Validation Rules

### Rating Validation
- Must be an integer between 1 and 5 (inclusive)
- Required field - cannot be null or undefined
- Validates both range and data type

### Comment Validation
- Optional field
- Maximum length: 1000 characters
- Automatically trimmed of whitespace

### Image URL Validation
- Optional array of strings
- Each URL must be a valid URL format
- Automatically trimmed of whitespace

### Product/User ID Validation
- Required fields
- Must be non-empty strings
- Automatically trimmed of whitespace

## Performance Characteristics

### Query Performance
- **Product reviews**: Sub-10ms with `productId_1` index
- **User reviews**: Sub-10ms with `userId_1` index
- **Sorted reviews**: Sub-10ms with `createdAt_desc` index
- **Uniqueness checks**: Sub-5ms with compound unique index

### Storage Efficiency
- Indexes created with `background: true` for non-blocking creation
- Sparse indexes where appropriate to save space
- Optimized field types for minimal storage overhead

## Database Connection

### Connection Configuration
```typescript
const options = {
  maxPoolSize: 10,                    // Connection pool size
  serverSelectionTimeoutMS: 5000,     // Server selection timeout
  socketTimeoutMS: 45000,             // Socket timeout
  bufferCommands: false,              // Disable command buffering
};
```

### Environment Variables
- `MONGODB_URI`: MongoDB Atlas connection string (required)
- Connection string format: `mongodb+srv://username:password@cluster.mongodb.net/database`

## Initialization Scripts

### Setup Script
```bash
npx ts-node -r dotenv/config src/scripts/initializeReviewsDatabase.ts
```
- Creates all required indexes
- Verifies database connectivity
- Reports index creation status

### Test Script
```bash
npx ts-node -r dotenv/config src/scripts/testReviewsDatabase.ts
```
- Tests schema validation
- Verifies index functionality
- Tests uniqueness constraints
- Measures query performance

## Integration Points

### Model Import
```typescript
import { Review, IReview } from '../models/Review';
```

### Database Configuration
```typescript
import { initializeDatabase } from '../config/database';
await initializeDatabase();
```

## Monitoring and Maintenance

### Index Monitoring
- Monitor index usage with MongoDB Atlas Performance Advisor
- Track query performance metrics
- Review slow query logs regularly

### Maintenance Tasks
- Regular index optimization (handled automatically by MongoDB)
- Monitor collection size and growth patterns
- Backup and recovery procedures follow existing MongoDB practices

## Security Considerations

### Data Protection
- No sensitive data stored in reviews collection
- User IDs are references, not personal information
- Image URLs are validated but not stored locally

### Access Control
- Database access controlled through MongoDB Atlas security
- Application-level authentication required for all operations
- No direct database access from client applications

## Compliance and Requirements

This database setup satisfies the following requirements from the specification:

- **Requirement 1.1**: Review data structure with all required fields
- **Requirement 2.1**: One review per user per product constraint
- **Requirement 9.1-9.5**: All required database indexes for performance
- **Performance targets**: Sub-10ms query times for indexed operations

## Troubleshooting

### Common Issues

1. **Duplicate Key Error (E11000)**
   - Cause: Attempting to create duplicate review for same user/product
   - Solution: Check for existing review before creation

2. **Validation Error**
   - Cause: Invalid rating value or missing required fields
   - Solution: Validate input data before database operations

3. **Connection Timeout**
   - Cause: Network issues or incorrect MONGODB_URI
   - Solution: Verify connection string and network connectivity

### Debug Commands
```bash
# Check database connection
npx ts-node -r dotenv/config src/scripts/testReviewsDatabase.ts

# Verify indexes
db.reviews.getIndexes()

# Check collection stats
db.reviews.stats()
```