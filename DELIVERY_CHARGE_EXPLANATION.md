# 🚚 DELIVERY CHARGE CALCULATION - COMPLETE EXPLANATION

## 📍 Overview

Your app calculates delivery charges based on **distance from the admin's store location** (Tiruvuru, Andhra Pradesh) to the customer's delivery address.

---

## 🏪 STORE LOCATION (Origin Point)

```javascript
Admin Office, Tiruvuru
Pincode: 521235
State: Andhra Pradesh
Coordinates: Lat 16.5, Lng 80.5
```

All delivery distances are calculated **FROM this location TO the customer's address**.

---

## 💰 PRICING STRUCTURE

### 1. **Free Delivery Threshold**
```
Order Amount ≥ ₹2,000 → FREE DELIVERY ✅
```

### 2. **Distance-Based Pricing** (for orders < ₹2,000)

| Distance Range | Delivery Charge |
|----------------|-----------------|
| **0 - 50 km** | ₹100 (flat) |
| **51 - 100 km** | ₹150 (flat) |
| **101+ km** | ₹150 + ₹10 per additional 10 km |

### 3. **Minimum Charge**
- Minimum delivery fee: **₹100** (for all orders under ₹2,000)

---

## 🔢 CALCULATION FORMULA

### Step 1: Calculate Distance
```javascript
Distance = Google Maps Distance Matrix API(Store → Customer Address)
Fallback: Haversine Formula (straight-line distance)
```

### Step 2: Check Free Delivery
```javascript
if (orderAmount >= 2000) {
  deliveryFee = 0 // FREE DELIVERY
}
```

### Step 3: Apply Distance-Based Pricing
```javascript
if (orderAmount < 2000) {
  if (distance <= 50) {
    deliveryFee = 100
  } 
  else if (distance <= 100) {
    deliveryFee = 150
  } 
  else {
    extraDistance = distance - 100
    extraCharges = ceil(extraDistance / 10) × 10
    deliveryFee = 150 + extraCharges
  }
}
```

### Step 4: Apply Minimum
```javascript
deliveryFee = max(deliveryFee, 100)
```

---

## 📊 CALCULATION EXAMPLES

### Example 1: Short Distance, Low Order
```
Order Amount: ₹500
Customer Address: Hyderabad (60 km from Tiruvuru)

Calculation:
- Order < ₹2,000 → Not free
- Distance = 60 km → Falls in 51-100 km range
- Delivery Fee = ₹150

Total Amount = ₹500 + ₹150 = ₹650
```

### Example 2: Short Distance, High Order
```
Order Amount: ₹2,500
Customer Address: Vijayawada (30 km from Tiruvuru)

Calculation:
- Order ≥ ₹2,000 → FREE DELIVERY ✅
- Delivery Fee = ₹0

Total Amount = ₹2,500 + ₹0 = ₹2,500
```

### Example 3: Long Distance
```
Order Amount: ₹1,000
Customer Address: Bangalore (650 km from Tiruvuru)

Calculation:
- Order < ₹2,000 → Not free
- Distance = 650 km
- Base charge (first 100 km) = ₹150
- Extra distance = 650 - 100 = 550 km
- Extra charges = ceil(550 / 10) × 10 = 55 × 10 = ₹550
- Delivery Fee = ₹150 + ₹550 = ₹700

Total Amount = ₹1,000 + ₹700 = ₹1,700
```

### Example 4: Very Close Location
```
Order Amount: ₹800
Customer Address: Within Tiruvuru (5 km)

Calculation:
- Order < ₹2,000 → Not free
- Distance = 5 km → Falls in 0-50 km range
- Delivery Fee = ₹100

Total Amount = ₹800 + ₹100 = ₹900
```

---

## 🛠️ IMPLEMENTATION DETAILS

### Backend (Node.js)

**Location:** `/backend/src/utils/deliveryFeeCalculator.ts`

**Key Functions:**

1. **`getRoadDistance(userAddress)`**
   - Uses Google Maps Distance Matrix API
   - Gets actual road distance (not straight line)
   - Fallback to Haversine formula if API fails

2. **`calculateDeliveryFee(userAddress, orderAmount)`**
   - Main calculation function
   - Returns detailed breakdown

3. **`getDeliveryFeeBreakdown(userAddress, orderAmount)`**
   - Formatted output for display

**API Endpoint:**
```
POST /api/delivery-fee/calculate-fee
Body: { address: { lat, lng, city, pincode } }
```

### Frontend (React)

**Location:** `/frontend/src/utils/deliveryFeeCalculator.ts`

**Where It's Used:**
1. **CartPage.tsx** - Shows delivery charge in cart summary
2. **CheckoutPage.tsx** - Shows delivery charge before payment

**Display Logic:**
```javascript
const userAddress = useMemo(() => {
  // Get user's default or selected address
  // Calculate delivery fee based on coordinates
}, [auth.user, selectedAddress]);

const { deliveryFee, isFreeDelivery } = calculateDeliveryFee(
  userAddress,
  cart.total
);

// Show in UI
{isFreeDelivery ? (
  <span className="text-green-600">FREE</span>
) : (
  <span>₹{deliveryFee}</span>
)}
```

---

## 🌐 DISTANCE CALCULATION METHODS

### Method 1: Google Distance Matrix API (Primary)
```javascript
// Actual road distance via Google Maps
const response = await googleMapsClient.distancematrix({
  origins: [`${ADMIN_LAT},${ADMIN_LNG}`],
  destinations: [`${USER_LAT},${USER_LNG}`],
  key: GOOGLE_MAPS_API_KEY
});

distance = response.data.rows[0].elements[0].distance.value / 1000; // km
```

**Pros:**
- Accurate road distance
- Considers actual routes
- Accounts for traffic patterns

### Method 2: Haversine Formula (Fallback)
```javascript
// Straight-line distance (as crow flies)
const R = 6371; // Earth radius in km
const dLat = (lat2 - lat1) × π/180
const dLng = (lng2 - lng1) × π/180

a = sin²(dLat/2) + cos(lat1) × cos(lat2) × sin²(dLng/2)
c = 2 × atan2(√a, √(1-a))
distance = R × c
```

**Pros:**
- Works offline
- Fast calculation
- No API dependency

**Cons:**
- Less accurate (straight line)
- Doesn't account for roads

---

## 📦 ORDER CREATION WITH DELIVERY FEE

When an order is placed:

1. **Calculate delivery fee** based on selected address
2. **Add to order total**:
   ```javascript
   orderTotal = cartTotal + deliveryFee
   ```
3. **Store in Order document**:
   ```javascript
   {
     items: [...],
     totalAmount: orderTotal,
     earnings: {
       deliveryFee: deliveryFee,
       tip: 0,
       commission: 0
     },
     address: customerAddress
   }
   ```

4. **Delivery boy receives** the `deliveryFee` as earnings

---

## 🎯 KEY FEATURES

### ✅ What's Included:
- Real-time distance calculation
- Dynamic pricing based on distance
- Free delivery for orders ≥ ₹2,000
- Minimum charge protection (₹100)
- Google Maps integration
- Fallback calculation method
- Transparent fee breakdown

### ❌ What's NOT Included (Yet):
- Time-based surge pricing
- Peak hour charges
- Weather-based adjustments
- Weight-based pricing
- Express delivery premium
- Multiple delivery zones

---

## 🔧 CONFIGURATION

All settings are in `/backend/src/utils/deliveryFeeCalculator.ts`:

```javascript
const DELIVERY_CONFIG = {
  FREE_DELIVERY_THRESHOLD: 2000,  // ₹2,000
  DISTANCE_0_50_KM: 100,           // ₹100
  DISTANCE_51_100_KM: 150,         // ₹150
  BASE_CHARGE_100KM: 150,          // ₹150
  EXTRA_10KM_RATE: 10,             // ₹10 per 10km
};

const ADMIN_ADDRESS = {
  label: "Admin Office",
  pincode: "521235",
  city: "Tiruvuru",
  state: "Andhra Pradesh",
  lat: 16.5,
  lng: 80.5,
};
```

**To modify pricing:**
1. Edit values in `DELIVERY_CONFIG`
2. Restart backend server
3. Changes apply immediately

---

## 📱 USER EXPERIENCE FLOW

1. **User adds items to cart**
2. **User views cart** → Sees estimated delivery charge
3. **User selects/adds delivery address**
4. **System calculates distance** from Tiruvuru to address
5. **Delivery fee updates** based on distance + order amount
6. **User sees breakdown**:
   - Subtotal: ₹XXX
   - Delivery: ₹XXX (or FREE)
   - Total: ₹XXX
7. **User proceeds to checkout**
8. **Final amount** includes delivery charge
9. **Order created** with delivery fee recorded

---

## 🐛 TROUBLESHOOTING

### Issue: Delivery charge showing ₹0 for all orders
**Solution:** Check if `orderAmount >= 2000` - Free delivery applies

### Issue: Very high delivery charge
**Solution:** Check distance calculation - might be long distance from Tiruvuru

### Issue: Delivery charge not updating
**Solution:** 
- Ensure address has valid lat/lng coordinates
- Check Google Maps API key is configured
- Verify backend `/api/delivery-fee/calculate-fee` is working

### Issue: API errors
**Solution:**
- Check `GOOGLE_MAPS_API_KEY` in backend `.env`
- System will fallback to Haversine formula automatically

---

## 💡 FUTURE ENHANCEMENTS

Possible improvements:
1. **Multiple store locations** - Calculate from nearest store
2. **Delivery zones** - Different pricing for different areas
3. **Time slots** - Premium for specific delivery times
4. **Express delivery** - Higher charge for faster delivery
5. **Weight-based** - Additional charge for heavy items
6. **Subscription** - Free delivery for premium members
7. **Coupons** - Discount codes for delivery waiver

---

## ✅ SUMMARY

**Your delivery charge system:**
- ✅ Distance-based calculation from Tiruvuru
- ✅ Free delivery on orders ≥ ₹2,000
- ✅ Tiered pricing: ₹100 (0-50km), ₹150 (51-100km), ₹150+ (100km+)
- ✅ Google Maps integration with fallback
- ✅ Real-time calculation
- ✅ Transparent fee breakdown
- ✅ Fair and predictable pricing

**This is an enterprise-grade delivery fee system!** 🚀
