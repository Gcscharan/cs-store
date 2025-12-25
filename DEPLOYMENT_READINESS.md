# DEPLOYMENT READINESS

## Environment Requirements
- Node.js (LTS)
- MongoDB connection URI (MONGODB_URI)
- JWT secret (JWT_SECRET)
- Cloudinary credentials (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)
- Razorpay (unchanged) if payments enabled elsewhere

## External Services
- Cloudinary (images)
- Razorpay (payments; unchanged in Phase 2)

## Build/Run
- Backend: `npm run build` then `npm start`
- Env: `.env` per above

## Known Constraints
- Main product search endpoint is disabled by design; suggestions endpoint active
- No schema/index changes introduced in Phase 2
- Locked domains require governance approval for any changes
