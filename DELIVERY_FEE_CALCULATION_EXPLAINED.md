# Complete Delivery Fee Calculation Logic - Explained 📦

## Overview
This document explains the **entire delivery fee calculation system** used in your project, covering both frontend and backend implementations, without modifying any code.

---

## 1. File Locations & Functions

### Frontend Files:

#### **`/frontend/src/utils/deliveryFeeCalculator.ts`**
- **Primary Functions:**
  - `calculateDistance(lat1, lng1, lat2, lng2)` - Haversine formula to calculate straight-line distance
  - `calculateDeliveryFee(userAddress, orderAmount)` - Main calculation logic (synchronous)
  - `getDeliveryFeeBreakdown(userAddress, orderAmount)` - Formatted breakdown for display
  - `calculateDeliveryFeeForPincode(pincode, orderAmount)` - Async wrapper for pincode-based calculation
  - `isDeliveryAvailable(pincode)` - Check if delivery is available to a pincode
  - `formatDeliveryFee(fee, isFree)` - Format fee for display
  - `getAdminAddress()` - Returns admin warehouse location

#### **`/frontend/src/utils/priceCalculator.ts`**
- **Functions:**
  - `calculatePriceBreakdown(items, deliveryFeeDetails)` - Combines cart total + delivery fee
  - `formatPrice(amount)` - Format price as ₹XX.XX
  - `formatDeliveryFee(deliveryFeeDetails)` - Display delivery fee or "FREE"

#### **`/frontend/src/components/DeliveryFeeDisplay.tsx`**
- **Component:** Displays delivery fee breakdown with distance and charges
- **Uses:** `calculateDeliveryFeeForPincode()` from deliveryFeeCalculator

#### **`/frontend/src/pages/CheckoutPage.tsx`**
- **Lines 538-586:** Calculates delivery fee based on user's default address
- **Uses:** `calculateDeliveryFee()` directly from deliveryFeeCalculator

#### **`/frontend/src/pages/CartPage.tsx`**
- **Lines 44-95:** Similar logic to CheckoutPage for cart delivery fee display
- **Uses:** `calculateDeliveryFee()` from deliveryFeeCalculator

---

### Backend Files:

#### **`/backend/src/utils/deliveryFeeCalculator.ts`**
- **Primary Functions:**
  - `getRoadDistance(userAddress)` - **Google Distance Matrix API** for actual road distance
  - `calculateHaversineDistance(lat1, lng1, lat2, lng2)` - Fallback when API fails
  - `calculateDeliveryFee(userAddress, orderAmount)` - Main calculation (async, uses Google API)
  - `getDeliveryFeeBreakdown(userAddress, orderAmount)` - Formatted breakdown
  - `getAdminAddress()` - Returns admin warehouse location
  - `isDeliveryAvailable(pincode)` - Pincode delivery check

#### **`/backend/src/controllers/enhancedDeliveryFeeController.ts`**
- Backend API endpoints for delivery fee calculation (if needed from server)

#### **`/backend/src/models/Order.ts`**
- **Lines 54-58:** `IEarnings` interface includes `deliveryFee` field
- **Lines 64:** `totalAmount` includes delivery fee in final order total

---

## 2. Input Values Used for Calculation

### Required Inputs:
1. **User Address Coordinates:**
   - `lat` (latitude) - User's delivery location latitude
   - `lng` (longitude) - User's delivery location longitude
   - Example: `{ lat: 17.385, lng: 78.4867 }` (Hyderabad)

2. **Order Amount (Cart Total):**
   - `orderAmount` - Total cart value before delivery fee
   - Example: `₹1500` or `₹2500`

3. **Admin/Warehouse Location (Hardcoded):**
   - Fixed origin: **Tiruvuru, Andhra Pradesh**
   - Coordinates: `{ lat: 16.5, lng: 80.5 }`
   - Pincode: `521235`

### NOT Used:
- ❌ Weight - Not considered in current logic
- ❌ Pincode zones - Not used for pricing (only coordinates)
- ❌ Product dimensions - Not factored in
- ❌ Time of day - No surge pricing
- ❌ Number of items - Only total cart value matters

---

## 3. How Default Address Affects Delivery Fee

### In CheckoutPage (Lines 538-586):

```typescript
const userAddress = React.useMemo(() => {
  // Get addresses and defaultAddressId from RTK Query cache
  const addresses = addressesData?.addresses || [];
  const defaultAddressId = addressesData?.defaultAddressId || null;

  // Find the default address using defaultAddressId
  if (defaultAddressId && addresses.length > 0) {
    const defaultAddr = addresses.find((addr: any) => 
      (addr._id === defaultAddressId || addr.id === defaultAddressId)
    );
    if (defaultAddr) {
      return ensureCoordinates(defaultAddr); // ← This address is used!
    }
  }
  
  // Fallback to Hyderabad if no default found
  return { lat: 17.385, lng: 78.4867, ... };
}, [addressesData]);

// Calculate delivery fee using default address
const calculatedDeliveryFeeDetails = calculateDeliveryFee(
  userAddress,  // ← Uses the default address found above
  cart.total
);
```

### Flow:
```
RTK Query fetches addresses
  ↓
addressesData = { addresses: [...], defaultAddressId: "abc123" }
  ↓
Find address where _id === defaultAddressId
  ↓
Extract { lat, lng } from that address
  ↓
Pass to calculateDeliveryFee(userAddress, cartTotal)
  ↓
Distance calculated from Tiruvuru to user's default address coordinates
```

### Key Point:
- **defaultAddressId** determines which address coordinates are used
- If user changes default address → `defaultAddressId` updates → New coordinates used → Different delivery fee calculated

---

## 4. Frontend vs Backend Calculation

### Current Implementation: **FRONTEND ONLY**

#### Why Frontend?
1. **Real-time updates:** Instant recalculation when address changes
2. **No server delay:** No API call needed, faster UX
3. **Client-side caching:** Delivery fee updates immediately in CheckoutPage and CartPage

#### Backend Availability:
- Backend has similar logic in `/backend/src/utils/deliveryFeeCalculator.ts`
- **Difference:** Backend uses **Google Distance Matrix API** for actual road distance
- **Frontend uses:** Haversine formula (straight-line distance)

### Why Not Backend (Currently)?
- Frontend calculation is **"good enough"** for estimate
- Saves API calls and Google Maps API costs
- Real distance calculation can be added later for more accuracy

#### Backend Integration (If Enabled):
```typescript
// Backend has this function:
export async function getRoadDistance(userAddress: IAddress): Promise<number> {
  const response = await googleMapsClient.distancematrix({
    origins: [`${ADMIN_ADDRESS.lat},${ADMIN_ADDRESS.lng}`],
    destinations: [`${userAddress.lat},${userAddress.lng}`],
    key: process.env.GOOGLE_MAPS_API_KEY,
  });
  // Returns actual road distance in km
}
```

**Currently NOT called from frontend.**

---

## 5. Exact Calculation Formula - Step-by-Step

### Configuration Constants:

```typescript
const DELIVERY_CONFIG = {
  FREE_DELIVERY_THRESHOLD: 2000,    // Free delivery above ₹2000
  DISTANCE_0_50_KM: 100,            // ₹100 for 0-50km
  DISTANCE_51_100_KM: 150,          // ₹150 for 51-100km
  BASE_CHARGE_100KM: 150,           // Base for 100km+
  EXTRA_10KM_RATE: 10,              // ₹10 per extra 10km
};
```

---

### Step 1: Calculate Distance (Haversine Formula)

```typescript
function calculateDistance(lat1, lng1, lat2, lng2): number {
  const R = 6371; // Earth's radius in km
  
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI/180) *
            Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 100) / 100; // Round to 2 decimals
}
```

**Example:**
- Admin (Tiruvuru): `lat=16.5, lng=80.5`
- User (Hyderabad): `lat=17.385, lng=78.4867`
- **Distance ≈ 202.45 km** (straight-line)

---

### Step 2: Check Free Delivery Threshold

```typescript
const isFreeDelivery = orderAmount >= 2000;

if (isFreeDelivery) {
  return {
    distance: distance,
    baseFee: 0,
    distanceFee: 0,
    totalFee: 0,
    isFreeDelivery: true,
    finalFee: 0, // ← FREE!
  };
}
```

**Example:**
- Cart Total: `₹2500` → **Free Delivery ✅**
- Cart Total: `₹1500` → **Charged ❌**

---

### Step 3: Calculate Fee Based on Distance (If Not Free)

#### Distance-Based Pricing Tiers:

| Distance Range | Delivery Fee Formula |
|----------------|---------------------|
| **0-50 km** | Flat `₹100` |
| **51-100 km** | Flat `₹150` |
| **100+ km** | `₹150 + ₹10 per extra 10km` |

#### Code Logic:

```typescript
let deliveryFee: number;

if (distance <= 50) {
  deliveryFee = 100; // Tier 1
  
} else if (distance <= 100) {
  deliveryFee = 150; // Tier 2
  
} else {
  // Tier 3: Beyond 100km
  const extraDistance = distance - 100;
  const extraCharges = Math.ceil(extraDistance / 10) * 10;
  deliveryFee = 150 + extraCharges;
}

// Ensure minimum ₹100 for orders under ₹2000
if (orderAmount < 2000) {
  deliveryFee = Math.max(deliveryFee, 100);
}
```

---

### Step 4: Examples with Real Calculations

#### Example 1: Short Distance (30 km), Cart = ₹1500
```
distance = 30 km
orderAmount = ₹1500

Step 1: Check free delivery
  → 1500 < 2000 → NOT FREE ❌

Step 2: Calculate fee
  → distance <= 50 → deliveryFee = ₹100

Step 3: Ensure minimum
  → max(100, 100) = ₹100

Result: ₹100 delivery fee
```

---

#### Example 2: Medium Distance (75 km), Cart = ₹1800
```
distance = 75 km
orderAmount = ₹1800

Step 1: Check free delivery
  → 1800 < 2000 → NOT FREE ❌

Step 2: Calculate fee
  → 51 <= distance <= 100 → deliveryFee = ₹150

Step 3: Ensure minimum
  → max(150, 100) = ₹150

Result: ₹150 delivery fee
```

---

#### Example 3: Long Distance (150 km), Cart = ₹1200
```
distance = 150 km
orderAmount = ₹1200

Step 1: Check free delivery
  → 1200 < 2000 → NOT FREE ❌

Step 2: Calculate fee
  → distance > 100
  → extraDistance = 150 - 100 = 50 km
  → extraCharges = ceil(50 / 10) * 10 = 5 * 10 = ₹50
  → deliveryFee = 150 + 50 = ₹200

Step 3: Ensure minimum
  → max(200, 100) = ₹200

Result: ₹200 delivery fee
```

---

#### Example 4: Any Distance, Cart = ₹2500
```
distance = ANY (doesn't matter)
orderAmount = ₹2500

Step 1: Check free delivery
  → 2500 >= 2000 → FREE! ✅

Result: ₹0 delivery fee (FREE DELIVERY)
```

---

### Summary Formula:

```
IF orderAmount >= ₹2000:
    deliveryFee = ₹0 (FREE)

ELSE IF distance <= 50 km:
    deliveryFee = ₹100

ELSE IF distance <= 100 km:
    deliveryFee = ₹150

ELSE (distance > 100 km):
    extraDistance = distance - 100
    extraCharges = ceil(extraDistance / 10) * ₹10
    deliveryFee = ₹150 + extraCharges

FINALLY:
    deliveryFee = max(deliveryFee, ₹100)  // Minimum ₹100 for orders under ₹2000
```

---

## 6. How Delivery Fee is Passed to Checkout Page UI

### Data Flow:

```
CheckoutPage Component (Lines 538-586)
  ↓
1. Get default address from RTK Query:
   const userAddress = useMemo(() => {
     const defaultAddressId = addressesData?.defaultAddressId;
     const defaultAddr = addresses.find(addr => addr._id === defaultAddressId);
     return defaultAddr; // { lat, lng, city, state, pincode }
   }, [addressesData]);

  ↓
2. Calculate delivery fee:
   const calculatedDeliveryFeeDetails = calculateDeliveryFee(
     userAddress,  // { lat: 17.385, lng: 78.4867 }
     cart.total    // ₹1500
   );
   // Returns: { distance: 202, baseFee: 200, finalFee: 200, isFreeDelivery: false }

  ↓
3. Store in state:
   React.useEffect(() => {
     setDeliveryFee(calculatedDeliveryFeeDetails.finalFee);      // ₹200
     setIsFreeDelivery(calculatedDeliveryFeeDetails.isFreeDelivery); // false
   }, [calculatedDeliveryFeeDetails]);

  ↓
4. Calculate total price breakdown:
   const priceBreakdown = calculatePriceBreakdown(
     cart.items,                      // [{ price: 500, qty: 3 }]
     calculatedDeliveryFeeDetails     // { finalFee: 200, isFreeDelivery: false }
   );
   // Returns: { subtotal: 1500, deliveryFee: 200, total: 1700 }

  ↓
5. Display in UI (Lines 1548-1575):
   <div>
     <p>Subtotal: ₹{priceBreakdown.subtotal}</p>
     <p>Delivery Fee: ₹{priceBreakdown.deliveryFee}</p>
     <p>Total: ₹{priceBreakdown.total}</p>
   </div>
```

---

### Key Components:

#### **`DeliveryFeeDisplay` Component:**
```tsx
<DeliveryFeeDisplay
  pincode={userAddress.pincode}      // "500001"
  cartValue={cart.total}              // ₹1500
  onFeeChange={handleDeliveryFeeChange}  // Callback to update state
/>
```

**Displays:**
```
┌─────────────────────────────────┐
│ 🚚 Delivery Fee                 │
│                                 │
│ Base Fee:     ₹200              │
│ Distance Fee: ₹0                │
│ Total:        ₹200              │
│                                 │
│ 202km from warehouse            │
└─────────────────────────────────┘
```

---

### Price Breakdown Display:

```tsx
// In CheckoutPage UI (Right sidebar)
<div className="space-y-3">
  <div className="flex justify-between">
    <span>Subtotal:</span>
    <span>₹{priceBreakdown.subtotal}</span>  {/* ₹1500 */}
  </div>
  
  <div className="flex justify-between">
    <span>Delivery Fee:</span>
    <span>
      {priceBreakdown.isFreeDelivery 
        ? "FREE" 
        : `₹${priceBreakdown.deliveryFee}`}  {/* ₹200 */}
    </span>
  </div>
  
  <div className="flex justify-between text-lg font-bold">
    <span>Total:</span>
    <span>₹{priceBreakdown.total}</span>  {/* ₹1700 */}
  </div>
</div>
```

---

## 7. How Delivery Fee is Stored in Order Object

### Current Implementation: **NOT STORED SEPARATELY**

#### Order Schema (Backend):

```typescript
export interface IOrder {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  totalAmount: number;  // ← Includes delivery fee (subtotal + deliveryFee - discount)
  paymentMethod: "card" | "upi" | "netbanking" | "cod";
  paymentStatus: "pending" | "paid" | "failed";
  orderStatus: "pending" | "confirmed" | "delivered" | ...;
  address: IOrderAddress;
  earnings?: IEarnings; // ← Has deliveryFee field but not used currently
  // ... other fields
}

export interface IEarnings {
  deliveryFee: number;  // ← Exists but not populated during order creation
  tip: number;
  commission: number;
}
```

---

### Order Creation (COD Example):

```typescript
// In orderController.ts (Lines 189-198)
const order = new Order({
  userId,
  items: formattedItems,
  totalAmount,           // ← Includes delivery fee already calculated on frontend
  address: enrichedAddress,
  paymentMethod: "cod",
  paymentStatus: "pending",
  orderStatus: "created",
  // earnings: { deliveryFee: 200 } ← NOT SET currently
});

await order.save();
```

---

### What `totalAmount` Contains:

```
Frontend Calculation (priceCalculator.ts):

subtotal = sum(item.price * item.quantity)
discount = subtotal * 0.1
deliveryFee = calculatedDeliveryFeeDetails.finalFee
total = subtotal + deliveryFee - discount

↓

This `total` is sent as `totalAmount` to backend
```

**Example:**
```
Cart Items:
  - Product A: ₹500 × 3 = ₹1500

subtotal = ₹1500
discount = ₹150 (10%)
deliveryFee = ₹200 (calculated based on distance)
total = 1500 + 200 - 150 = ₹1550

↓

Order.totalAmount = ₹1550 (stored in database)
```

---

### Issue: Delivery Fee NOT Stored Separately

**Current Behavior:**
- `totalAmount` includes delivery fee
- But `earnings.deliveryFee` is NOT populated
- **Cannot determine delivery fee from order alone** after it's placed

**Example Order Document:**
```json
{
  "_id": "order_123",
  "userId": "user_456",
  "items": [
    { "productId": "prod_789", "name": "Product A", "price": 500, "qty": 3 }
  ],
  "totalAmount": 1550,  // ← Includes ₹200 delivery, but can't tell
  "address": { "city": "Hyderabad", "pincode": "500001", ... },
  "paymentMethod": "cod",
  "paymentStatus": "pending",
  "orderStatus": "created",
  "earnings": {
    "deliveryFee": 0,  // ← NOT POPULATED! Should be 200
    "tip": 0,
    "commission": 0
  }
}
```

---

### To Fix (Not Implemented Yet):

**Would need to modify order creation to store delivery fee separately:**

```typescript
// Calculate delivery fee on backend before saving order
const deliveryFeeDetails = await calculateDeliveryFee(userAddress, cartTotal);

const order = new Order({
  userId,
  items: formattedItems,
  totalAmount,  // Still includes delivery fee in total
  address: enrichedAddress,
  earnings: {
    deliveryFee: deliveryFeeDetails.finalFee,  // ← Store separately
    tip: 0,
    commission: 0,
  },
  // ... rest
});
```

**But currently this is NOT done.**

---

## 8. Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ USER CHANGES DEFAULT ADDRESS                            │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ RTK Query: useGetAddressesQuery()                       │
│ Returns: { addresses: [...], defaultAddressId: "abc" } │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ CheckoutPage: useMemo()                                 │
│ Finds: defaultAddr = addresses.find(a => a._id === id) │
│ Extracts: { lat: 17.385, lng: 78.4867, ... }          │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ deliveryFeeCalculator.ts: calculateDeliveryFee()       │
│ 1. calculateDistance(adminLat, adminLng, userLat, lng) │
│    → distance = 202.45 km (Haversine)                  │
│ 2. Check: orderAmount >= 2000? → NO (₹1500)           │
│ 3. Calculate: distance > 100 → ₹150 + (102*10) = ₹200 │
│ 4. Return: { finalFee: 200, isFreeDelivery: false }   │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ priceCalculator.ts: calculatePriceBreakdown()          │
│ subtotal = ₹1500                                        │
│ discount = ₹150                                         │
│ deliveryFee = ₹200                                      │
│ total = 1500 + 200 - 150 = ₹1550                       │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ CHECKOUT PAGE UI DISPLAYS:                             │
│ ┌─────────────────────────────────┐                    │
│ │ Order Summary                    │                    │
│ │ Subtotal:      ₹1500            │                    │
│ │ Delivery Fee:  ₹200             │                    │
│ │ Discount:     -₹150             │                    │
│ │ Total:         ₹1550            │                    │
│ └─────────────────────────────────┘                    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ USER PLACES ORDER (COD or Razorpay)                    │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ Backend: orderController.ts or paymentController.ts    │
│ Creates Order:                                          │
│   totalAmount: 1550  (includes delivery ₹200)          │
│   earnings: { deliveryFee: 0 } ← NOT SET!              │
└───────────────────┬─────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│ ORDER SAVED TO MONGODB                                  │
│ { totalAmount: 1550, earnings: { deliveryFee: 0 } }   │
└─────────────────────────────────────────────────────────┘
```

---

## 9. Key Takeaways

### ✅ What Works:
1. Distance-based delivery fee calculation using Haversine formula
2. Free delivery for orders ≥ ₹2000
3. Tiered pricing: ₹100 (0-50km), ₹150 (51-100km), ₹150+extras (100km+)
4. Real-time recalculation when default address changes
5. Displayed correctly in Checkout and Cart pages

### ⚠️ Current Limitations:
1. **Frontend-only calculation** - No backend validation
2. **Straight-line distance** - Not actual road distance (could use Google API)
3. **Delivery fee NOT stored separately** in Order - Only included in `totalAmount`
4. **No weight/dimensions** considered
5. **No pincode zones** - Only coordinate-based distance

### 🔮 Possible Improvements (Not Implemented):
1. Store `earnings.deliveryFee` separately in Order document
2. Use backend Google Distance Matrix API for accurate road distance
3. Add pincode-based zone pricing
4. Consider product weight/dimensions
5. Add surge pricing for peak hours
6. Validate delivery fee on backend before order placement

---

## 10. Example with Different Cities

### Warehouse: Tiruvuru (16.5, 80.5)

| City | Coordinates | Distance | Cart: ₹1500 Fee | Cart: ₹2500 Fee |
|------|-------------|----------|-----------------|-----------------|
| **Hyderabad** | 17.385, 78.4867 | ~202 km | ₹200 | FREE |
| **Vijayawada** | 16.5062, 80.6480 | ~15 km | ₹100 | FREE |
| **Chennai** | 13.0827, 80.2707 | ~389 km | ₹440 | FREE |
| **Bangalore** | 12.9716, 77.5946 | ~534 km | ₹590 | FREE |

**Formula for Chennai:**
```
distance = 389 km
389 > 100
extraDistance = 389 - 100 = 289 km
extraCharges = ceil(289 / 10) * 10 = 29 * 10 = ₹290
deliveryFee = 150 + 290 = ₹440
```

---

## Conclusion

The delivery fee system is **frontend-driven**, **distance-based**, with a **free delivery threshold**. It uses the **default address coordinates** to calculate straight-line distance from the admin warehouse in Tiruvuru, applying tiered pricing based on distance ranges. The final fee is included in the order's `totalAmount`, but **not stored separately** in the `earnings.deliveryFee` field.

**No code was modified in this explanation - this is purely documentation of the existing implementation.** ✅
