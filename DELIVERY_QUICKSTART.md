# Delivery Boy Feature - Quick Start Guide

## Prerequisites
- Node.js 16+ and npm
- MongoDB running locally or connection URI
- Backend server running on port 5001
- Frontend dev server running on port 3000

## Setup Instructions

### 1. Backend Setup

```bash
cd backend

# Install dependencies (if not already done)
npm install

# Make sure .env file exists with required variables
cp ../env.template ../.env
# Edit .env with your actual values

# Start the backend server
npm run dev
```

Server should start on `http://localhost:5001`

### 2. Frontend Setup

```bash
cd frontend

# Install dependencies (if not already done)
npm install

# Start the frontend dev server
npm run dev
```

Frontend should start on `http://localhost:3000`

## Testing the Delivery Flow

### Step 1: Signup as Delivery Partner

1. Navigate to `http://localhost:3000/delivery/signup`
2. Fill in the registration form:
   - Full Name: Test Driver
   - Email: driver@test.com
   - Phone: 9876543210
   - Vehicle Type: Bike
   - Password: password123
3. Click "Sign Up"
4. You should see: "Account submitted for approval. Admin will activate your account soon."

**Backend Result:**
- New user created with role="delivery" and status="pending"
- New DeliveryBoy record created with isActive=false

### Step 2: Try to Login (Will Fail - Pending Approval)

1. Navigate to `http://localhost:3000/delivery/login`
2. Enter credentials:
   - Email: driver@test.com
   - Password: password123
3. Click "Login"
4. You should see: "Your account is awaiting admin approval"

### Step 3: Admin Approval

#### Option A: Using API

```bash
# Get admin token first (use dev endpoint)
curl http://localhost:5001/api/admin/dev-token

# Use the returned token to approve delivery partner
# Replace {userId} with the actual user ID from signup response
curl -X PUT http://localhost:5001/api/admin/delivery-boys/{userId}/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "assignedAreas": ["500001", "500002", "500003"]
  }'
```

#### Option B: Using Admin UI (To be implemented in Sprint B)

The admin UI will have a "Delivery Boys" section where you can:
- View all pending, active, and suspended delivery partners
- Click "Approve" button
- Assign delivery areas (pincodes)

### Step 4: Login Successfully

1. Go back to `http://localhost:3000/delivery/login`
2. Enter same credentials
3. Click "Login"
4. You should be redirected to `/delivery/dashboard`

### Step 5: Test Order Management

#### Create a Test Order (As Customer)
First, create an order using the regular customer flow or API.

#### Assign Order to Delivery Boy (Manual or Automatic)

**Manual Assignment (via API):**
```bash
curl -X POST http://localhost:5001/api/orders/{orderId}/assign \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "deliveryBoyId": "{deliveryBoyId}"
  }'
```

**Automatic Assignment:**
The smart assignment service will automatically assign based on:
- Delivery boy availability
- Proximity to order location
- Current load

#### Accept Order (As Delivery Boy)

```bash
curl -X POST http://localhost:5001/api/delivery/orders/{orderId}/accept \
  -H "Authorization: Bearer {delivery-token}"
```

**Result:**
- Order status changes to "assigned"
- 4-digit OTP generated for delivery verification
- Real-time notification sent to customer

### Step 6: Update Order Status

```bash
# Mark as picked up
curl -X PUT http://localhost:5001/api/delivery/orders/{orderId}/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {delivery-token}" \
  -d '{"status": "picked_up"}'

# Mark in transit
curl -X PUT http://localhost:5001/api/delivery/orders/{orderId}/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {delivery-token}" \
  -d '{"status": "in_transit"}'
```

### Step 7: Complete Delivery with OTP

```bash
curl -X POST http://localhost:5001/api/delivery/orders/{orderId}/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {delivery-token}" \
  -d '{
    "otp": "1234"
  }'
```

**Note:** The OTP was generated when the order was accepted. In a real scenario, the customer would provide this to the delivery partner.

### Step 8: Toggle Online/Offline Status

```bash
# Go online
curl -X PUT http://localhost:5001/api/delivery/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {delivery-token}" \
  -d '{"isOnline": true}'

# Go offline
curl -X PUT http://localhost:5001/api/delivery/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {delivery-token}" \
  -d '{"isOnline": false}'
```

### Step 9: Update Location (Real-time Tracking)

```bash
curl -X PUT http://localhost:5001/api/delivery/location \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {delivery-token}" \
  -d '{
    "lat": 17.385044,
    "lng": 78.486671
  }'
```

**Socket.io Alternative:**
The frontend dashboard can emit location updates via socket:
```javascript
socket.emit('driver_location_update', {
  driverId: '{deliveryBoyId}',
  lat: 17.385044,
  lng: 78.486671
});
```

### Step 10: Check Earnings

```bash
# Get all time earnings
curl -X GET http://localhost:5001/api/delivery/earnings \
  -H "Authorization: Bearer {delivery-token}"

# Get earnings for specific date range
curl -X GET "http://localhost:5001/api/delivery/earnings?from=2025-01-01&to=2025-01-31" \
  -H "Authorization: Bearer {delivery-token}"
```

## Admin Testing

### List All Delivery Boys

```bash
curl -X GET http://localhost:5001/api/admin/delivery-boys-list \
  -H "Authorization: Bearer {admin-token}"

# Filter by status
curl -X GET "http://localhost:5001/api/admin/delivery-boys-list?status=pending" \
  -H "Authorization: Bearer {admin-token}"

# Filter by area
curl -X GET "http://localhost:5001/api/admin/delivery-boys-list?area=500001" \
  -H "Authorization: Bearer {admin-token}"
```

### Suspend Delivery Boy

```bash
curl -X PUT http://localhost:5001/api/admin/delivery-boys/{userId}/suspend \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "reason": "Policy violation"
  }'
```

## Socket.io Real-time Events

### Connect to Socket Server (Frontend)

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5001');

// Join delivery boy room
socket.emit('join_room', {
  room: `driver_${deliveryBoyId}`,
  userId: userId,
  userRole: 'delivery'
});

// Listen for order assignments
socket.on('order:assigned', (data) => {
  console.log('New order assigned:', data);
  // Show notification to delivery boy
});

// Listen for order status updates
socket.on('order:status:update', (data) => {
  console.log('Order status updated:', data);
});
```

## Troubleshooting

### Issue: "Cannot find module" errors
**Solution:** Run `npm install` in both backend and frontend directories

### Issue: "Port already in use"
**Solution:** Kill existing processes:
```bash
# Kill process on port 5001 (backend)
lsof -ti:5001 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

### Issue: "Authentication required" errors
**Solution:** Make sure you're passing the JWT token in Authorization header:
```
Authorization: Bearer {your-token-here}
```

### Issue: MongoDB connection failed
**Solution:** 
- Make sure MongoDB is running: `mongod`
- Check MONGODB_URI in .env file
- Default: `mongodb://localhost:27017/cs-store`

### Issue: Delivery login returns "Unauthorized"
**Possible causes:**
1. Account not approved (status: pending)
2. Account suspended (status: suspended)
3. Wrong role (not delivery)
4. Invalid credentials

## Next Steps (Sprint B & C)

See `DELIVERY_BOY_FEATURE_DOCUMENTATION.md` for:
- Dashboard enhancement with UI components
- Admin UI for managing delivery partners
- Photo proof-of-delivery
- Google Maps navigation integration
- Push notifications
- Analytics and reporting

## Quick Reference

### Key Endpoints
- Signup: `POST /api/delivery/auth/signup`
- Login: `POST /api/delivery/auth/login`
- Accept Order: `POST /api/delivery/orders/:id/accept`
- Complete: `POST /api/delivery/orders/:id/complete`
- Toggle Status: `PUT /api/delivery/status`

### Default Credentials for Testing
- **Admin**: gcs.charan@gmail.com / Gcs@2004
- **Test Driver**: driver@test.com / password123 (after signup & approval)

### Ports
- Backend: http://localhost:5001
- Frontend: http://localhost:3000
- MongoDB: 27017

### Useful URLs
- Delivery Signup: http://localhost:3000/delivery/signup
- Delivery Login: http://localhost:3000/delivery/login
- Delivery Dashboard: http://localhost:3000/delivery/dashboard
- Admin Dashboard: http://localhost:3000/admin

Happy Testing! 🚀
