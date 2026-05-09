# Image Upload API

## Overview

Dedicated endpoint for uploading images to Cloudinary. This endpoint is decoupled from product creation to provide:
- Better error handling
- Upload progress tracking
- Retry capability
- Cleaner architecture

## Endpoint

```
POST /api/uploads/images
```

## Authentication

Requires valid JWT token in Authorization header:
```
Authorization: Bearer <token>
```

## Request

**Content-Type**: `multipart/form-data`

**Body**:
- `images`: Array of image files (max 10)
- Supported formats: JPEG, PNG, WEBP, AVIF
- Files must have non-zero size

## Response

### Success (200)

```json
{
  "success": true,
  "images": [
    {
      "publicId": "products/abc123",
      "url": "https://res.cloudinary.com/.../original.jpg",
      "variants": {
        "original": "https://...",
        "large": "https://...",
        "medium": "https://...",
        "small": "https://...",
        "thumbnail": "https://..."
      },
      "formats": {
        "webp": "https://...",
        "avif": "https://..."
      },
      "metadata": {
        "width": 1920,
        "height": 1080,
        "format": "jpg",
        "size": 245678
      }
    }
  ]
}
```

### Errors

**400 Bad Request**:
- No images provided
- Invalid image format
- Empty files

```json
{
  "success": false,
  "message": "No valid images (must be JPEG, PNG, WEBP, or AVIF)"
}
```

**401 Unauthorized**:
```json
{
  "message": "Authentication required"
}
```

**500 Internal Server Error**:
```json
{
  "success": false,
  "message": "Image upload failed",
  "error": "Cloudinary error details"
}
```

## Usage Example

### Frontend (React Native)

```typescript
const uploadImages = async (images: PickedImage[]) => {
  const formData = new FormData();
  
  images.forEach((img) => {
    formData.append('images', {
      uri: img.uri,
      name: img.name,
      type: img.type,
    } as any);
  });

  const response = await fetch('http://api.example.com/api/uploads/images', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  const result = await response.json();
  return result.images.map(img => img.url);
};
```

### cURL

```bash
curl -X POST http://localhost:9000/api/uploads/images \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "images=@image1.jpg" \
  -F "images=@image2.jpg"
```

## Architecture

This endpoint:
- ✅ Only handles image uploads
- ✅ No product logic
- ✅ No database writes
- ✅ Returns URLs for later use
- ✅ Decoupled from product creation

## Next Steps

After uploading images:
1. Store returned URLs in state
2. Include URLs in product creation request
3. Product API accepts JSON with image URLs (no FormData)
