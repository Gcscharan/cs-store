# Video Stability Layer - Installation Guide

## Quick Start

Run this command to install the required dependency:

```bash
cd backend
npm install node-cron
npm install --save-dev @types/node-cron
```

## What This Installs

- `node-cron`: Cron job scheduler for daily video cleanup
- `@types/node-cron`: TypeScript type definitions

## Verify Installation

After installing, start the server and check logs for:

```
✅ Video cleanup job scheduled
```

## Test the Implementation

### 1. Test Rate Limiting
```bash
# Upload 11 videos rapidly (should fail on 11th)
for i in {1..11}; do
  curl -X POST http://localhost:5002/api/admin/upload/video \
    -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
    -F "video=@test-video.mp4"
done
```

Expected: 11th upload returns 429 status

### 2. Test Video Replacement
```bash
# 1. Create product with video A
curl -X POST http://localhost:5002/api/admin/products \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Product",
    "video": {
      "publicId": "video_a",
      "url": "https://res.cloudinary.com/...",
      "thumbnail": "https://res.cloudinary.com/..."
    }
  }'

# 2. Update product with video B
curl -X PUT http://localhost:5002/api/admin/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "video": {
      "publicId": "video_b",
      "url": "https://res.cloudinary.com/...",
      "thumbnail": "https://res.cloudinary.com/..."
    }
  }'

# 3. Check logs for:
# "🔄 Video replaced - old video marked for deletion"
```

### 3. Test Product Deletion
```bash
# Delete product with video
curl -X DELETE http://localhost:5002/api/admin/products/PRODUCT_ID \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Check logs for:
# "🗑️ Product video marked for deletion"
```

### 4. Test Cron Job (Manual Trigger)
```bash
# Wait for midnight OR manually trigger in code:
# Add this to your test file:
import { videoService } from './services/videoService';

// Test orphan cleanup
const orphansDeleted = await videoService.cleanupOrphans();
console.log('Orphans deleted:', orphansDeleted);

// Test pending deletions
const pendingDeleted = await videoService.executePendingDeletions();
console.log('Pending deleted:', pendingDeleted);
```

## Monitoring

Check these logs daily:

```bash
# Cleanup job execution
grep "VideoCleanupJob" backend/logs/app.log

# Video replacement events
grep "Video replaced" backend/logs/app.log

# Rate limit hits
grep "Rate limit exceeded" backend/logs/app.log

# Critical failures (requires manual intervention)
grep "CRITICAL: Video deletion failed 3 times" backend/logs/app.log
```

## Troubleshooting

### Cron job not starting
- Check logs for: `✅ Video cleanup job scheduled`
- Verify node-cron is installed: `npm list node-cron`
- Check NODE_ENV is not "test" (cron disabled in test mode)

### Rate limiting not working
- Verify admin token is valid
- Check userId is being extracted correctly
- Rate limit resets after 1 hour

### Videos not being deleted
- Check PendingDeletion collection in MongoDB
- Verify 24h grace period has passed
- Check Cloudinary credentials are valid
- Look for retry count > 2 (indicates persistent failure)

### Orphan cleanup not working
- Check TemporaryUpload collection
- Verify uploads are >2 hours old
- Check Cloudinary credentials

## Production Checklist

Before deploying to production:

- [ ] Install node-cron dependency
- [ ] Verify cron job starts on server boot
- [ ] Test rate limiting with real admin account
- [ ] Test video replacement flow
- [ ] Test product deletion flow
- [ ] Set up monitoring alerts for critical failures
- [ ] Document cleanup schedule for ops team
- [ ] Test rollback scenario (restore deleted product within 24h)

## Next Steps

After installation:
1. Deploy to staging
2. Run all tests
3. Monitor for 24 hours
4. Deploy to production
5. Monitor cleanup job at midnight
6. Review metrics after 1 week

## Support

If you encounter issues:
1. Check logs for error messages
2. Verify all dependencies are installed
3. Test each component individually
4. Check MongoDB collections (VideoRegistry, TemporaryUpload, PendingDeletion)
5. Verify Cloudinary credentials

For critical issues, check:
- Server logs: `backend/logs/app.log`
- MongoDB collections: VideoRegistry, TemporaryUpload, PendingDeletion
- Cloudinary dashboard: Check video count and storage usage
