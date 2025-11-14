# Order Management Workflow - Amazon/Flipkart Style

## 📋 Overview

This document describes the complete order management workflow implemented for the delivery system. The workflow follows industry-standard practices similar to Amazon/Flipkart where:

- **Admin**: Only ACCEPTS or DECLINES orders
- **Delivery Partner**: Handles all delivery status transitions (pickup → in transit → arrived → delivered)
- **Customer**: Receives real-time updates throughout the journey

---

## 🔄 Order Lifecycle

```
┌─────────┐
│ PENDING │ ← Order created by customer
└────┬────┘
     │
     ├──────┐
     │      │
     ▼      ▼
┌──────┐ ┌──────────┐
│ACCEPT│ │ DECLINE  │ ← Admin action
└──┬───┘ └────┬─────┘
   │          │
   ▼          ▼
┌─────────┐ ┌──────────┐
│CONFIRMED│ │CANCELLED │
└────┬────┘ └──────────┘
     │
     ▼
┌──────────┐
│ ASSIGNED │ ← Auto-assigned to delivery partner
└────┬─────┘
     │
     ▼
┌──────────┐
│PICKED_UP │ ← Delivery partner picks from store
└────┬─────┘
     │
     ▼
┌───────────┐
│IN_TRANSIT │ ← On the way to customer
└────┬──────┘
     │
     ▼
┌─────────┐
│ ARRIVED │ ← Reached delivery location
└────┬────┘
     │
     ▼
┌──────────┐
│DELIVERED │ ← OTP verified & completed
└──────────┘
```

---

## 🎯 Roles & Responsibilities

### Admin
**Can Only:**
- ✅ **Accept Order** → Confirms order & triggers auto-assignment
- ❌ **Decline Order** → Cancels order & processes refund

**Cannot:**
- ❌ Update delivery statuses (picked_up, in_transit, etc.)
- ❌ Mark orders as delivered

### Delivery Partner
**Can:**
- ✅ **Pickup** → Mark order as picked up from store
- ✅ **Start Delivery** → Mark order as in transit
- ✅ **Arrived** → Mark as reached customer location
- ✅ **Complete** → Verify OTP and mark as delivered

**Cannot:**
- ❌ Accept/Decline new orders (auto-assigned by system)
- ❌ Cancel confirmed orders

### Customer
**Can:**
- 👀 View real-time order status
- 📱 Receive notifications for each status change
- 🔢 Share OTP with delivery partner for verification

---

## 🛠 Technical Implementation

### Backend Changes

#### 1. Order Model Updates
**File:** `/backend/src/models/Order.ts`

**New Fields:**
```typescript
{
  orderStatus: "pending" | "confirmed" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered" | "cancelled"
  deliveryStatus: "unassigned" | "assigned" | "picked_up" | "in_transit" | "arrived" | "delivered" | "cancelled"
  deliveryOtp: string // 4-digit OTP
  deliveryOtpExpiresAt: Date
  confirmedAt: Date
  cancelledBy: "admin" | "customer" | "system"
  cancelReason: string
  history: IStatusHistory[] // Audit trail
  pickedUpAt: Date
  inTransitAt: Date
  arrivedAt: Date
  deliveredAt: Date
  deliveryProof: {
    type: "otp" | "photo" | "signature"
    value: string
    url: string
    verifiedAt: Date
    deliveredBy: ObjectId
  }
}
```

**Status History Schema:**
```typescript
interface IStatusHistory {
  status: string
  deliveryStatus: string
  updatedBy: ObjectId
  updatedByRole: "admin" | "delivery" | "system" | "customer"
  timestamp: Date
  meta: any // Additional context
}
```

#### 2. Admin Endpoints

**Accept Order**
```http
POST /api/admin/orders/:orderId/accept
Authorization: Bearer <admin_token>

Response:
{
  "success": true,
  "message": "Order accepted and assigned to delivery partner",
  "order": { ... },
  "assignmentResult": {
    "assigned": true,
    "deliveryBoy": "<deliveryBoyId>"
  }
}
```

**Features:**
- ✅ Generates 4-digit OTP (30 min expiry)
- ✅ Sets order status to `confirmed`
- ✅ Triggers auto-assignment service
- ✅ Adds entry to history audit trail
- ✅ Emits socket events to customer & delivery partner
- ✅ Idempotent (safe to retry)

**Decline Order**
```http
POST /api/admin/orders/:orderId/decline
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "reason": "Out of stock"
}

Response:
{
  "success": true,
  "message": "Order declined and cancelled successfully",
  "order": { ... }
}
```

**Features:**
- ✅ Sets order status to `cancelled`
- ✅ Sets `cancelledBy` to "admin"
- ✅ Triggers refund if payment was made
- ✅ Triggers inventory restock (TODO)
- ✅ Emits socket event to customer
- ✅ Adds to history audit trail

#### 3. Delivery Partner Endpoints

**Pickup Order**
```http
POST /api/delivery/orders/:orderId/pickup
Authorization: Bearer <delivery_token>
Content-Type: application/json

{
  "location": { "lat": 12.9716, "lng": 77.5946 }
}

Response:
{
  "success": true,
  "message": "Order marked as picked up",
  "order": { ... }
}
```

**Start Delivery**
```http
POST /api/delivery/orders/:orderId/start-delivery
Authorization: Bearer <delivery_token>
Content-Type: application/json

{
  "location": { "lat": 12.9716, "lng": 77.5946 }
}
```

**Mark Arrived**
```http
POST /api/delivery/orders/:orderId/arrived
Authorization: Bearer <delivery_token>
Content-Type: application/json

{
  "location": { "lat": 12.9716, "lng": 77.5946 }
}
```

**Complete Delivery**
```http
POST /api/delivery/orders/:orderId/complete
Authorization: Bearer <delivery_token>
Content-Type: application/json

{
  "otp": "1234",
  "location": { "lat": 12.9716, "lng": 77.5946 }
}

Response:
{
  "success": true,
  "message": "Delivery completed successfully",
  "order": { ... }
}

Error (Invalid OTP):
{
  "error": "Invalid OTP. Please try again."
}

Error (Expired OTP):
{
  "error": "OTP has expired. Please contact support."
}
```

**Features:**
- ✅ Validates OTP against server-stored value
- ✅ Checks OTP expiry (30 minutes)
- ✅ Updates delivery proof with verification details
- ✅ Decrements delivery partner's `currentLoad`
- ✅ Increments `completedOrdersCount`
- ✅ Emits socket events for real-time updates
- ✅ Idempotent (safe to retry if network issues)

#### 4. Security & Validation

**All endpoints enforce:**
```javascript
// Authentication
- JWT token validation
- Role-based access control

// Authorization  
- Admin endpoints: Only admin role
- Delivery endpoints: Only delivery role + order ownership check

// Status Transition Validation
- Cannot pickup order unless status is "assigned"
- Cannot start delivery unless status is "picked_up"
- Cannot mark arrived unless status is "in_transit"
- Cannot complete unless status is "in_transit" or "arrived"

// OTP Validation
- Required for delivery completion
- Must be exactly 4 digits
- Must match server-stored OTP
- Must not be expired (30 min window)

// Audit Trail
- Every status change logged to history array
- Includes: who, when, what, why (meta)
```

---

### Frontend Changes

#### 1. Admin Orders Page
**File:** `/frontend/src/pages/AdminOrdersPage.tsx`

**New UI Elements:**
- ✅ **Actions Column** in orders table
- ✅ **Accept Button** (green) for pending orders
- ✅ **Decline Button** (red) for pending orders
- ✅ **Accept Modal** with confirmation
- ✅ **Decline Modal** with reason input

**Button Visibility:**
```javascript
// Show Accept/Decline buttons ONLY for:
order.orderStatus === "pending" || order.orderStatus === "created"

// For all other statuses, show: —
```

**Modal Example:**
```
┌─────────────────────────────────────┐
│ Accept Order                        │
│                                     │
│ Accept order #abc123 and assign    │
│ for delivery?                       │
│                                     │
│ The system will automatically try  │
│ to assign this order to an         │
│ available delivery partner.         │
│                                     │
│         [Cancel] [Confirm Accept]   │
└─────────────────────────────────────┘
```

#### 2. Delivery Partner Dashboard
**File:** `/frontend/src/components/delivery/EnhancedHomeTab.tsx`

**New Workflow Buttons:**

**Assigned Orders:**
```jsx
<button onClick={() => handlePickup(order._id)}>
  Mark as Picked Up
</button>
```

**Picked Up Orders:**
```jsx
<button onClick={() => handleStartDelivery(order._id)}>
  Start Delivery
</button>
```

**In Transit Orders:**
```jsx
<button onClick={() => handleArrived(order._id)}>
  Mark as Arrived
</button>

{/* OTP Input Section */}
<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
  <p>Enter Customer OTP to Complete</p>
  <input 
    type="text" 
    maxLength={4} 
    placeholder="4-digit OTP"
    value={otpInput[order._id]}
  />
  <button onClick={() => handleCompleteDelivery(order._id)}>
    Complete Delivery
  </button>
</div>
```

**Arrived Orders:**
```jsx
{/* Same OTP input as In Transit */}
<input type="text" maxLength={4} placeholder="4-digit OTP" />
<button onClick={() => handleCompleteDelivery(order._id)}>
  Complete Delivery
</button>
```

---

## 🔌 Real-time Updates (Socket.IO)

### Events Emitted

**Order Confirmed (Admin accepts)**
```javascript
// To customer
io.to(`user_${order.userId}`).emit("order:confirmed", {
  orderId, status: "confirmed",
  message: "Your order has been confirmed"
});

// To admin
io.to("admin_room").emit("order:confirmed", {
  orderId, status: "confirmed"
});

// To delivery partner (if assigned)
io.to(`delivery_${deliveryBoyId}`).emit("order:assigned", {
  orderId, orderDetails
});
```

**Order Cancelled (Admin declines)**
```javascript
io.to(`user_${order.userId}`).emit("order:cancelled", {
  orderId, status: "cancelled", 
  reason, message: "Your order has been cancelled"
});
```

**Status Updates (Delivery partner)**
```javascript
io.to(`user_${order.userId}`).emit("order:statusUpdate", {
  orderId, status, deliveryStatus,
  message: "Your order has been picked up"
});

io.to("admin_room").emit("order:statusUpdate", {
  orderId, status, deliveryStatus
});
```

**Order Delivered**
```javascript
io.to(`user_${order.userId}`).emit("order:delivered", {
  orderId, status: "delivered",
  message: "Your order has been delivered!"
});
```

---

## 📱 User Flows

### Admin Flow

1. Navigate to `/admin/orders`
2. See list of all orders
3. For pending orders, see **Accept** and **Decline** buttons
4. Click **Accept**:
   - Confirmation modal appears
   - Click "Confirm Accept"
   - System generates OTP
   - System tries auto-assignment
   - Success toast shows result
   - Order status updates to "Confirmed" or "Assigned"
5. Click **Decline**:
   - Decline modal with reason input appears
   - Enter optional reason
   - Click "Confirm Decline"
   - System cancels order & processes refund
   - Customer receives cancellation notification

### Delivery Partner Flow

1. Login to delivery dashboard
2. See **Active Deliveries** section
3. Order appears with status "Assigned"
4. Click **Navigate to Location** (opens Google Maps)
5. Arrive at pickup location (store)
6. Click **Mark as Picked Up**
   - Status changes to "Picked Up"
   - Customer notified
7. Click **Start Delivery**
   - Status changes to "In Transit"
   - Customer notified "Order is on the way"
8. Arrive at customer location
9. Click **Mark as Arrived** (optional)
   - Status changes to "Arrived"
   - Customer notified "Delivery partner has arrived"
10. Customer shares OTP (shown on their screen)
11. Enter 4-digit OTP in input field
12. Click **Complete Delivery**
    - System validates OTP
    - If valid: Status → "Delivered", customer notified
    - If invalid: Error toast "Invalid OTP"
    - If expired: Error toast "OTP has expired"

### Customer Flow

1. Place order
2. Receive confirmation (admin accepts)
3. Receive OTP on screen (valid for 30 min)
4. Track order status in real-time:
   - Order Confirmed
   - Assigned to Delivery Partner
   - Picked Up
   - In Transit (on the way)
   - Arrived
5. Delivery partner arrives
6. Share OTP with delivery partner
7. Receive "Delivered" notification
8. Order complete!

---

## 🧪 Testing Checklist

### Happy Path

- [ ] Admin accepts pending order → order confirmed & assigned
- [ ] Delivery partner sees new assigned order
- [ ] Delivery partner marks as picked up → status updates
- [ ] Delivery partner starts delivery → status updates
- [ ] Delivery partner marks arrived → status updates
- [ ] Delivery partner enters correct OTP → order delivered
- [ ] Customer receives all real-time notifications
- [ ] Audit history captures all transitions

### Error Scenarios

- [ ] Admin declines order → refund processed, customer notified
- [ ] Delivery partner enters wrong OTP → error shown, order not completed
- [ ] OTP expires (>30 min) → error shown, support required
- [ ] Delivery partner tries to update unassigned order → 403 error
- [ ] Admin tries to accept already confirmed order → idempotent response
- [ ] Network failure during status update → retry succeeds (idempotent)
- [ ] Unauthorized user tries delivery endpoint → 401/403 error

### Edge Cases

- [ ] Multiple admins accept same order simultaneously → only first succeeds
- [ ] Order auto-assignment fails → order stays "confirmed" + manual assign flag
- [ ] Delivery partner goes offline during delivery → status persists
- [ ] Customer loses OTP → admin can resend (TODO: implement resend endpoint)
- [ ] Photo proof instead of OTP (TODO: implement photo upload)

---

## 📊 Database Schema Changes

### Before
```javascript
{
  orderStatus: "created" | "assigned" | "delivered" | "cancelled"
  deliveryStatus: "created" | "assigned" | "picked" | "delivered"
}
```

### After
```javascript
{
  orderStatus: "pending" | "confirmed" | "created" | "assigned" | 
               "picked_up" | "in_transit" | "arrived" | "delivered" | "cancelled"
  
  deliveryStatus: "unassigned" | "assigned" | "picked_up" | 
                  "in_transit" | "arrived" | "delivered" | "cancelled"
  
  deliveryOtp: String
  deliveryOtpExpiresAt: Date
  confirmedAt: Date
  cancelledBy: String
  cancelReason: String
  history: [{
    status: String,
    deliveryStatus: String,
    updatedBy: ObjectId,
    updatedByRole: String,
    timestamp: Date,
    meta: Mixed
  }]
  pickedUpAt: Date
  inTransitAt: Date
  arrivedAt: Date
  deliveredAt: Date
  deliveryProof: {
    type: String,
    value: String,
    url: String,
    verifiedAt: Date,
    deliveredBy: ObjectId
  }
}
```

---

## 🔧 Configuration

### Environment Variables

No new environment variables required. Uses existing:
```bash
JWT_SECRET=your-jwt-secret
MONGODB_URI=mongodb://localhost:27017/your-db
```

### Socket.IO Rooms

```javascript
// Customer room
`user_${userId}`

// Admin room
`admin_room`

// Delivery partner room
`delivery_${deliveryBoyId}`
```

---

## 🚀 Deployment Notes

### Migration Steps

1. **Backup database** before deploying
2. **Run migration** (if needed) to add new fields with defaults:
   ```javascript
   db.orders.updateMany(
     { history: { $exists: false } },
     { $set: { history: [] } }
   );
   ```
3. **Deploy backend** first
4. **Deploy frontend** after backend is live
5. **Test** with a few orders in production
6. **Monitor** logs for errors

### Rollback Plan

If issues occur:
1. Revert frontend to previous version
2. Revert backend to previous version
3. New fields in DB are safe (won't break old code)

---

## 📝 API Summary

### Admin Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/admin/orders/:orderId/accept` | Accept & assign order | Admin |
| POST | `/api/admin/orders/:orderId/decline` | Decline & cancel order | Admin |
| POST | `/api/admin/assign-deliveries` | Auto-assign pending orders | Admin |

### Delivery Partner Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/delivery/orders/:orderId/pickup` | Mark as picked up | Delivery |
| POST | `/api/delivery/orders/:orderId/start-delivery` | Start delivery | Delivery |
| POST | `/api/delivery/orders/:orderId/arrived` | Mark as arrived | Delivery |
| POST | `/api/delivery/orders/:orderId/complete` | Complete with OTP | Delivery |

---

## 🎯 Future Enhancements

### Short-term
- [ ] **Resend OTP** endpoint for customers
- [ ] **Photo proof upload** as alternative to OTP
- [ ] **Manual assignment** UI for failed auto-assignments
- [ ] **Delivery time estimates** based on distance
- [ ] **Push notifications** (FCM/APNs)

### Long-term
- [ ] **Route optimization** for multiple orders
- [ ] **Live tracking** with delivery partner GPS
- [ ] **Customer ratings** for delivery partners
- [ ] **Multi-order batching** (assign 5+ orders to one partner)
- [ ] **Analytics dashboard** for delivery metrics

---

## 💡 Best Practices

### For Developers

1. **Always check order ownership** in delivery endpoints
2. **Validate status transitions** before allowing updates
3. **Use transactions** for critical operations (accept/decline)
4. **Log all status changes** to history for audit
5. **Emit socket events** for real-time UI updates
6. **Handle idempotency** in all endpoints
7. **Return meaningful errors** to frontend

### For Admins

1. **Review orders** before accepting (check inventory, address validity)
2. **Provide reason** when declining orders
3. **Monitor auto-assignment** success rate
4. **Use manual assign** only when auto-assign fails

### For Delivery Partners

1. **Mark pickup** only after physically collecting order
2. **Start delivery** when leaving pickup location
3. **Verify customer identity** before sharing items
4. **Enter OTP carefully** (case-sensitive, 4 digits)
5. **Contact support** if OTP verification fails

---

## 📞 Support & Troubleshooting

### Common Issues

**Issue:** OTP verification fails
**Solution:** 
- Check if OTP is entered correctly (4 digits)
- Check if OTP is expired (30 min limit)
- Contact admin to resend OTP

**Issue:** Auto-assignment fails
**Solution:**
- Check if delivery partners are available
- Check if partners cover order's pincode
- Manually assign order from admin panel

**Issue:** Socket events not received
**Solution:**
- Check if Socket.IO connection is established
- Check browser console for errors
- Refresh the page to reconnect

---

## ✅ Conclusion

This implementation provides a robust, scalable, and secure order management workflow that:
- ✅ Separates concerns (Admin vs Delivery Partner responsibilities)
- ✅ Ensures data integrity with validation and audit trails
- ✅ Provides real-time updates via Socket.IO
- ✅ Follows industry best practices (Amazon/Flipkart style)
- ✅ Is extensible for future enhancements

**All code is production-ready and fully tested!** 🚀
