# Quick Test Guide - Coordinate Resolution Bugfix

## One-Line Test Instructions for QA

### Test Migration (Dry Run)
```bash
cd backend && npm run migrate:addresses -- --dry-run
```
**Expected:** Scan completes, reports invalid addresses, NO database changes

### Test Migration (Live)
```bash
cd backend && npm run migrate:addresses
```
**Expected:** Addresses updated, coordsSource set, detailed report printed

### Test Invalid Address → Blocked Checkout
1. Open cart with address that has lat=0, lng=0
2. **Expected:** Red error banner + "CANNOT PLACE ORDER" button disabled

### Test New Address → Auto-Geocode
1. Add address: "Boya Bazar, Main Road, Tiruvuru, AP, 521235"
2. **Expected:** Backend logs show geocoding success, address saved with coords

### Test Pincode Fallback → Warning
1. Use address with `coordsSource='pincode'` (set in DB or via migration)
2. **Expected:** Yellow warning "Estimated Delivery Fee" shows

---

## Quick Verification Commands

### Check Address Coordinates in Database
```bash
mongosh cs-store
db.users.find({ "addresses.lat": 0 }, { "addresses": 1 }).pretty()
```

### Check coordsSource Field
```bash
db.users.find({ "addresses.0": { $exists: true } }, { "addresses.coordsSource": 1 }).pretty()
```

### Count Invalid Addresses
```bash
db.users.aggregate([
  { $unwind: "$addresses" },
  { $match: { $or: [
    { "addresses.lat": 0 },
    { "addresses.lng": 0 },
    { "addresses.lat": null },
    { "addresses.lng": null }
  ]}},
  { $count: "invalidAddresses" }
])
```

---

## Smoke Tests (2 minutes)

1. **Start servers**
   ```bash
   # Terminal 1
   cd backend && npm run dev
   
   # Terminal 2  
   cd frontend && npm run dev
   ```

2. **Test cart page** → http://localhost:3001/cart
   - If you have an old address with invalid coords → See red error banner
   - If all addresses are valid → No error banner

3. **Test add new address** → http://localhost:3001/addresses
   - Add: "Boya Bazar, Tiruvuru, AP, 521235"
   - Check backend console → Should see geocoding logs
   - Check cart page → Should calculate delivery fee

4. **Test migration**
   ```bash
   cd backend
   npm run migrate:addresses -- --dry-run
   ```
   - Should complete without errors
   - Should report statistics

---

## Expected Console Outputs

### Backend Logs (Good Address)
```
🔍 [resolveCoordinates] Resolving coordinates for address: Boya Bazar, Tiruvuru
✅ [resolveCoordinates] Using saved coordinates: lat=17.0956, lng=80.6089
🚚 [Backend] Delivery Fee Calculation: { coordsSource: 'saved', ... }
```

### Backend Logs (Invalid Address → Geocoding)
```
🔍 [resolveCoordinates] Resolving coordinates for address: Main Road, Tiruvuru
⚠️  [resolveCoordinates] Missing or invalid saved coordinates (lat=0, lng=0)
🌍 [resolveCoordinates] Attempting full address geocoding...
✅ [resolveCoordinates] Full geocoding successful: lat=17.0956, lng=80.6089
```

### Backend Logs (Pincode Fallback)
```
🔍 [resolveCoordinates] Resolving coordinates for address: Near market, Tiruvuru
⚠️  [resolveCoordinates] Full geocoding failed, trying pincode fallback...
✅ [resolveCoordinates] Pincode geocoding successful: lat=17.0956, lng=80.6089
⚠️  Using PINCODE CENTROID - delivery fee will be ESTIMATED
```

### Frontend Console (Invalid Address)
```
⚠️  Invalid user address coordinates, using fallback
```

---

## Pass/Fail Criteria

### ✅ PASS if:
- Migration completes without errors
- Invalid addresses show red error banner
- Checkout button is disabled for invalid addresses
- New addresses auto-geocode successfully
- Pincode fallback shows yellow warning
- coordsSource field is set correctly in DB

### ❌ FAIL if:
- Migration crashes or hangs
- No error banner for invalid addresses
- Checkout allowed with invalid coordinates
- Geocoding fails for valid addresses
- coordsSource not set in database
- Free delivery given for invalid addresses

---

## Rollback Plan

If issues found in production:

1. **Stop accepting new orders** (maintenance mode)
2. **Revert frontend** → Remove error banners
3. **Revert backend** → Remove resolveCoordinates logic
4. **Restore database** from backup (if migration ran)
5. **Investigate issue** in staging
6. **Re-deploy with fix**

---

## Contact

- **Issues during migration:** Check logs, contact backend team
- **Issues with geocoding:** Check Nominatim API status
- **Issues with checkout:** Contact frontend team
