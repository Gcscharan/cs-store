# 🧪 TEST ENHANCED DELIVERY FEE SYSTEM - RIGHT NOW

## ⚡ QUICK TEST (2 Minutes)

Your enhanced delivery fee system is **already running** on your backend!

---

## 🎯 METHOD 1: API Testing (FASTEST)

### Step 1: Open a new terminal

### Step 2: Login to get JWT token
```bash
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@test.com","password":"customer123"}'
```

**Copy the `accessToken` from the response!**

### Step 3: Calculate delivery fee
```bash
curl -X GET "http://localhost:5002/api/delivery-fee-v2/calculate?orderAmount=1500" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

**Replace `YOUR_ACCESS_TOKEN_HERE` with the token from Step 2**

### Expected Result:
```json
{
  "success": true,
  "data": {
    "warehouse": {
      "id": "WH001",
      "name": "Tiruvuru Main Warehouse",
      "city": "Tiruvuru"
    },
    "distance": {
      "value": 45.3,
      "method": "HAVERSINE",
      "cached": false
    },
    "fees": {
      "baseFee": 150,
      "distanceFee": 87,
      "surcharges": [],
      "subtotal": 237,
      "discount": 0,
      "total": 240
    },
    "delivery": {
      "isFreeDelivery": false,
      "isDeliverable": true,
      "estimatedTime": "2-4 hours",
      "estimatedDays": 3
    },
    "breakdown": "Base Fee: ₹150 | Distance Charge: ₹87 | Total: ₹240"
  }
}
```

---

## 🎯 METHOD 2: Test Suite (COMPREHENSIVE)

### Step 1: Navigate to backend
```bash
cd /Users/gannavarapuchiranjeevisatyacharan/Desktop/Dream/backend
```

### Step 2: Run test suite
```bash
PATH="/opt/homebrew/bin:$PATH" npx ts-node src/tests/deliveryFeeService.test.ts
```

### Expected Output:
```
╔══════════════════════════════════════════════════════════════╗
║      ENHANCED DELIVERY FEE CALCULATION - TEST SUITE         ║
╚══════════════════════════════════════════════════════════════╝

=== TEST 1: Local Delivery (< 5km) ===
Input:
  Order Amount: ₹500
  Order Weight: 2kg
  Address: Hyderabad, Telangana

Result:
  Warehouse: Tiruvuru Main Warehouse (Tiruvuru)
  Distance: 45.3 km (via HAVERSINE)
  Base Fee: ₹150
  Distance Fee: ₹87
  Surcharges: ₹0
  Subtotal: ₹237
  Discount: -₹0
  TOTAL: ₹240
  Free Delivery: NO
  Estimated Time: 2-4 hours

... (4 more tests)

╔══════════════════════════════════════════════════════════════╗
║                      ALL TESTS COMPLETED                     ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 🎯 METHOD 3: Guest User Estimate (NO LOGIN)

### Test without authentication:
```bash
curl -X POST http://localhost:5002/api/delivery-fee-v2/estimate \
  -H "Content-Type: application/json" \
  -d '{
    "pincode": "500001",
    "orderAmount": 1500
  }'
```

**No token required!** This works for guest users.

---

## 🎯 METHOD 4: Get Configuration

### See all pricing tiers and rules:
```bash
curl -X GET http://localhost:5002/api/delivery-fee-v2/config
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "freeDeliveryThreshold": 2000,
    "minimumFee": 40,
    "maximumFee": 1000,
    "expressDeliverySurcharge": 50,
    "tiers": [
      {
        "distanceRange": "0-5 km",
        "baseFee": 40,
        "perKmFee": 5,
        "estimatedTime": "30-45 mins"
      },
      ...
    ],
    "warehouses": [...]
  }
}
```

---

## 🧪 REAL-WORLD TEST SCENARIOS

### Scenario 1: Free Delivery Test
```bash
# Order above ₹2,000 should be FREE
curl -X GET "http://localhost:5002/api/delivery-fee-v2/calculate?orderAmount=2500" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: total = 0, isFreeDelivery = true
```

### Scenario 2: Heavy Item Test
```bash
# Heavy item (>10kg) should add ₹50 surcharge
curl -X GET "http://localhost:5002/api/delivery-fee-v2/calculate?orderAmount=1000&orderWeight=15" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: surcharges array includes "Heavy Item Surcharge: ₹50"
```

### Scenario 3: Express Delivery Test
```bash
# Express delivery should add ₹50 surcharge
curl -X GET "http://localhost:5002/api/delivery-fee-v2/calculate?orderAmount=1000&expressDelivery=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: surcharges includes "Express Delivery: ₹50", estimatedDays = 1
```

---

## 📊 EXPECTED BEHAVIOR

### For Order = ₹500 (customer@test.com address):
```
✅ Distance: ~45 km from Tiruvuru
✅ Tier: 20-50 km
✅ Base Fee: ₹150
✅ Distance Fee: ~₹87
✅ Total: ~₹240
✅ Estimated Time: 2-4 hours
```

### For Order = ₹2,500 (same address):
```
✅ Distance: ~45 km
✅ Original Fee: ~₹240
✅ Discount: -₹240 (FREE DELIVERY)
✅ Total: ₹0
✅ Message: "Free delivery on orders above ₹2000"
```

---

## 🔍 TROUBLESHOOTING

### Issue: "Authentication required"
**Solution:** Make sure to include the JWT token in Authorization header:
```bash
-H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Issue: "No delivery address found"
**Solution:** The test user `customer@test.com` should have an address. If not:
```bash
# Add address via user/address endpoint first
```

### Issue: "Address coordinates not found"
**Solution:** The address needs `lat` and `lng`. The seeded customer address should have coordinates:
- Lat: 17.385
- Lng: 78.4867

### Issue: Backend not running
**Solution:** Start the backend:
```bash
cd backend
PATH="/opt/homebrew/bin:$PATH" npm run dev
```

---

## 🎯 VALIDATION CHECKLIST

Test each endpoint:

- [ ] ✅ `GET /api/delivery-fee-v2/config` - Returns configuration
- [ ] ✅ `POST /api/delivery-fee-v2/estimate` - Works without auth
- [ ] ✅ `GET /api/delivery-fee-v2/calculate` - Calculates for logged-in user
- [ ] ✅ `POST /api/delivery-fee-v2/calculate-for-address` - Calculates for specific address

Test scenarios:
- [ ] ✅ Low order value (< ₹2,000) - Charges delivery fee
- [ ] ✅ High order value (≥ ₹2,000) - FREE delivery
- [ ] ✅ Heavy item (> 10kg) - Adds surcharge
- [ ] ✅ Express delivery - Adds surcharge
- [ ] ✅ Different addresses - Different fees based on distance

---

## 🚀 NEXT STEPS

### 1. Google Maps API (Optional - for production)
Currently using Haversine fallback (works fine). To use Google Maps:

1. Get API key from https://console.cloud.google.com
2. Enable "Distance Matrix API"
3. Add to `/backend/.env`:
   ```
   GOOGLE_MAPS_API_KEY=your_key_here
   ```
4. Restart backend

### 2. Frontend Integration
Update your `CartPage.tsx` and `CheckoutPage.tsx` to call:
```
GET /api/delivery-fee-v2/calculate?orderAmount=${cart.total}
```

### 3. Customize Configuration
Edit `/backend/src/config/deliveryFeeConfig.ts` to:
- Adjust pricing tiers
- Add/remove warehouses
- Modify surcharge rules
- Change free delivery threshold

---

## 📝 QUICK COPY-PASTE COMMANDS

```bash
# 1. Login
curl -X POST http://localhost:5002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@test.com","password":"customer123"}'

# 2. Save token (replace XXX with actual token)
TOKEN="XXX"

# 3. Calculate delivery fee
curl -X GET "http://localhost:5002/api/delivery-fee-v2/calculate?orderAmount=1500" \
  -H "Authorization: Bearer $TOKEN"

# 4. Test free delivery
curl -X GET "http://localhost:5002/api/delivery-fee-v2/calculate?orderAmount=2500" \
  -H "Authorization: Bearer $TOKEN"

# 5. Test guest estimate
curl -X POST http://localhost:5002/api/delivery-fee-v2/estimate \
  -H "Content-Type: application/json" \
  -d '{"pincode":"500001","orderAmount":1500}'

# 6. Get configuration
curl -X GET http://localhost:5002/api/delivery-fee-v2/config
```

---

## ✅ SUCCESS CRITERIA

Your system is working correctly if:

1. ✅ API responds with `"success": true`
2. ✅ Warehouse is automatically selected
3. ✅ Distance is calculated
4. ✅ Delivery fee is calculated based on distance tier
5. ✅ Orders ≥ ₹2,000 show `"total": 0` and `"isFreeDelivery": true`
6. ✅ Surcharges are applied when conditions met
7. ✅ Response includes detailed breakdown

---

**🎉 You're all set! Test your new enterprise-grade delivery fee system now!** 🎉

**Backend is running on:** `http://localhost:5002`
**New API endpoint:** `/api/delivery-fee-v2/*`
**Test user:** `customer@test.com` / `customer123`
