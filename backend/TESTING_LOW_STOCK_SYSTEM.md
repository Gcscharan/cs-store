# Low Stock Notification System - Testing Guide

## 🎯 Purpose
This guide helps you verify that the Low Stock Notification System works correctly end-to-end before building the UI.

## ⚠️ Critical Areas to Test
- Real-time Socket.io broadcasting
- Event-driven triggers (orders + product updates)
- Deduplication logic
- Multi-service integration
- Priority assignment (LOW vs CRITICAL)

---

## 🔧 Setup

### 1. Start the Backend Server
```bash
cd backend
npm run dev
```

### 2. Verify Services Running
Check logs for:
```
✅ MongoDB connected
✅ Socket.io initialized
🔔 Initializing notification service...
✅ Notification service initialized with Socket.io integration
```

### 3. Get Admin JWT Token
Login as admin and copy the JWT token from response or localStorage.

---

## 🧪 Test Flow 1: Basic Stock Trigger (MOST IMPORTANT)

### Setup
1. Create or find a test product
2. Set stock to 12 units

### Test: Product Update Triggers Notification
```bash
# Update product stock to 9 (below threshold of 10)
curl -X PUT http://localhost:5001/api/admin/products/{PRODUCT_ID} \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stock": 9
  }'
```

### ✅ Expected Results:
1. **Backend logs show:**
   ```
   [StockMonitorService] Evaluating stock level
   [NotificationService] Notification created
   [LowStockSocketService] Low stock alert broadcasted to admin_room
   ```

2. **Database check:**
   ```bash
   # Connect to MongoDB
   mongosh vyaparsetu
   
   # Check notification was created
   db.lowstocknotifications.find().pretty()
   ```
   
   Should show:
   ```json
   {
     "_id": "...",
     "type": "LOW_STOCK",
     "productId": "...",
     "productName": "...",
     "currentStock": 9,
     "priority": "LOW",
     "message": "Low stock: ... has only 9 left",
     "isRead": false,
     "createdAt": "..."
   }
   ```

3. **API check:**
   ```bash
   # Get notifications via API
   curl http://localhost:5001/api/admin/notifications \
     -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
   ```
   
   Should return the notification in JSON format.

4. **Socket.io check:** (See Socket Test section below)

---

## 🧪 Test Flow 2: Duplicate Prevention

### Test: No Duplicate Notifications
```bash
# Update same product stock to 8 (still below threshold)
curl -X PUT http://localhost:5001/api/admin/products/{PRODUCT_ID} \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stock": 8
  }'
```

### ✅ Expected Results:
1. **Backend logs show:**
   ```
   [StockMonitorService] Evaluating stock level
   [StockMonitorService] Unread notification exists - skipping creation
   ```

2. **Database check:**
   ```bash
   # Count notifications for this product
   db.lowstocknotifications.countDocuments({ 
     productId: ObjectId("YOUR_PRODUCT_ID"),
     isRead: false 
   })
   ```
   
   Should return: `1` (not 2!)

3. **API check:**
   ```bash
   curl http://localhost:5001/api/admin/notifications \
     -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
   ```
   
   Should still show only ONE notification for this product.

---

## 🧪 Test Flow 3: Critical Alert

### Test: CRITICAL Priority for Stock < 3
```bash
# Update product stock to 2 (below critical threshold of 3)
curl -X PUT http://localhost:5001/api/admin/products/{PRODUCT_ID} \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stock": 2
  }'
```

### ✅ Expected Results:
1. **Backend logs show:**
   ```
   [StockMonitorService] Evaluating stock level
   [NotificationService] Notification created with CRITICAL priority
   ```

2. **Database check:**
   ```bash
   db.lowstocknotifications.findOne({ 
     productId: ObjectId("YOUR_PRODUCT_ID"),
     priority: "CRITICAL"
   })
   ```
   
   Should show:
   ```json
   {
     "priority": "CRITICAL",
     "currentStock": 2,
     "message": "🚨 CRITICAL: ... has only 2 left"
   }
   ```

---

## 🧪 Test Flow 4: Stock Recovery Logic

### Test: New Notification After Recovery
```bash
# Step 1: Mark existing notification as read
curl -X PATCH http://localhost:5001/api/admin/notifications/{NOTIFICATION_ID}/read \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"

# Step 2: Increase stock above threshold
curl -X PUT http://localhost:5001/api/admin/products/{PRODUCT_ID} \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stock": 20
  }'

# Step 3: Reduce stock below threshold again
curl -X PUT http://localhost:5001/api/admin/products/{PRODUCT_ID} \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stock": 9
  }'
```

### ✅ Expected Results:
1. **After Step 3, backend logs show:**
   ```
   [StockMonitorService] Evaluating stock level
   [NotificationService] Notification created (new one)
   ```

2. **Database check:**
   ```bash
   db.lowstocknotifications.find({ 
     productId: ObjectId("YOUR_PRODUCT_ID")
   }).count()
   ```
   
   Should return: `2` (old one marked as read, new one created)

---

## 🧪 Test Flow 5: Order Placement Trigger

### Test: Order Reduces Stock Below Threshold
```bash
# Create an order that reduces stock below threshold
# Assuming product has stock = 12

curl -X POST http://localhost:5001/api/orders \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "YOUR_PRODUCT_ID",
        "quantity": 4
      }
    ],
    "paymentMethod": "cod",
    "address": { ... }
  }'
```

### ✅ Expected Results:
1. **Backend logs show:**
   ```
   [OrderBuilder] Order created
   [StockMonitorService] Evaluating stock level for order item
   [NotificationService] Notification created
   ```

2. **Product stock updated:**
   ```bash
   db.products.findOne({ _id: ObjectId("YOUR_PRODUCT_ID") })
   ```
   
   Should show: `stock: 8` (12 - 4 = 8)

3. **Notification created:**
   ```bash
   db.lowstocknotifications.findOne({ 
     productId: ObjectId("YOUR_PRODUCT_ID")
   })
   ```
   
   Should exist with `currentStock: 8`

---

## 🧪 Test Flow 6: Socket.io Real-Time Broadcasting

### Setup: Socket.io Test Client

Create a test file: `backend/test-socket-client.js`

```javascript
const io = require('socket.io-client');

// Replace with your admin JWT token
const ADMIN_TOKEN = 'YOUR_ADMIN_JWT_TOKEN_HERE';

const socket = io('http://localhost:5001', {
  auth: {
    token: ADMIN_TOKEN
  }
});

socket.on('connect', () => {
  console.log('✅ Connected to Socket.io server');
  console.log('Socket ID:', socket.id);
  
  // Join admin room
  socket.emit('join_room', { room: 'admin_room' });
  console.log('📡 Joined admin_room');
});

socket.on('low_stock_alert', (data) => {
  console.log('\n🔔 LOW STOCK ALERT RECEIVED:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Product:', data.notification.productName);
  console.log('Stock:', data.notification.currentStock);
  console.log('Priority:', data.notification.priority);
  console.log('Message:', data.notification.message);
  console.log('Created:', data.notification.createdAt);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from Socket.io server');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

console.log('🔌 Connecting to Socket.io server...');
console.log('Listening for low_stock_alert events...\n');
```

### Run Socket Test:
```bash
# Terminal 1: Run socket client
node backend/test-socket-client.js

# Terminal 2: Trigger stock update
curl -X PUT http://localhost:5001/api/admin/products/{PRODUCT_ID} \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stock": 9}'
```

### ✅ Expected Results:
Terminal 1 should show:
```
✅ Connected to Socket.io server
📡 Joined admin_room

🔔 LOW STOCK ALERT RECEIVED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Product: Test Product
Stock: 9
Priority: LOW
Message: Low stock: Test Product has only 9 left
Created: 2024-01-15T10:30:00.000Z
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🐛 Common Issues & Debugging

### Issue 1: Notification Not Created
**Check:**
```bash
# 1. Is stock monitoring service imported?
grep -r "stockMonitorService" backend/src/domains/catalog/controllers/productController.ts

# 2. Check backend logs for errors
tail -f backend/logs/error.log

# 3. Verify product exists
db.products.findOne({ _id: ObjectId("YOUR_PRODUCT_ID") })
```

### Issue 2: Socket Not Firing
**Check:**
```bash
# 1. Is Socket.io initialized?
grep "Socket.io initialized" backend/logs/combined.log

# 2. Is notification service initialized with app?
grep "Notification service initialized" backend/logs/combined.log

# 3. Check Socket.io connection
# Run test-socket-client.js and look for connection errors
```

### Issue 3: Duplicate Notifications
**Check:**
```bash
# 1. Verify duplicate prevention logic
db.lowstocknotifications.find({ 
  productId: ObjectId("YOUR_PRODUCT_ID"),
  isRead: false 
}).count()

# Should be 1, not more

# 2. Check backend logs
grep "duplicate prevention" backend/logs/combined.log
```

### Issue 4: Wrong Priority
**Check:**
```bash
# 1. Verify thresholds in environment
cat backend/.env | grep THRESHOLD

# Should show:
# STOCK_THRESHOLD=10
# CRITICAL_THRESHOLD=3

# 2. Check stock level
db.products.findOne({ _id: ObjectId("YOUR_PRODUCT_ID") }, { stock: 1 })

# 3. Verify priority logic
# stock < 3 → CRITICAL
# stock >= 3 and < 10 → LOW
# stock >= 10 → No notification
```

---

## ✅ Success Checklist

Before moving to Phase 2 (Admin UI), verify:

- [ ] **Test 1:** Product update triggers notification ✅
- [ ] **Test 2:** Duplicate prevention works ✅
- [ ] **Test 3:** CRITICAL priority for stock < 3 ✅
- [ ] **Test 4:** New notification after recovery ✅
- [ ] **Test 5:** Order placement triggers notification ✅
- [ ] **Test 6:** Socket.io broadcasts in real-time ✅
- [ ] **Database:** Notifications saved correctly ✅
- [ ] **API:** GET /admin/notifications returns data ✅
- [ ] **Logs:** No errors in backend logs ✅

---

## 📊 Test Results Template

Copy this and fill in your results:

```
# Low Stock Notification System - Test Results

Date: ___________
Tester: ___________

## Test 1: Basic Stock Trigger
- Product update triggers notification: [ ] PASS [ ] FAIL
- Backend logs correct: [ ] PASS [ ] FAIL
- Database entry created: [ ] PASS [ ] FAIL
- API returns notification: [ ] PASS [ ] FAIL
- Notes: ___________

## Test 2: Duplicate Prevention
- No duplicate notification: [ ] PASS [ ] FAIL
- Only one unread exists: [ ] PASS [ ] FAIL
- Notes: ___________

## Test 3: Critical Alert
- Priority = CRITICAL: [ ] PASS [ ] FAIL
- Message has 🚨 emoji: [ ] PASS [ ] FAIL
- Notes: ___________

## Test 4: Stock Recovery
- New notification after recovery: [ ] PASS [ ] FAIL
- Old notification marked as read: [ ] PASS [ ] FAIL
- Notes: ___________

## Test 5: Order Trigger
- Order reduces stock: [ ] PASS [ ] FAIL
- Notification created: [ ] PASS [ ] FAIL
- Notes: ___________

## Test 6: Socket.io
- Socket connects: [ ] PASS [ ] FAIL
- Event received in real-time: [ ] PASS [ ] FAIL
- Payload correct: [ ] PASS [ ] FAIL
- Notes: ___________

## Overall Status
- [ ] ALL TESTS PASSED - Ready for Phase 2
- [ ] SOME TESTS FAILED - See notes below

## Issues Found:
1. ___________
2. ___________
3. ___________
```

---

## 🚀 Next Steps

After all tests pass, report:
**"backend tested"**

Then we'll build the admin UI with:
- Bell icon with unread count
- Dropdown notification list
- Real-time Socket.io updates
- Click to navigate to product
- Mark as read functionality
- Critical alert highlighting
- Amazon-style clean UI

---

## 💡 Pro Tips

1. **Use MongoDB Compass** for easier database inspection
2. **Keep backend logs open** in a separate terminal
3. **Test with multiple products** to verify isolation
4. **Test concurrent updates** to verify race conditions
5. **Monitor network tab** in browser DevTools for API calls
6. **Use Postman** for easier API testing with saved requests

---

## 🆘 Need Help?

If tests fail:
1. Check backend logs first
2. Verify environment variables
3. Ensure MongoDB is running
4. Confirm Socket.io is initialized
5. Check product exists in database
6. Verify admin JWT token is valid

Good luck! 🎯
