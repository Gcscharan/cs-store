# CVRP Route Assignment - Example Input/Output

## Example Input

### Request
```bash
POST /api/admin/routes/compute
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "orderIds": [
    "507f1f77bcf86cd799439011",
    "507f191e810c19729de860ea",
    "507f1f77bcf86cd799439012",
    "507f191e810c19729de860eb",
    "507f1f77bcf86cd799439013",
    "507f191e810c19729de860ec",
    "507f1f77bcf86cd799439014",
    "507f191e810c19729de860ed",
    "507f1f77bcf86cd799439015",
    "507f191e810c19729de860ee",
    "507f1f77bcf86cd799439016",
    "507f191e810c19729de860ef",
    "507f1f77bcf86cd799439017",
    "507f191e810c19729de860f0",
    "507f1f77bcf86cd799439018",
    "507f191e810c19729de860f1",
    "507f1f77bcf86cd799439019",
    "507f191e810c19729de860f2",
    "507f1f77bcf86cd79943901a",
    "507f191e810c19729de860f3",
    "507f1f77bcf86cd79943901b",
    "507f191e810c19729de860f4",
    "507f1f77bcf86cd79943901c",
    "507f191e810c19729de860f5",
    "507f1f77bcf86cd79943901d"
  ],
  "vehicle": {
    "type": "AUTO"
  }
}
```

### Order Data (from database)
Each order has:
- `_id`: Order ID
- `address.lat`: Latitude (e.g., 17.100)
- `address.lng`: Longitude (e.g., 80.600)
- `address.pincode`: Pincode (e.g., "521235")
- `orderStatus`: "PACKED"

## Example Output

### Success Response
```json
{
  "success": true,
  "warehouse": {
    "lat": 17.094,
    "lng": 80.598,
    "pincode": 521235
  },
  "vehicleType": "AUTO",
  "routes": [
    {
      "routeId": "AUTO-R-01",
      "deliveryBoyId": null,
      "orderCount": 25,
      "totalDistanceKm": 28.6,
      "estimatedTimeMin": 145,
      "orders": [
        "507f1f77bcf86cd799439011",
        "507f191e810c19729de860ea",
        "507f1f77bcf86cd799439012",
        "507f191e810c19729de860eb",
        "507f1f77bcf86cd799439013",
        "507f191e810c19729de860ec",
        "507f1f77bcf86cd799439014",
        "507f191e810c19729de860ed",
        "507f1f77bcf86cd799439015",
        "507f191e810c19729de860ee",
        "507f1f77bcf86cd799439016",
        "507f191e810c19729de860ef",
        "507f1f77bcf86cd799439017",
        "507f191e810c19729de860f0",
        "507f1f77bcf86cd799439018",
        "507f191e810c19729de860f1",
        "507f1f77bcf86cd799439019",
        "507f191e810c19729de860f2",
        "507f1f77bcf86cd79943901a",
        "507f191e810c19729de860f3",
        "507f1f77bcf86cd79943901b",
        "507f191e810c19729de860f4",
        "507f1f77bcf86cd79943901c",
        "507f191e810c19729de860f5",
        "507f1f77bcf86cd79943901d"
      ],
      "routePath": [
        "WAREHOUSE",
        "507f1f77bcf86cd799439011",
        "507f191e810c19729de860ea",
        "507f1f77bcf86cd799439012",
        "507f191e810c19729de860eb",
        "507f1f77bcf86cd799439013",
        "507f191e810c19729de860ec",
        "507f1f77bcf86cd799439014",
        "507f191e810c19729de860ed",
        "507f1f77bcf86cd799439015",
        "507f191e810c19729de860ee",
        "507f1f77bcf86cd799439016",
        "507f191e810c19729de860ef",
        "507f1f77bcf86cd799439017",
        "507f191e810c19729de860f0",
        "507f1f77bcf86cd799439018",
        "507f191e810c19729de860f1",
        "507f1f77bcf86cd799439019",
        "507f191e810c19729de860f2",
        "507f1f77bcf86cd79943901a",
        "507f191e810c19729de860f3",
        "507f1f77bcf86cd79943901b",
        "507f191e810c19729de860f4",
        "507f1f77bcf86cd79943901c",
        "507f191e810c19729de860f5",
        "507f1f77bcf86cd79943901d"
      ]
    }
  ],
  "metadata": {
    "totalOrders": 25,
    "totalRoutes": 1,
    "averageOrdersPerRoute": 25.0,
    "computationTimeMs": 12
  }
}
```

### Error Response Examples

#### Insufficient Orders
```json
{
  "error": "Route computation failed",
  "message": "Insufficient orders: 15 < 20 (minimum required)"
}
```

#### Invalid Vehicle Type
```json
{
  "error": "Route computation failed",
  "message": "Vehicle type must be AUTO, got BIKE"
}
```

#### Missing Coordinates
```json
{
  "error": "Route computation failed",
  "message": "Order 507f1f77bcf86cd799439011 missing valid lat/lng coordinates"
}
```

#### Route Capacity Exceeded
```json
{
  "error": "Route computation failed",
  "message": "Route 1 has 35 orders, maximum 30 allowed"
}
```

#### Route Distance Exceeded
```json
{
  "error": "Route computation failed",
  "message": "Route 1 distance 38.5 km exceeds maximum 35 km"
}
```

## Multiple Routes Example

### Input: 60 Orders

### Output: 2 Routes
```json
{
  "success": true,
  "warehouse": {
    "lat": 17.094,
    "lng": 80.598,
    "pincode": 521235
  },
  "vehicleType": "AUTO",
  "routes": [
    {
      "routeId": "AUTO-R-01",
      "deliveryBoyId": null,
      "orderCount": 30,
      "totalDistanceKm": 32.4,
      "estimatedTimeMin": 175,
      "orders": ["order1", "order2", ...],
      "routePath": ["WAREHOUSE", "order1", "order2", ...]
    },
    {
      "routeId": "AUTO-R-02",
      "deliveryBoyId": null,
      "orderCount": 30,
      "totalDistanceKm": 29.8,
      "estimatedTimeMin": 169,
      "orders": ["order31", "order32", ...],
      "routePath": ["WAREHOUSE", "order31", "order32", ...]
    }
  ],
  "metadata": {
    "totalOrders": 60,
    "totalRoutes": 2,
    "averageOrdersPerRoute": 30.0,
    "computationTimeMs": 28
  }
}
```

## Route Path Interpretation

The `routePath` array shows the delivery sequence:

1. **Start:** `WAREHOUSE` (Tiruvuru, pincode 521235)
2. **Deliver orders** in sequence: `order1` → `order2` → `order3` → ...
3. **Return:** Back to `WAREHOUSE` (implicit)

### Example Route Path:
```
WAREHOUSE → Order A → Order B → Order C → Order D → ... → WAREHOUSE
```

The delivery boy should:
1. Start at warehouse
2. Follow the route path order
3. Deliver each order in sequence
4. Return to warehouse after last delivery

## Admin Workflow

1. **Fetch Pending Orders**
   - Query orders with status `PACKED` and no `deliveryBoyId`

2. **Compute Routes**
   - Call `/api/admin/routes/compute`
   - Review computed routes

3. **Assign Routes**
   - Select route (e.g., `AUTO-R-01`)
   - Select delivery boy
   - Assign route to delivery boy
   - Update `deliveryBoyId` for all orders in route

4. **Delivery Execution**
   - Delivery boy receives route assignment
   - Follows `routePath` sequence
   - Completes deliveries in order

## Notes

- Route IDs are deterministic: `AUTO-R-01`, `AUTO-R-02`, etc.
- Routes are optimized for distance and time
- Each route respects capacity (20-30 orders) and distance (≤35km) constraints
- Route paths are optimized using Nearest Neighbor + 2-opt algorithms
- Estimated time includes travel time + stop time (5 min per order)
