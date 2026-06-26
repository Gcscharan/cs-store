# P0: Serviceable Pincodes Only Allow 5 Specific Codes — All Other Pincodes Blocked

**Severity:** P0 (Revenue/Order/Data Loss)  
**Status:** FIXED  
**Fixed in:** `backend/src/config/serviceablePincodes.ts`  
**Root cause:** Changed `isPincodeServiceable` from hardcoded array of 5 codes to range-based check (500001–599999 for AP & Telangana).

## Issue
`serviceablePincodes.ts` maintained a hardcoded `SERVICEABLE_PINCODES` array with only 5 entries:
```
["521235", "507115", "507111", "507113", "507114"]
```
(Plus `"500001"` only in `NODE_ENV=test` mode.)

However, the pincode validation API (`pincodeController.ts`) uses ranges `{ start: 500001, end: 599999 }` covering all 16,000+ pincodes in Andhra Pradesh and Telangana.

## Blast Radius
**Customers whose pincode was outside these 5 codes could browse and add to cart, but got `"Delivery not available to this pincode"` at checkout.** This means the entire customer base except a handful of users in 5 specific pincodes would be blocked from ordering.

Affected endpoints:
- `POST /api/orders` (createOrder → orderBuilder → `isPincodeServiceable()` line 282)
- `POST /api/orders/cod` (placeOrderCOD → same path)

**~99.9% of AP/Telangana pincodes blocked** → P0 (revenue loss)

## Fix Applied
Changed `isPincodeServiceable()` from array lookup to range check matching the same ranges used by the pincode validation API:
```
Ranges: [{ start: 500001, end: 599999 }]  // AP & Telangana
```

## Trace
- **Order validation:** `orderBuilder.ts:282` → `isPincodeServiceable(addr.pincode)`
- **Config (before fix):** `config/serviceablePincodes.ts` — 5 hardcoded codes
- **Pincode API (correct behavior):** `controllers/pincodeController.ts:19-21` — range 500001-599999

## Verification
✅ COD order created with pincode `500001` (Hyderabad) returns 201.
✅ Pincode `500001` passes `isPincodeServiceable` check.
✅ Checked with `GET /api/pincode/check/500001` → `{ deliverable: true }`.
