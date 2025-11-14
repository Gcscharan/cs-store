# Delivery Boy Feature - Implementation Guide

## Overview
This document outlines the complete delivery partner system implementation for the CS Store platform, designed with Swiggy/Zomato-like features for delivery partners.

## Sprint A Implementation Status ✅

### Backend Implementation

#### 1. Database Models

**User Model Extensions** (`backend/src/models/User.ts`)
- Added `status` field: "pending" | "active" | "suspended"
- Added `deliveryProfile` object:
  - `phone`: Delivery partner phone
  - `vehicleType`: bike | car | cycle | scooter | walking
  - `assignedAreas`: Array of pincodes
  - `aadharOrId`: ID document number
  - `documents`: Array of uploaded documents
  - `approvedAt`: Approval timestamp
  - `approvedBy`: Admin who approved

**Order Model Extensions** (`backend/src/models/Order.ts`)
- Added `deliveryStatus`: created | assigned | picked | delivered | cancelled
- Added `assignmentHistory`: Track all assignment offers/accepts/rejects
- Added `deliveryProof`: OTP/photo/signature proof
- Added `deliveryOtp`: 4-digit verification code
- Added `riderLocation`: Current rider GPS coordinates
- Added `earnings`: deliveryFee, tip, commission breakdown

**DeliveryBoy Model** (`backend/src/models/DeliveryBoy.ts`)
- Already exists with location tracking capabilities
- Connected to User model via `userId` field

#### 2. Authentication & Authorization

**Delivery Auth Controller** (`backend/src/controllers/deliveryAuthController.ts`)
- `POST /api/delivery/auth/signup`: Create delivery account (status: pending)
- `POST /api/delivery/auth/login`: Login with approval checks
- `GET /api/delivery/auth/profile`: Get delivery partner profile

**Key Features:**
- Signup creates account with "pending" status
- Login blocks access if status is "pending" or "suspended"
- JWT tokens include deliveryBoyId for quick access

#### 3. Order Management

**Delivery Order Controller** (`backend/src/controllers/deliveryOrderController.ts`)
- `GET /api/delivery/orders`: Get assigned orders
- `POST /api/delivery/orders/:id/accept`: Accept order assignment
- `POST /api/delivery/orders/:id/reject`: Reject order with reason
- `PUT /api/delivery/orders/:id/status`: Update order status (picked_up, in_transit)
- `POST /api/delivery/orders/:id/complete`: Complete with OTP/photo verification
- `PUT /api/delivery/location`: Update GPS location
- `PUT /api/delivery/status`: Toggle online/offline
- `GET /api/delivery/earnings`: Get earnings with date filters

**Key Features:**
- OTP generated on acceptance (4-digit)
- Real-time socket events on all actions
- Automatic earnings calculation
- Shift management (online/offline)

#### 4. Admin Management

**Admin Controller Extensions** (`backend/src/controllers/adminController.ts`)
- `PUT /api/admin/delivery-boys/:id/approve`: Approve pending delivery partner
- `PUT /api/admin/delivery-boys/:id/suspend`: Suspend delivery partner
- `GET /api/admin/delivery-boys-list`: List with filters (status, area)

**Routes** (`backend/src/routes/admin.ts`)
- All routes protected with admin authentication
- Can assign areas during approval

#### 5. Real-time Features

**Socket.io Integration** (`backend/src/index.ts`)
- Already configured with delivery boy location tracking
- Events:
  - `order:accepted`: Notify customer when driver accepts
  - `order:rejected`: Notify admin for reassignment
  - `order:status:update`: Real-time status updates
  - `order:delivered`: Completion notification
  - `driver:location:update`: Live GPS tracking (throttled to 3s)
  - `driver:status:update`: Online/offline changes

### Frontend Implementation

#### 1. Authentication Pages

**Delivery Signup** (`frontend/src/pages/DeliverySignup.tsx`)
- Full registration form with:
  - Name, email, phone validation
  - Vehicle type selection
  - Aadhar/ID optional field
  - Password confirmation
- Shows pending approval message after signup
- Redirects to login page

**Delivery Login** (`frontend/src/pages/DeliveryLogin.tsx`)
- Email/password authentication
- Status-specific error messages:
  - "Awaiting approval" for pending accounts
  - "Account suspended" for suspended users
- Stores auth state in Redux
- Redirects to `/delivery/dashboard`

#### 2. Existing Dashboard

**Delivery Dashboard** (`frontend/src/pages/DeliveryDashboard.tsx`)
- Already exists with basic structure
- Components:
  - `DeliveryNavbar`: Header with online/offline toggle
  - `HomeTab`: Order queue and active orders
  - `EarningsTab`: Earnings summary
  - `NotificationsTab`: Order notifications
  - `MoreTab`: Settings and profile
  - `DeliveryBottomNav`: Bottom navigation

**Next Steps for Dashboard Enhancement (Sprint B):**
- Add accept/reject order buttons
- Integrate real-time socket updates
- Add map view with current location
- Show OTP entry field for delivery completion
- Display navigation link to Google Maps

#### 3. Routes Configuration

**App.tsx Updates**
- `/delivery/signup`: Public signup page
- `/delivery/login`: Public login page
- `/delivery/dashboard`: Protected dashboard (requires delivery role)

## Environment Variables Required

Add to `.env` file:

```bash
# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-here

# Google Maps (for navigation & routing)
GOOGLE_MAPS_API_KEY=your-google-maps-key

# Mapbox (alternative to Google Maps)
MAPBOX_API_KEY=your-mapbox-key

# Firebase Cloud Messaging (for push notifications - Sprint B)
FCM_SERVER_KEY=your-fcm-server-key

# Frontend URL
FRONTEND_URL=http://localhost:3000

# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/cs-store

# Server Port
PORT=5001
```

## API Endpoints Summary

### Public Endpoints
- `POST /api/delivery/auth/signup` - Register as delivery partner
- `POST /api/delivery/auth/login` - Login for delivery partners

### Protected Delivery Endpoints (Require delivery role + active status)
- `GET /api/delivery/auth/profile` - Get profile
- `GET /api/delivery/orders` - Get assigned orders
- `POST /api/delivery/orders/:id/accept` - Accept order
- `POST /api/delivery/orders/:id/reject` - Reject order
- `PUT /api/delivery/orders/:id/status` - Update order status
- `POST /api/delivery/orders/:id/complete` - Complete with proof
- `PUT /api/delivery/location` - Update location
- `PUT /api/delivery/status` - Toggle online/offline
- `GET /api/delivery/earnings?from=&to=` - Get earnings

### Admin Endpoints
- `GET /api/admin/delivery-boys-list?status=&area=` - List delivery partners
- `PUT /api/admin/delivery-boys/:id/approve` - Approve partner
- `PUT /api/admin/delivery-boys/:id/suspend` - Suspend partner

## Testing Flow

### 1. Delivery Partner Signup
```bash
curl -X POST http://localhost:5001/api/delivery/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Driver",
    "email": "driver@test.com",
    "phone": "9876543210",
    "password": "password123",
    "vehicleType": "bike",
    "assignedAreas": ["500001", "500002"]
  }'
```

### 2. Admin Approval
```bash
curl -X PUT http://localhost:5001/api/admin/delivery-boys/{userId}/approve \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin-token}" \
  -d '{
    "assignedAreas": ["500001", "500002", "500003"]
  }'
```

### 3. Delivery Login
```bash
curl -X POST http://localhost:5001/api/delivery/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@test.com",
    "password": "password123"
  }'
```

### 4. Accept Order
```bash
curl -X POST http://localhost:5001/api/delivery/orders/{orderId}/accept \
  -H "Authorization: Bearer {delivery-token}"
```

### 5. Complete Delivery with OTP
```bash
curl -X POST http://localhost:5001/api/delivery/orders/{orderId}/complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {delivery-token}" \
  -d '{
    "otp": "1234"
  }'
```

## Sprint B & C Roadmap

### Sprint B (Order Management & Navigation)
- [ ] Enhance dashboard with accept/reject UI
- [ ] Add real-time order assignment notifications
- [ ] Integrate Google Maps for navigation
  - Deep link: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`
- [ ] Add photo upload for proof of delivery
- [ ] Implement OTP entry UI
- [ ] Show earnings breakdown
- [ ] Add order history

### Sprint C (Advanced Features)
- [ ] Push notifications via FCM
- [ ] Offline sync with IndexedDB
- [ ] Analytics dashboard
  - Orders per day
  - Earnings trends
  - Ratings
- [ ] Performance optimization
- [ ] Load testing
- [ ] Production hardening

## Admin UI Requirements

Create `AdminDeliveryBoysPage.tsx` with:
- Table showing all delivery partners
- Filters: status (pending/active/suspended), area
- Columns: Name, Phone, Vehicle, Status, Assigned Areas, Created At
- Actions: Approve, Suspend, View Details
- Real-time status indicators (online/offline)

## Mobile Responsiveness

All delivery partner pages must work on mobile:
- Large touch targets (48px minimum)
- Bottom navigation for easy thumb access
- Swipeable cards for orders
- Fixed header with online toggle
- Collapsible order details

## Security Considerations

1. **Route Protection**: All `/api/delivery/*` routes check:
   - Valid JWT token
   - Role is "delivery"
   - Status is "active"

2. **OTP Security**: 
   - 4-digit OTP generated on order acceptance
   - Stored server-side, not sent to client
   - Single-use verification

3. **Rate Limiting**: 
   - Apply to accept/reject endpoints
   - Prevent rapid-fire abuse

4. **Location Privacy**:
   - Only track when shift is active
   - Low-frequency updates when idle
   - Allow rider to disable sharing

## Performance Notes

1. **Location Updates**: Throttled to every 3 seconds via socket.io
2. **Database Batch Updates**: Location persisted every 30 seconds
3. **Smooth Animation**: 10-point interpolation for marker movement

## Known Issues & TODOs

- [ ] Add email/push notification on approval
- [ ] Implement document upload for Aadhar/license
- [ ] Add shift summary (start time, end time, total earnings)
- [ ] Calculate ETA using Google Directions API
- [ ] Add rider ratings system
- [ ] Implement multi-order batching
- [ ] Add heat map for high-demand areas

## Support & Contact

For questions about the delivery partner system:
- Backend: Review `/backend/src/controllers/deliveryAuthController.ts`
- Frontend: Review `/frontend/src/pages/DeliveryDashboard.tsx`
- Socket Events: Review `/backend/src/index.ts` (lines 44-149)
