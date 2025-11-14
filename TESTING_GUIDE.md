# Delivery System Testing Guide

## 🎯 Quick Start Testing

This guide will help you test the new delivery boy management features.

---

## 📋 Prerequisites

✅ Backend running on `http://localhost:5001`
✅ Google Maps API key configured
✅ MongoDB connected
✅ At least one delivery boy in the system
✅ At least one order in the system

---

## 🧪 Test 1: Smart Order Assignment

### **Automatic Assignment (Route-Based)**

```bash
# Get an order ID from your database
# Replace ORDER_ID with actual order ID
# Replace YOUR_TOKEN with admin/user JWT token

curl -X POST http://localhost:5001/api/orders/ORDER_ID/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Delivery boy assigned successfully",
  "order": {
    "_id": "order_id",
    "deliveryBoyId": "delivery_boy_id",
    "deliveryBoyName": "John Doe",
    "orderStatus": "assigned"
  }
}
```

**What to Check:**
- ✅ Order status changed to "assigned"
- ✅ Delivery boy assigned based on route proximity or nearest distance
- ✅ Console logs show assignment reason (route_match or nearest_available)

---

### **Manual Assignment**

```bash
curl -X POST http://localhost:5001/api/orders/ORDER_ID/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "deliveryBoyId": "DELIVERY_BOY_ID"
  }'
```

**What to Check:**
- ✅ Specific delivery boy assigned
- ✅ Route polyline generated and stored
- ✅ Delivery boy's activeRoute field updated

---

### **Preview Optimal Assignment**

```bash
curl -X GET http://localhost:5001/api/orders/ORDER_ID/optimal-delivery-boy \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "deliveryBoy": {
    "_id": "delivery_boy_id",
    "name": "John Doe",
    "phone": "1234567890",
    "vehicleType": "bike",
    "currentLocation": {
      "lat": 17.385,
      "lng": 78.4867
    },
    "assignedOrdersCount": 1
  },
  "assignmentReason": "route_match",
  "distance": 1.5,
  "estimatedDuration": 300
}
```

**What to Check:**
- ✅ Returns optimal delivery boy without assigning
- ✅ Shows assignment reason (route_match or nearest_available)
- ✅ Displays distance and estimated duration

---

## 🧪 Test 2: Location Updates

### **Update Delivery Boy Location (REST API)**

```bash
curl -X PUT http://localhost:5001/api/delivery-personnel/DELIVERY_BOY_ID/location \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 17.385,
    "lng": 78.4867
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Location updated successfully",
  "location": {
    "lat": 17.385,
    "lng": 78.4867,
    "lastUpdatedAt": "2025-11-02T10:30:00.000Z"
  }
}
```

**What to Check:**
- ✅ Location updated in database
- ✅ Response includes timestamp
- ✅ Coordinates stored correctly

---

### **Update Location via Socket.io**

**From Delivery Boy App (JavaScript):**

```javascript
// Connect to socket
const socket = io("http://localhost:5001");

// Send location update
socket.emit("driver_location_update", {
  driverId: "DELIVERY_BOY_ID",
  lat: 17.385,
  lng: 78.4867
});

// Listen for broadcast
socket.on("driver:location:update", (data) => {
  console.log("Location update received:", data);
  console.log("Smooth path:", data.smoothPath);
  console.log("Active route:", data.activeRoute);
  console.log("Speed:", data.speed, "km/h");
  console.log("Heading:", data.heading, "degrees");
  console.log("ETA:", data.eta);
});
```

**What to Check:**
- ✅ Location smoothing applied (Kalman filter)
- ✅ Throttling works (broadcasts every 3 seconds max)
- ✅ Smooth path array contains 10 interpolated points
- ✅ Active route polyline included (if delivery boy has active route)
- ✅ Speed and heading calculated correctly
- ✅ ETA provided (if destination exists)

---

## 🧪 Test 3: Route Management

### **Get Active Route**

```bash
curl -X GET http://localhost:5001/api/delivery-personnel/DELIVERY_BOY_ID/route
```

**Expected Response (with active route):**
```json
{
  "success": true,
  "route": {
    "polyline": "encoded_polyline_string",
    "destination": {
      "lat": 17.385,
      "lng": 78.4867
    },
    "currentLocation": {
      "lat": 17.380,
      "lng": 78.480
    },
    "estimatedArrival": "2025-11-02T10:30:00.000Z"
  }
}
```

**Expected Response (no active route):**
```json
{
  "success": false,
  "message": "No active route found"
}
```

**What to Check:**
- ✅ Returns route polyline if delivery boy has active delivery
- ✅ Returns 404 if no active route
- ✅ Includes destination and current location

---

### **Clear Active Route**

```bash
curl -X DELETE http://localhost:5001/api/delivery-personnel/DELIVERY_BOY_ID/route
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Route cleared successfully"
}
```

**What to Check:**
- ✅ Active route removed from delivery boy
- ✅ Delivery boy can be assigned new orders
- ✅ Socket broadcasts no longer include route polyline

---

## 🧪 Test 4: Unassign Delivery Boy

```bash
curl -X DELETE http://localhost:5001/api/orders/ORDER_ID/assign \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Delivery boy unassigned successfully"
}
```

**What to Check:**
- ✅ Order's deliveryBoyId set to undefined
- ✅ Order status changed to "created"
- ✅ Delivery boy's assignedOrders updated
- ✅ Delivery boy's activeRoute cleared
- ✅ Delivery boy availability updated

---

## 🧪 Test 5: Real-Time Tracking Simulation

### **Simulate Delivery Boy Movement**

Create a simple script to simulate GPS updates:

```javascript
const io = require("socket.io-client");
const socket = io("http://localhost:5001");

const deliveryBoyId = "YOUR_DELIVERY_BOY_ID";

// Starting position (Hyderabad example)
let lat = 17.385;
let lng = 78.4867;

// Simulate movement every 5 seconds
setInterval(() => {
  // Move slightly (simulate driving)
  lat += 0.001; // ~111 meters north
  lng += 0.001; // ~111 meters east
  
  console.log(`Sending location: ${lat}, ${lng}`);
  
  socket.emit("driver_location_update", {
    driverId: deliveryBoyId,
    lat: lat,
    lng: lng
  });
}, 5000);

// Listen for broadcasts
socket.on("driver:location:update", (data) => {
  console.log("Broadcast received:");
  console.log("- Speed:", data.speed, "km/h");
  console.log("- Heading:", data.heading, "degrees");
  console.log("- Smooth path points:", data.smoothPath?.length);
  console.log("- Has active route:", !!data.activeRoute);
});
```

**What to Check:**
- ✅ Location updates broadcast every 3 seconds (throttled)
- ✅ Smooth path contains 10 interpolated points
- ✅ Speed calculated correctly (~80 km/h for the above movement)
- ✅ Heading calculated correctly (northeast = ~45 degrees)
- ✅ Database updated every 30 seconds (batch update)

---

## 🧪 Test 6: Route-Based Assignment Logic

### **Test Scenario: Multiple Orders on Same Route**

1. **Create Order 1** at location A (e.g., 17.385, 78.4867)
2. **Assign Delivery Boy** to Order 1
3. **Create Order 2** at location B (e.g., 17.390, 78.490) - within 2km of route
4. **Assign Delivery Boy** to Order 2 (automatic)

**Expected Behavior:**
- ✅ Order 2 assigned to same delivery boy (route match)
- ✅ Console logs show "route_match" as assignment reason
- ✅ Delivery boy's activeRoute updated with new destination

### **Test Scenario: Order Far from Route**

1. **Create Order 1** at location A (e.g., 17.385, 78.4867)
2. **Assign Delivery Boy** to Order 1
3. **Create Order 2** at location C (e.g., 17.500, 78.600) - far from route
4. **Assign Delivery Boy** to Order 2 (automatic)

**Expected Behavior:**
- ✅ Order 2 assigned to different delivery boy (nearest available)
- ✅ Console logs show "nearest_available" as assignment reason
- ✅ New delivery boy gets route polyline

---

## 🧪 Test 7: Performance Testing

### **Check Batch Updates**

Monitor backend console logs for:

```
✅ Batch updated X delivery boy locations
```

**What to Check:**
- ✅ Batch updates occur every 30 seconds
- ✅ Only active delivery boys updated
- ✅ No database errors

### **Check Throttling**

Send rapid location updates (every 1 second) and verify:

**What to Check:**
- ✅ Socket broadcasts limited to every 3 seconds
- ✅ No excessive re-renders on frontend
- ✅ Smooth animation maintained

---

## 🧪 Test 8: Error Handling

### **Test Invalid Order ID**

```bash
curl -X POST http://localhost:5001/api/orders/invalid_id/assign \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
```json
{
  "error": "Order not found"
}
```

### **Test No Available Delivery Boys**

1. Set all delivery boys to unavailable
2. Try to assign order

**Expected Response:**
```json
{
  "error": "No available delivery boys found"
}
```

### **Test Google Maps API Failure**

1. Temporarily set invalid API key in `.env`
2. Try to assign order

**Expected Behavior:**
- ✅ Falls back to straight-line route
- ✅ Console logs warning about API failure
- ✅ Assignment still works (using Haversine distance)

---

## 📊 Monitoring

### **Check Backend Logs**

Look for these log messages:

```
✅ Smart assignment: John Doe (route_match)
✅ Smart assignment: Jane Smith (nearest_available)
✅ Batch updated 5 delivery boy locations
⚠️ Google Maps API error, using fallback route
```

### **Check Database**

Verify in MongoDB:

```javascript
// Check delivery boy's active route
db.deliveryboys.findOne({ _id: ObjectId("...") })

// Should have activeRoute field:
{
  activeRoute: {
    polyline: "encoded_string",
    destination: { lat: 17.385, lng: 78.4867 },
    orderId: ObjectId("..."),
    startedAt: ISODate("..."),
    estimatedArrival: ISODate("...")
  }
}
```

---

## ✅ Success Criteria

All tests pass if:

- ✅ Orders assigned automatically based on route proximity
- ✅ Location updates smooth and throttled
- ✅ Route polylines generated and stored
- ✅ Socket broadcasts include all required data
- ✅ Batch updates reduce database load
- ✅ Fallback mechanisms work when API fails
- ✅ No TypeScript or runtime errors
- ✅ Frontend receives enhanced location data

---

## 🐛 Troubleshooting

### **Issue: No route polyline in socket broadcasts**

**Solution:**
- Check if delivery boy has active route: `GET /api/delivery-personnel/:id/route`
- Verify order is assigned: Check order's `deliveryBoyId` field
- Check Google Maps API key is valid

### **Issue: Location updates not smooth**

**Solution:**
- Verify throttling is working (3-second intervals)
- Check smooth path array has 10 points
- Ensure frontend uses smooth path for animation

### **Issue: Wrong delivery boy assigned**

**Solution:**
- Check delivery boy availability status
- Verify route corridor threshold (2km default)
- Check console logs for assignment reason
- Verify Google Maps API is working

### **Issue: Database overload**

**Solution:**
- Verify batch updates are working (every 30 seconds)
- Check throttling prevents excessive socket broadcasts
- Monitor database write operations

---

## 🎉 Next Steps

After successful testing:

1. **Frontend Integration** - Update map components to use new data
2. **Production Deployment** - Deploy with proper API key restrictions
3. **Monitoring** - Set up logging and analytics
4. **Optimization** - Tune throttle/batch intervals based on load
5. **Feature Enhancements** - Add multi-stop optimization, traffic data, etc.

---

**Happy Testing! 🚀**

