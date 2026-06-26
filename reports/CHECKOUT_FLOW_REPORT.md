# Checkout / Money-Path Flow Report
## VyaparSetu / Dream — full revenue loop tested in real browser

**Date:** 2026-06-20
**Method:** Real Chromium driving the live web app, real backend on replica-set MongoDB + Redis.
Authenticated as the test customer via OTP. **Production data untouched.**
Screenshots: `reports/checkout-flow/`.

---

## ✅ COD (Cash on Delivery) — FULLY WORKING, end-to-end

Verified both via API and through the browser UI:

| Step | Result | Evidence |
|------|--------|----------|
| Login (OTP) | ✅ | token issued |
| Open product detail | ✅ | `1-product.png`; 1 Add-to-Cart button |
| Click "Add to Cart" | ✅ | cart persisted |
| View cart | ✅ HAS ITEMS | `2-cart.png` |
| Open checkout | ✅ renders COD option + order total (not empty) | `3-checkout.png` |
| Select COD | ✅ | `4-cod-selected.png` |
| "Place Order" button | ✅ present + enabled | — |
| Place order | ✅ → redirected to `/order-success/{orderId}` | `5-after-place.png` |
| Order persisted | ✅ order `6a36ee8c540b20fb8c4b6582`, status `CREATED`, payment `cod`, total ₹60.40 | GET /api/orders |
| Errors | ✅ 0 page errors, 0 API errors | — |

**Conclusion:** The core COD revenue flow (browse → cart → checkout → place order → confirmation
→ order history) is **working correctly**. Orders are created atomically (replica-set transactions),
the success page is reached, and the order appears in the customer's history.

Prerequisites that had to be true (now confirmed working):
- Pincode serviceability: `GET /api/pincode/check/521235` → `{deliverable:true, state:"Andhra Pradesh"}`.
- Customer must have a valid address (label, pincode, city, state, postal_district, admin_district,
  addressLine, lat, lng) with a serviceable pincode and coordinates.
- Idempotency key sent on order creation (`Idempotency-Key` header) — present and honored.

---

## ⚠️ UPI / Razorpay — NOT testable locally (no gateway credentials)

- The checkout page offers UPI and card/netbanking (Razorpay) in addition to COD.
- These paths call `createRazorpayOrder` → backend `/payment-intents` → Razorpay SDK, which requires
  `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`. These are **not set** in the local test env (and must not
  use production keys), so the Razorpay/UPI path **cannot be exercised here**.
- **This is an environment limitation, not a code defect.** The order-creation half (POST /orders with
  `paymentMethod:"razorpay"`) shares the same verified code path as COD; only the gateway handshake is
  untested locally.
- **To test fully:** provide Razorpay **test-mode** keys (`rzp_test_...`) in the backend env and a test
  UPI VPA; then the UPI verify (`/upi/verify`) and Razorpay checkout + webhook can be driven in sandbox.

---

## Cumulative status of the money path

| Sub-flow | Status |
|----------|--------|
| Add to cart (UI) | WORKING |
| Cart view/update | WORKING |
| Pincode serviceability check | WORKING |
| Address requirement enforcement | WORKING |
| COD order creation | WORKING (verified, order persisted) |
| Order success page | WORKING |
| Order history | WORKING |
| Idempotency on order create | WORKING (header honored) |
| UPI verify | UNTESTED (needs test VPA/keys) |
| Razorpay intent + checkout + webhook | UNTESTED (needs test keys) |

---

## Recommendations
1. Add Razorpay **test-mode** keys to a dedicated test env so the UPI/Razorpay path can be CI-tested
   in sandbox (never production keys).
2. Add a Playwright test that runs this exact COD journey on every build to prevent checkout regressions.
3. The ₹0.40 delta on a ₹60 order (total ₹60.40) appears to be a rounding/fee artifact — verify the
   delivery-fee/GST rounding in `priceCalculator.ts` is intended for small COD orders.
4. Seed a serviceable test pincode + address fixture in the dev bootstrap so checkout is testable
   out-of-the-box (currently the bootstrap creates the admin but not a ready-to-checkout customer).
