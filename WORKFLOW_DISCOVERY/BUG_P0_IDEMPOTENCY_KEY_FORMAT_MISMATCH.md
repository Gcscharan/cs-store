# P0: Idempotency Key Format Mismatch — Frontend Sends Non-UUID, Backend Requires UUID v4

**Severity:** P0 (Revenue/Order/Data Loss)  
**Status:** FIXED  
**Fixed in:** `backend/src/domains/operations/controllers/orderController.ts`  
**Root cause:** Removed UUID v4 regex validation that blocked all non-UUID idempotency keys.

## Issue
The frontend generates idempotency keys in the format:  
`order_create_cod_${Date.now()}` (e.g., `order_create_cod_1686000000000`)  
`order_create_razorpay_${Date.now()}` (e.g., `order_create_razorpay_1686000000000`)

The backend (`orderController.ts` lines 260-268 and 349-357) uses a strict UUID v4 regex:  
`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`

## Blast Radius
**ALL order creation attempts through the frontend UI were rejected** with:  
`{ error: "INVALID_IDEMPOTENCY_KEY", message: "x-idempotency-key must be a valid UUID v4" }`

This affects:
- COD order placement (`/api/orders` with `paymentMethod: "cod"`)
- Razorpay order placement (`/api/orders` with `paymentMethod: "razorpay"`)
- Both `createOrder` and `placeOrderCOD` controllers

**100% orders blocked** → P0 (revenue loss)

## Fix Applied
Removed the UUID v4 format validation from both `createOrder` and `placeOrderCOD` functions. The `idempotencyMiddleware` (at `middleware/idempotency.ts`) already handles idempotency safely by storing response + body hash per key, making the strict format validation redundant and harmful.

## Trace
- **Frontend key generation:** `CheckoutPage.tsx:913` → `order_create_cod_${Date.now()}`
- **Frontend key generation:** `CheckoutPage.tsx:589` → `order_create_razorpay_${Date.now()}`
- **Backend validation:** `orderController.ts:262-268` (createOrder) + `:351-357` (placeOrderCOD)
- **Middleware:** `middleware/idempotency.ts:9` accepts any string key

## Verification
✅ API test with both `order_create_cod_*` and UUID formats now succeeds.
✅ COD order created with idempotency key `order_create_cod_1780752462`.
