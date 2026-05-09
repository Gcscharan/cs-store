# VyaparSetu — 30-Day Launch Checklist

## Week 1 — Critical Blockers ✅

- [x] `google-services.json` present and wired in `app.json`
- [x] `expo-notifications` + `@react-native-firebase/messaging` plugins added to `app.json`
- [x] Sentry integrated on mobile (`EXPO_PUBLIC_SENTRY_DSN` env var) and backend (`SENTRY_DSN`)
- [x] Push notifications: Expo push service wired end-to-end (backend → mobile)
- [x] FCM: all 6 order states send push notifications (confirmed, packed, in-transit, delivered, failed, cancelled)
- [x] Payment page: Flipkart-style sticky bottom bar added to checkout
- [x] E2E smoke test script: `npm run test:smoke`
- [x] Railway deployment: `railway.toml` + `Dockerfile` + `RAILWAY_DEPLOYMENT_CHECKLIST.md`
- [ ] **YOU MUST DO**: Set `EXPO_PUBLIC_SENTRY_DSN` in `.env`
- [ ] **YOU MUST DO**: Set `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env` (removed hardcoded key)
- [ ] **YOU MUST DO**: Deploy backend to Railway (follow `RAILWAY_DEPLOYMENT_CHECKLIST.md`)
- [ ] **YOU MUST DO**: Run `npm run test:smoke` against production backend

## Week 2 — Play Store Launch ✅

- [x] App icon: `assets/icon.png` + `assets/adaptive-icon.png` configured
- [x] Splash screen: `assets/splash-icon.png` configured
- [x] EAS build: `eas.json` configured with production app-bundle + auto-increment
- [x] Play Store listing copy: `PLAY_STORE_LISTING.md`
- [ ] **YOU MUST DO**: Run `eas build --platform android --profile production`
- [ ] **YOU MUST DO**: Create Play Store account at play.google.com/console
- [ ] **YOU MUST DO**: Upload AAB to internal testing track
- [ ] **YOU MUST DO**: Take 7 screenshots (see `PLAY_STORE_LISTING.md`)
- [ ] **YOU MUST DO**: Submit for review

## Week 3 — Web Launch + Admin Polish ✅

- [x] Vercel config: `vercel.json` at root with SPA routing
- [x] Admin bulk product upload: CSV upload modal in `AdminProductsPage.tsx`
- [x] Backend bulk upload endpoint: `POST /api/admin/products/bulk`
- [x] Admin CSV export button: `AdminOrdersPage.tsx` → "Export CSV" button
- [x] Delivery KYC: `DeliveryKYCScreen.tsx` fully implemented
- [x] i18n: Hindi + Telugu translations complete in `packages/i18n/src/locales/`
- [ ] **YOU MUST DO**: Deploy frontend to Vercel (`vercel --prod` from `/frontend`)
- [ ] **YOU MUST DO**: Set `VITE_API_URL` in Vercel environment variables
- [ ] **YOU MUST DO**: Set up custom domain in Vercel dashboard

## Week 4 — Polish + Launch ✅

- [x] PWA: `frontend/public/sw.js` service worker created
- [x] PWA: Service worker registered in `main.tsx` (production only)
- [x] PWA: `manifest.json` updated with proper icons and theme color
- [x] Security: Hardcoded Google Maps API key removed from `app.json`
- [x] Load tests: `backend/load-tests/checkout.js` added
- [x] Load tests: `smoke.js` and `stress.js` already exist
- [ ] **YOU MUST DO**: Run load tests: `k6 run backend/load-tests/smoke.js`
- [ ] **YOU MUST DO**: Add PWA icons at `frontend/public/icons/icon-192.png` and `icon-512.png`
- [ ] **YOU MUST DO**: Soft launch to 50 test users
- [ ] **YOU MUST DO**: Monitor Sentry for errors after launch

## Skipped (not worth the time for launch)
- ❌ Apple Pay (very low usage in India)
- ❌ GraphQL API (REST is fine)
- ❌ Facebook OAuth (Google is enough)
- ❌ Dark mode (not critical for launch)
- ❌ Wallet balance (add post-launch)

---

## Quick Commands

```bash
# Run smoke tests against local backend
npm run test:smoke

# Run smoke tests against production
npm run test:smoke:prod

# Build Android production AAB
cd apps/customer-app && eas build --platform android --profile production

# Deploy frontend to Vercel
cd frontend && vercel --prod

# Run load tests (requires k6 installed)
k6 run backend/load-tests/smoke.js
k6 run backend/load-tests/stress.js
k6 run backend/load-tests/checkout.js

# Deploy backend to Railway
cd backend && railway up
```
