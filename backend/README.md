# CPS Store Backend

E-commerce backend for CPS Store with MongoDB, Redis, and AWS S3 integration.

## Environment Setup

### Required Environment Variables

Copy `.env.example` to `.env` and configure the following:

#### Core Configuration
```bash
# MongoDB
MONGODB_URI=mongodb://localhost:27017/cps-store

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here

# Server
PORT=5001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

#### AWS S3 (Image Hosting)
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key_id_here
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key_here
S3_BUCKET_PRODUCT_IMAGES=your_s3_bucket_name_here
CLOUDFRONT_DOMAIN=your_cloudfront_domain.cloudfront.net
S3_UPLOAD_PREFIX=products
S3_SIGNED_URL_EXPIRES=3600
```

#### Payment & Third-party Services
```bash
# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_KEY_SECRET=your_razorpay_key_secret_here

# SMS/OTP
FAST2SMS_API_KEY=your_fast2sms_api_key_here
```

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## AWS S3 Integration

### Setup Instructions

1. **Create AWS Resources** (see AWS infra plan)
2. **Configure IAM User** with minimal S3 permissions
3. **Update Environment Variables** with AWS credentials
4. **Test S3 Connection**

### Testing S3 Connection

```bash
# Test S3 service initialization
node -e "
const { validateS3Config, getS3Config } = require('./dist/services/s3Service');
console.log('S3 Config Valid:', validateS3Config());
console.log('S3 Config:', getS3Config());
"
```

### Presigned URL Flow

The backend supports presigned URL uploads for direct client-to-S3 uploads:

```typescript
import { getPresignedUploadUrl, generateProductKey } from '../services/s3Service';

// Generate presigned upload URL
const key = generateProductKey('product123', 'temp', 'image.jpg');
const uploadUrl = await getPresignedUploadUrl({
  key,
  contentType: 'image/jpeg',
  expires: 3600
});

// Client can upload directly to this URL
// After upload, move image from temp to permanent location
```

### Image Processing Flow

1. **Upload**: Client gets presigned URL for temp upload
2. **Process**: Backend queues image processing job
3. **Resize**: Worker creates full and thumbnail versions
4. **Store**: Final images stored in S3 with proper paths
5. **Update**: MongoDB updated with CloudFront URLs

### S3 Path Structure

```
products/{productId}/full/{uuid}.jpg     # Full-size images
products/{productId}/thumb/{uuid}.webp   # Thumbnails
products/temp/{uuid}.jpg                 # Temporary uploads
products/{productId}/original/{uuid}.jpg # Original backups
```

## API Endpoints

### Products
- `GET /api/products` - List products with thumbnails
- `GET /api/products/:id` - Product details with full images
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)

### Image Upload
- `POST /api/images/upload-url` - Get presigned upload URL
- `POST /api/images/process` - Queue image processing

## Redis Configuration

Redis is used for:
- Caching product data
- Session storage
- Queue management (Bull queues)

### Redis Commands
```bash
# Check Redis connection
redis-cli ping

# Monitor Redis activity
redis-cli monitor

# Check queue status
redis-cli keys "bull:*"
```

## Queue System

Uses Bull queues for background processing:

- **image-processing**: Image resizing and optimization
- **email**: Email notifications
- **sms**: SMS notifications

### Worker Management
```bash
# Start image worker
npm run worker:image

# Start all workers
npm run worker:all
```

## Development

### Project Structure
```
src/
├── config/          # Configuration files (Redis, etc.)
├── controllers/     # Route controllers
├── middleware/      # Express middleware
├── models/          # Mongoose models
├── routes/          # API routes
├── services/        # Business logic (S3, Queue, etc.)
├── utils/           # Utility functions
└── worker/          # Background workers
```

### Database Models

#### Product Schema
```typescript
interface IProduct {
  name: string;
  description: string;
  category: string;
  price: number;
  images: { full: string; thumb: string }[];
  stock: number;
  tags: string[];
}
```

### Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Test coverage
npm run test:coverage
```

## Production Deployment

### Environment Variables for Production
- Set `NODE_ENV=production`
- Configure production MongoDB URI
- Use AWS IAM roles instead of access keys
- Enable Redis clustering for high availability

### Health Checks
```bash
# API health check
curl http://localhost:5001/api/health

# Redis health check
redis-cli ping

# Queue status check
redis-cli llen bull:image-processing:wait
```

## Troubleshooting

### Common Issues

1. **S3 Upload Fails**: Check AWS credentials and bucket permissions
2. **Redis Connection**: Verify Redis is running and accessible
3. **Queue Not Processing**: Check worker processes and Bull queue status
4. **Image Processing**: Ensure Sharp library is installed and worker is running

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm run dev
```

## Security

- JWT tokens for authentication
- Rate limiting on API endpoints
- CORS configuration
- S3 bucket policies restrict access
- Input validation and sanitization
- Helmet.js for security headers

## Contributing

1. Follow TypeScript best practices
2. Add proper error handling and logging
3. Write tests for new features
4. Update documentation for API changes

## License

MIT License
