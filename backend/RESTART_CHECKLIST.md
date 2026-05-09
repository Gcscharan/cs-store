# Backend Restart Checklist

## ✅ Pre-Restart Verification

### 1. MongoDB Replica Set Status
```bash
mongosh --quiet --eval "rs.status().members[0].stateStr"
```
**Expected**: `PRIMARY`

### 2. Code Changes Applied
- ✅ Order schema: `vpa` is optional
- ✅ Controller: UPI VPA validation removed
- ✅ OrderBuilder: Only sets VPA if provided
- ✅ Debug logging added

## 🔥 Restart Procedure

### Step 1: Stop All Processes
```bash
# In all terminals running backend/frontend:
Ctrl + C
```

### Step 2: Clear Cache (Optional but Recommended)
```bash
cd backend
rm -rf dist node_modules/.cache
```

### Step 3: Restart Backend
```bash
cd backend
npm run dev
```

**Wait for**:
```
✅ Server running on port 5002
✅ MongoDB connected
```

### Step 4: Verify Logs
Look for these debug logs when testing:
```
🔥 CREATE ORDER BODY: { paymentMethod: 'upi', idempotencyKey: '...' }
🔥 PAYMENT METHOD: upi
🔥 USER ID: 69cb600be362aea587ec9eb3
🔥 UPI VPA: undefined
```

## ✅ Expected Test Results

### Success Case
```
POST /api/orders
  ↓
201 CREATED
{
  "order": {
    "_id": "...",
    "razorpayOrderId": "order_...",
    "upi": {
      "amount": 58.18
    }
  }
}
```

### If Still Failing
Check backend console for:
```
🚨 FULL ERROR: [error object]
🚨 ERROR MESSAGE: [actual error]
🚨 ERROR STACK: [stack trace]
```

## 🧪 Quick Test

After restart, test order creation:
```bash
# Get auth token first
TOKEN="your_jwt_token"

# Test order creation
curl -X POST http://localhost:5002/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"paymentMethod":"upi","idempotencyKey":"test_123"}'
```

**Expected**: 201 CREATED with razorpayOrderId

## 🚨 Troubleshooting

### Issue: MongoDB Connection Error
```bash
# Check MongoDB is running
ps aux | grep mongod

# Check replica set
mongosh --eval "rs.status()"
```

### Issue: Port Already in Use
```bash
# Find process on port 5002
lsof -ti:5002

# Kill it
kill -9 $(lsof -ti:5002)
```

### Issue: Still Getting 500 Error
1. Check backend console for `🚨 FULL ERROR` logs
2. Verify all code changes are saved
3. Check if TypeScript compiled successfully
4. Look for `dist/` folder - should have latest changes

## ✅ Success Indicators

After restart, you should see:
1. ✅ No compilation errors
2. ✅ MongoDB connected
3. ✅ Server listening on port 5002
4. ✅ Debug logs appear when testing
5. ✅ Order creation returns 201 (not 500)

## 🎯 Final Verification

Test the complete flow:
1. Open mobile app
2. Add item to cart
3. Go to checkout
4. Select PhonePe
5. Tap "Pay"

**Expected**:
- ✅ Order created (201)
- ✅ Razorpay opens
- ✅ PhonePe opens
- ✅ Payment completes
- ✅ Order confirmed

---

**All fixes are applied. Just restart and test!** 🚀
