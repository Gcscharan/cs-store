# Railway Production Deployment Checklist

## Pre-Deploy (do once)

### 1. Railway Project Setup
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project (run from /backend)
railway link
```

### 2. Required Environment Variables
Set all of these in Railway → Project → Variables:

| Variable | Where to get it | Required |
|---|---|---|
| `NODE_ENV` | Set to `production` | ✅ |
| `PORT` | Railway sets automatically | auto |
| `MONGODB_URI` | MongoDB Atlas → Connect → Drivers | ✅ |
| `JWT_SECRET` | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"` | ✅ |
| `JWT_REFRESH_SECRET` | Same as above (different value) | ✅ |
| `JWT_EXPIRES_IN` | `7d` | ✅ |
| `JWT_REFRESH_EXPIRES_IN` | `30d` | ✅ |
| `RAZORPAY_KEY_ID` | dashboard.razorpay.com → Settings → API Keys | ✅ |
| `RAZORPAY_KEY_SECRET` | Same page | ✅ |
| `RAZORPAY_WEBHOOK_SECRET` | dashboard.razorpay.com → Webhooks | ✅ |
| `RESEND_API_KEY` | resend.com → API Keys | ✅ |
| `CLOUDINARY_CLOUD_NAME` | cloudinary.com → Dashboard | ✅ |
| `CLOUDINARY_API_KEY` | cloudinary.com → Dashboard | ✅ |
| `CLOUDINARY_API_SECRET` | cloudinary.com → Dashboard | ✅ |
| `REDIS_URL` | Railway → Add Redis plugin → Variables | ✅ |
| `GOOGLE_MAPS_API_KEY` | console.cloud.google.com | ✅ |
| `CORS_ORIGIN` | Your frontend domain(s), comma-separated | ✅ |
| `SENTRY_DSN` | sentry.io → Project → Settings → DSN | recommended |
| `EXPO_ACCESS_TOKEN` | expo.dev → Account → Access Tokens | for push notifs |
| `MOCK_OTP` | `false` | ✅ |
| `ENABLE_SOCKET` | `true` | ✅ |
| `BULL_BOARD_ADMIN_SECRET` | Generate random string | ✅ |
| `FAST2SMS_API_KEY` | fast2sms.com | optional |

### 3. MongoDB Atlas Setup
1. Create cluster at mongodb.com/atlas (M0 free tier is fine to start)
2. Add Railway's IP to Network Access (or use 0.0.0.0/0 for now)
3. Create database user
4. Copy connection string → set as `MONGODB_URI`

### 4. Redis Setup
1. In Railway dashboard → New → Database → Redis
2. Copy `REDIS_URL` from the Redis service variables

## Deploy

```bash
# From /backend directory
railway up

# Or push to GitHub and Railway auto-deploys
git push origin main
```

## Post-Deploy Verification

```bash
# Health check
curl https://your-backend.railway.app/api/health

# Expected response:
# {"status":"ok","timestamp":"..."}
```

### Smoke Tests
- [ ] `GET /api/health` returns 200
- [ ] `POST /api/auth/login` works
- [ ] `GET /api/products` returns products
- [ ] Socket.io connects (check Railway logs)
- [ ] Push notification test: use `/api/dev/notifications/test` endpoint

## CORS Configuration
Set `CORS_ORIGIN` to your actual domains:
```
CORS_ORIGIN=https://your-web-app.vercel.app,https://your-custom-domain.com
```

## Monitoring
- Railway dashboard shows logs, CPU, memory
- Sentry catches errors automatically once `SENTRY_DSN` is set
- Health check at `/api/health` is pinged every 30s by Railway

## Rollback
```bash
# In Railway dashboard → Deployments → click previous deployment → Redeploy
```
