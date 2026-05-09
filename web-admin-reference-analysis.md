# Web Admin Reference Analysis

## Task 0.1: Web Admin Reference Files Analysis

This document provides a comprehensive analysis of the web admin reference files to understand the exact behavior that needs to be replicated in the mobile app for achieving backend parity.

## 1. AdminOrdersPage.tsx Analysis

### API Calls Documented

#### Order Confirmation
- **Endpoint**: `POST /api/admin/orders/${orderId}/confirm`
- **Method**: POST (NOT PATCH as specified in requirements)
- **Headers**: 
  - `Content-Type: application/json`
  - `Authorization: Bearer ${accessToken}`
- **Response Handling**: 
  - Updates local state with complete order object from response
  - Shows success toast notification
  - No manual status updates

#### Order Packing
- **Endpoint**: `POST /api/admin/orders/${orderId}/pack`
- **Method**: POST (NOT PATCH as specified in requirements)
- **Headers**: Same as confirm
- **Response Handling**: Same pattern as confirm

#### Order Cancellation
- **Endpoint**: `PUT /api/orders/${orderId}/cancel`
- **Method**: PUT
- **Headers**: Same as confirm
- **Response Handling**: Same pattern as confirm

### Status-Based Logic (NOT allowedActions)

**CRITICAL FINDING**: The web admin does NOT use `allowedActions` array. Instead, it uses status-based conditionals:

```typescript
const canConfirm = canonical === "CREATED";
const canPack = canonical === "CONFIRMED";
const canCancel = ["CREATED", "CONFIRMED", "PACKED"].includes(canonical);
```

### Socket Event Handling

#### Event: `order:status:changed`
- **Payload Structure**:
  ```typescript
  {
    orderId: string;
    from: string;
    to: string;
    actorRole: 'CUSTOMER' | 'DELIVERY_PARTNER' | 'ADMIN';
    actorId: string;
    timestamp: string;
  }
  ```
- **Handler**: Updates order in local state array
- **UI Update**: Shows toast notification
- **State Update**: Replaces `orderStatus`, `status`, and `updatedAt` fields

#### Event: `order:assigned`
- **Not found in AdminOrdersPage.tsx**
- **Only found in delivery component**: `EnhancedHomeTab.tsx`

### Order State Management

#### State Update Pattern
```typescript
setOrders(prevOrders => 
  prevOrders.map(order => {
    if (order._id === payload.orderId) {
      return {
        ...order,
        orderStatus: payload.to,
        status: payload.to,
        updatedAt: payload.timestamp,
      };
    }
    return order;
  })
);
```

#### API Response Handling
```typescript
if (data.order) {
  setOrders((prevOrders) =>
    prevOrders.map((o) => (o._id === data.order._id ? { ...data.order } : o))
  );
} else {
  fetchOrders(); // Fallback refetch
}
```

## 2. AdminOrderDetailsPage.tsx Analysis

### API Calls Documented

#### Same endpoints as AdminOrdersPage.tsx
- Confirm: `POST /api/admin/orders/${orderId}/confirm`
- Pack: `POST /api/admin/orders/${orderId}/pack`
- Cancel: `PUT /api/orders/${orderId}/cancel`

### Status-Based Action Logic

```typescript
const getAvailableStatusOptions = (currentStatus: string) => {
  const canonical = upper === "PENDING" ? "CREATED" : upper;
  
  if (canonical === "CREATED") {
    return [
      { value: "CONFIRMED", label: "Confirm Order", color: "bg-green-600 hover:bg-green-700" },
      { value: "CANCELLED", label: "Cancel Order", color: "bg-red-600 hover:bg-red-700" },
    ];
  }

  if (canonical === "CONFIRMED") {
    return [
      { value: "PACKED", label: "Confirm Order", color: "bg-blue-600 hover:bg-blue-700" },
      { value: "CANCELLED", label: "Cancel Order", color: "bg-red-600 hover:bg-red-700" },
    ];
  }
  
  return []; // No actions for packed/cancelled orders
}
```

### Socket Event Handling

#### Same pattern as AdminOrdersPage.tsx
- Listens for `order:status:changed`
- Updates single order object in state
- Shows toast notification

## 3. Socket Implementation Analysis

### useOrderWebSocket Hook

#### Connection Setup
- **URL**: Uses `getApiOrigin()` 
- **Transports**: `['websocket', 'polling']`
- **Auth**: Sends token in auth object
- **Room**: Joins `admin_room` for admin users

#### Event Listeners
- **`order:status:changed`**: Main event for order updates
- **No `order:assigned` event** in admin hook

#### Admin-Only Restriction
```typescript
if (userRole !== 'admin') {
  return; // Only admins get socket connection
}
```

## 4. Key Differences from Requirements

### 1. API Methods Mismatch
- **Requirements specify**: PATCH methods
- **Web admin uses**: POST for confirm/pack, PUT for cancel

### 2. No allowedActions Usage
- **Requirements specify**: Use `allowedActions` array
- **Web admin uses**: Status-based conditionals

### 3. Missing Assignment Flow
- **Requirements specify**: Assignment API and flow
- **Web admin**: No assignment functionality found

### 4. Socket Events
- **Requirements specify**: `order:assigned` event
- **Web admin**: Only uses `order:status:changed`

## 5. Current Mobile Admin Comparison

### API Endpoints (Mobile vs Web)
| Action | Mobile API | Web API | Match |
|--------|------------|---------|-------|
| Confirm | `POST /admin/orders/:id/confirm` | `POST /api/admin/orders/:id/confirm` | ❌ Missing `/api` prefix |
| Pack | `POST /admin/orders/:id/pack` | `POST /api/admin/orders/:id/pack` | ❌ Missing `/api` prefix |
| Cancel | `PUT /orders/:id/cancel` | `PUT /api/orders/:id/cancel` | ❌ Missing `/api` prefix |

### Status Logic (Mobile vs Web)
| Platform | Logic Type | Implementation |
|----------|------------|----------------|
| Mobile | Status-based | `canConfirm = status === 'CREATED'` |
| Web | Status-based | `canConfirm = canonical === "CREATED"` |
| Both | ✅ Same pattern | Status-based conditionals |

### Missing in Mobile
1. **Socket integration**: No real-time updates
2. **Assignment flow**: No delivery partner assignment
3. **API prefix**: Missing `/api` in endpoints
4. **Response handling**: Manual refetch instead of state updates

## 6. Recommendations for Mobile Parity

### Immediate Actions Needed

1. **Fix API endpoints**: Add `/api` prefix to match web admin exactly
2. **Implement socket integration**: Add real-time order updates
3. **Add assignment flow**: Implement delivery partner assignment
4. **Improve response handling**: Use API response to update state instead of refetch

### Status Logic Decision

**CRITICAL**: The requirements specify using `allowedActions`, but the web admin uses status-based logic. We need to clarify:

- Should mobile follow web admin's status-based approach?
- Or should mobile implement `allowedActions` as specified in requirements?
- This affects the entire implementation strategy

### Socket Events Priority

1. **`order:status:changed`**: High priority - used by web admin
2. **`order:assigned`**: Medium priority - specified in requirements but not used by web admin

## 7. Implementation Strategy

Based on this analysis, the mobile admin should:

1. **Match web admin exactly** for core functionality (API calls, status logic)
2. **Add missing features** specified in requirements (assignment flow, socket events)
3. **Use status-based logic** like web admin (not allowedActions)
4. **Implement proper state management** with API response handling

This ensures true behavioral parity with the web admin while meeting the requirements for enhanced functionality.