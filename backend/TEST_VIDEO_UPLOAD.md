# Test Video Upload API

## 🎯 GOAL
Upload a video and get back: `{ url, thumbnail, publicId, hash, duration, deduplicated }`

## 📋 Prerequisites
1. Backend server running
2. Admin user token
3. Test video file (mp4, <20MB)

## 🚀 Test with Postman

### Step 1: Get Admin Token
```bash
POST http://localhost:5000/api/auth/login
Body (JSON):
{
  "email": "admin@example.com",
  "password": "your-admin-password"
}
```

Copy the `token` from response.

### Step 2: Upload Video
```bash
POST http://localhost:5000/api/admin/upload/video
Headers:
  Authorization: Bearer YOUR_TOKEN_HERE
Body (form-data):
  video: [Select your .mp4 file]
```

## ✅ Expected Response (Success)
```json
{
  "url": "https://res.cloudinary.com/demo/video/upload/v1234567890/products/videos/abc123.mp4",
  "thumbnail": "https://res.cloudinary.com/demo/video/upload/c_fill,h_360,w_640/v1234567890/products/videos/abc123.jpg",
  "publicId": "products/videos/abc123",
  "hash": "a3f5b2c1d4e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7",
  "duration": 15.5,
  "deduplicated": false
}
```

## 🧪 Test Deduplication
Upload the SAME video file again. You should get:
```json
{
  ...same metadata...
  "deduplicated": true
}
```

## ❌ Expected Errors

### No file provided
```json
{
  "message": "No video file provided"
}
```

### File too large (>20MB)
```json
{
  "message": "Video file size exceeds 20MB limit"
}
```

### Wrong format (not mp4)
```json
{
  "message": "Only mp4 format is supported"
}
```

### Not admin
```json
{
  "message": "Admin access required"
}
```

## 🔍 Verify in Database

### Check VideoRegistry
```javascript
db.videoregistries.find().pretty()
```

Should show:
- hash
- publicId
- url
- thumbnail
- duration
- referenceCount: 1 (or 2 if you uploaded twice)

### Check TemporaryUpload
```javascript
db.temporaryuploads.find().pretty()
```

Should show:
- publicId
- status: "temporary"
- uploadedBy: admin user ID

## 🎉 SUCCESS CRITERIA
✅ Video uploads to Cloudinary
✅ Returns url, thumbnail, publicId, hash, duration
✅ Saves to VideoRegistry
✅ Creates TemporaryUpload entry
✅ Deduplication works (same video returns existing metadata)

## 🐛 Troubleshooting

### "Cloudinary upload failed"
- Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env
- Verify Cloudinary account is active

### "Video upload processing failed"
- Check backend logs for detailed error
- Verify MongoDB connection
- Check file buffer is valid

### "Admin access required"
- Verify token is valid
- Check user role is "admin"

## 📝 Next Steps After Success
Once this works:
1. ✅ Video uploads ✅
2. ✅ Cloudinary returns URL ✅
3. ✅ DB stores metadata ✅

Then move to:
- Attach video to product
- Save product with video
- Display video in UI
