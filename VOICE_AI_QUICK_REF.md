# 🎤 Voice AI System - Quick Reference

## 🚀 Start System

```bash
# Backend
cd backend && npm run dev

# Frontend
cd apps/customer-app && npm start
```

## 📡 API Endpoints

```
POST   /api/voice/correction  - Save learned correction
GET    /api/voice/correction  - Get correction for query
POST   /api/voice/click       - Track product click
GET    /api/voice/popular     - Get popular products
POST   /api/voice/sync        - Sync user data
```

## 🧪 Quick Test

```bash
# Health check
curl http://localhost:5001/health

# Get popular products
curl http://localhost:5001/api/voice/popular?limit=5

# Save correction
curl -X POST http://localhost:5001/api/voice/correction \
  -H "Content-Type: application/json" \
  -d '{"wrong":"test","correct":"test product","productId":"123","userId":"abc","confidence":0.85}'
```

## 📊 Rate Limits

- **Writes**: 20 req/min (POST /correction, /click, /sync)
- **Reads**: 120 req/min (GET /correction, /popular)

## 🔍 Key Logs

**Backend startup**:
```
🎤 Starting voice AI ranking job...
[RankingJob] ✅ Scheduled (every 10 minutes)
```

**Correction saved**:
```
[VoiceController] ✅ Correction saved
[Learning] ✅ Correction synced to backend
```

**Ranking job**:
```
[RankingJob] ✅ Ranking updated: { products: 150, duration: '45ms' }
```

## 🛡️ Data Validation

1. Confidence >= 0.7
2. wrong !== correct
3. Length >= 3 chars
4. Not in rejection list
5. Seen 2+ times

## 🎯 Success Criteria

- ✅ Backend health returns 200
- ✅ Voice endpoints respond
- ✅ Ranking job runs every 10 min
- ✅ Frontend syncs to backend
- ✅ Corrections saved to MongoDB
- ✅ Clicks tracked
- ✅ Rate limiting works
- ✅ Offline mode works

## 📚 Full Docs

- `FINAL_INTEGRATION_SUMMARY.md` - Complete overview
- `DEPLOYMENT_GUIDE.md` - Deployment steps
- `PRODUCTION_INTEGRATION_COMPLETE.md` - Integration details
- `PRODUCTION_SYSTEM_COMPLETE.md` - Architecture

## 🚨 Troubleshooting

**MongoDB replica set error**:
```bash
mongod --replSet rs0
mongosh --eval "rs.initiate()"
```

**Backend not responding**:
```bash
curl http://localhost:5001/health
# Check EXPO_PUBLIC_API_URL in frontend .env
```

**Rate limit exceeded**:
- Wait 1 minute
- Check rate limits above

## 🎉 Status

**System**: ✅ READY FOR PRODUCTION

**Next**: Deploy and monitor!
