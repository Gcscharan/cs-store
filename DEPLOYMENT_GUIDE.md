# 🚀 Voice AI System - Deployment Guide

## Quick Start (5 Minutes)

### 1. Backend Setup

```bash
cd backend

# Install dependencies (if not already done)
npm install

# Ensure MongoDB is running as replica set
# For local development:
mongod --replSet rs0

# Initialize replica set (first time only)
mongosh --eval "rs.initiate()"

# Start backend server
npm run dev
```

**Expected logs**:
```
✅ MongoDB replica set detected - transactions enabled
🎤 Starting voice AI ranking job...
[RankingJob] Starting ranking job (interval: 10 minutes)
🚀 Server running on port 5001
```

### 2. Frontend Setup

```bash
cd apps/customer-app

# Install dependencies (if not already done)
npm install

# Start app
npm start
```

### 3. Verify Integration

**Test backend endpoint**:
```bash
curl http://localhost:5001/api/voice/popular?limit=5
```

**Expected response**:
```json
{
  "success": true,
  "products": [],
  "period": "30 days"
}
```

---

## Environment Variables

### Backend (.env)

Required for voice AI system:

```bash
# MongoDB (MUST be replica set for transactions)
MONGODB_URI=mongodb://localhost:27017/your-db?replicaSet=rs0

# API Configuration
PORT=5001
NODE_ENV=development

# Existing variables (keep as is)
JWT_SECRET=...
CLOUDINARY_CLOUD_NAME=...
# ... etc
```

### Frontend (.env)

```bash
# API URL
EXPO_PUBLIC_API_URL=http://localhost:5001/api

# Existing variables (keep as is)
# ... etc
```

---

## MongoDB Setup

### Local Development

**Option 1: Docker (Recommended)**

```bash
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password \
  mongo:7 \
  --replSet rs0

# Initialize replica set
docker exec -it mongodb mongosh --eval "rs.initiate()"
```

**Option 2: Native MongoDB**

```bash
# Start with replica set
mongod --replSet rs0 --dbpath /path/to/data

# In another terminal, initialize
mongosh --eval "rs.initiate()"
```

### Production (MongoDB Atlas)

1. Create cluster at https://cloud.mongodb.com
2. Replica set is enabled by default ✅
3. Get connection string
4. Update `MONGODB_URI` in backend `.env`

---

## Verification Steps

### 1. Check Backend Health

```bash
curl http://localhost:5001/health
```

Expected:
```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Check Voice Endpoints

**Save correction**:
```bash
curl -X POST http://localhost:5001/api/voice/correction \
  -H "Content-Type: application/json" \
  -d '{
    "wrong": "test",
    "correct": "test product",
    "productId": "123",
    "userId": "test-user",
    "confidence": 0.85
  }'
```

Expected:
```json
{
  "success": true,
  "correction": { ... },
  "message": "Correction saved"
}
```

**Get correction**:
```bash
curl "http://localhost:5001/api/voice/correction?query=test&userId=test-user"
```

**Track click**:
```bash
curl -X POST http://localhost:5001/api/voice/click \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "123",
    "productName": "Test Product",
    "userId": "test-user",
    "query": "test",
    "isVoice": true
  }'
```

### 3. Check Ranking Job

Wait 10 minutes, then check logs:

```
[RankingJob] ✅ Ranking job completed: X products ranked
```

Or manually trigger (for testing):
```bash
# In backend directory
node -e "require('./dist/jobs/rankingJob').runRankingJob()"
```

---

## Monitoring

### Backend Logs to Watch

**Startup**:
```
✅ MongoDB replica set detected - transactions enabled
🎤 Starting voice AI ranking job...
[RankingJob] Starting ranking job (interval: 10 minutes)
```

**Corrections**:
```
[VoiceController] ✅ Correction saved: { wrong: '...', correct: '...', userId: '...' }
```

**Clicks**:
```
[VoiceController] Click tracked: { productId: '...', query: '...', isVoice: true }
```

**Ranking**:
```
[RankingJob] ✅ Ranking job completed: 150 products ranked
[RankingJob] Top products: [...]
```

### Frontend Logs to Watch

**Initialization**:
```
[Learning] Loaded from storage: { user: 5, global: 20 }
[Learning] Syncing with backend for user: abc
[Learning] ✅ Synced with backend
[Learning] Loaded 25 global corrections
```

**Corrections**:
```
[Learning] ⏳ Pending (1/2): { wrong: '...', correct: '...' }
[Learning] ✅ Saved correction: { wrong: '...', correct: '...', count: 2, confidence: 0.75 }
[Learning] ✅ Correction synced to backend
```

**Clicks**:
```
[Learning] Tracked click: { product: '...', totalClicks: 5, voiceClicks: 3 }
[Learning] ✅ Click synced to backend
```

---

## Troubleshooting

### Issue: "MongoDB must run as replica set"

**Cause**: MongoDB is running in standalone mode

**Fix**:
```bash
# Stop MongoDB
# Restart with replica set flag
mongod --replSet rs0

# Initialize replica set
mongosh --eval "rs.initiate()"
```

### Issue: "ECONNREFUSED" on backend calls

**Cause**: Backend not running or wrong URL

**Fix**:
1. Check backend is running: `curl http://localhost:5001/health`
2. Check `EXPO_PUBLIC_API_URL` in frontend `.env`
3. Restart backend: `npm run dev`

### Issue: "Rate limit exceeded"

**Cause**: Too many requests

**Fix**:
- Wait 1 minute
- Rate limits:
  - General: 60 req/min
  - Writes: 20 req/min
  - Reads: 120 req/min

### Issue: Ranking job not running

**Cause**: Server not started properly

**Fix**:
1. Check logs for: `🎤 Starting voice AI ranking job...`
2. If missing, restart server
3. Check MongoDB connection

### Issue: Backend sync failing

**Cause**: Network issue or backend down

**Fix**:
- System works offline - local data is preserved
- Check backend health: `curl http://localhost:5001/health`
- Check network connectivity
- Sync will retry on next app start

---

## Performance Tuning

### MongoDB Indexes

Indexes are created automatically on first run. Verify:

```javascript
// In mongosh
use your-db

// Check VoiceCorrection indexes
db.voicecorrections.getIndexes()

// Check ProductClick indexes
db.productclicks.getIndexes()

// Check ProductRanking indexes
db.productrankings.getIndexes()
```

Expected indexes:
- `wrong_1_userId_1` (unique)
- `wrong_1_source_1`
- `confidence_-1_count_-1`
- `productId_1_timestamp_-1`
- `userId_1_timestamp_-1`

### Rate Limiter Tuning

Edit `backend/src/middleware/rateLimiter.ts`:

```typescript
// Increase limits for production
export const generalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // Increase from 60
  // ...
});
```

### Ranking Job Frequency

Edit `backend/src/jobs/rankingJob.ts`:

```typescript
// Change interval (default: 10 minutes)
const RANKING_INTERVAL = 5 * 60 * 1000; // 5 minutes
```

---

## Production Deployment

### Railway / Heroku / AWS

1. **Set environment variables**:
   - `MONGODB_URI` (Atlas connection string)
   - `NODE_ENV=production`
   - All other required vars

2. **Deploy backend**:
   ```bash
   git push railway main
   # or
   git push heroku main
   ```

3. **Verify deployment**:
   ```bash
   curl https://your-app.railway.app/health
   curl https://your-app.railway.app/api/voice/popular
   ```

4. **Update frontend**:
   ```bash
   # Update .env
   EXPO_PUBLIC_API_URL=https://your-app.railway.app/api
   
   # Rebuild app
   npm run build
   ```

### MongoDB Atlas Setup

1. Create cluster: https://cloud.mongodb.com
2. Create database user
3. Whitelist IP (0.0.0.0/0 for development)
4. Get connection string
5. Update `MONGODB_URI` in backend

### Health Checks

Set up monitoring:
- Endpoint: `https://your-app.com/health`
- Expected: `{"status":"ok"}`
- Frequency: Every 5 minutes

---

## Security Checklist

- [x] Rate limiting enabled
- [x] Data validation active
- [x] MongoDB replica set (transactions)
- [x] Environment variables secured
- [x] CORS configured
- [x] Input sanitization
- [x] Error handling
- [x] Logging (no sensitive data)

---

## Next Steps

1. ✅ Deploy backend to production
2. ✅ Configure MongoDB Atlas
3. ✅ Update frontend API URL
4. ✅ Test end-to-end flow
5. ✅ Monitor logs for 24 hours
6. ✅ Verify ranking job runs
7. ✅ Check data validation works
8. ✅ Test rate limiting
9. ✅ Verify offline support
10. ✅ Celebrate! 🎉

---

## Support

If you encounter issues:

1. Check logs (backend and frontend)
2. Verify MongoDB is replica set
3. Check environment variables
4. Test endpoints with curl
5. Review error messages

**Common issues are documented in Troubleshooting section above.**

---

## Success Criteria

System is ready when:

- ✅ Backend health check returns 200
- ✅ Voice endpoints respond correctly
- ✅ Ranking job runs every 10 minutes
- ✅ Frontend syncs with backend
- ✅ Corrections are saved to MongoDB
- ✅ Clicks are tracked
- ✅ Rate limiting works
- ✅ Offline mode works
- ✅ No errors in logs

**You're ready for production! 🚀**
