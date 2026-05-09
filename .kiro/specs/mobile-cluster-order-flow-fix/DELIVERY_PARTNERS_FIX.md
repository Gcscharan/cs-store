# Delivery Partners List Fix

## Issue
The delivery partners list was not showing in the DeliveryPartnerSelectionModal when trying to assign a cluster. The error log showed:
```
ERROR Tag type 'DeliveryPartners' was used, but not specified in `tagTypes`!
```

## Root Cause
The backend endpoint `/admin/delivery-partners/available` returns a nested structure:
```json
{
  "deliveryBoys": [
    {
      "user": {
        "_id": "...",
        "name": "...",
        "email": "...",
        "phone": "..."
      },
      "deliveryBoy": {
        "_id": "...",
        "availability": "AVAILABLE",
        "isActive": true,
        "vehicleType": "AUTO",
        "currentLoad": 2
      }
    }
  ],
  "pagination": { ... }
}
```

But the DeliveryPartnerSelectionModal expected a flat structure:
```json
{
  "deliveryPartners": [
    {
      "_id": "...",
      "name": "...",
      "phone": "...",
      "vehicleType": "AUTO",
      "isAvailable": true,
      "currentLoad": 2
    }
  ]
}
```

## Solution
Added a `transformResponse` function to the `getDeliveryPartners` endpoint in `adminApi.ts` that:

1. Extracts the nested `user` and `deliveryBoy` objects
2. Flattens them into a single object with the expected structure
3. Computes `isAvailable` from `availability === 'AVAILABLE' && isActive === true`
4. Returns the transformed data with the `deliveryPartners` key

## Changes Made

### File: `apps/customer-app/src/api/adminApi.ts`

```typescript
getDeliveryPartners: builder.query({
  query: () => ({
    url: '/admin/delivery-partners/available',
    method: 'GET',
  }),
  transformResponse: (response: any) => {
    // Backend returns: { deliveryBoys: [{ user: {...}, deliveryBoy: {...} }], pagination: {...} }
    // Transform to flat structure expected by modal
    const deliveryBoys = response?.deliveryBoys || [];
    const transformed = deliveryBoys.map((item: any) => ({
      _id: item.deliveryBoy?._id || item.user?._id,
      name: item.user?.name || 'Unknown',
      phone: item.user?.phone,
      vehicleType: item.deliveryBoy?.vehicleType,
      isAvailable: item.deliveryBoy?.availability === 'AVAILABLE' && item.deliveryBoy?.isActive === true,
      currentLoad: item.deliveryBoy?.currentLoad,
    }));
    return {
      deliveryPartners: transformed,
      pagination: response?.pagination,
    };
  },
  providesTags: ['DeliveryPartners'],
}),
```

## Verification

### Tag Type Already Added
The 'DeliveryPartners' tag type was already added to `baseApi.ts` in the `tagTypes` array, so no additional changes were needed there.

### Expected Behavior After Fix
1. When the "Assign Delivery Boy" button is clicked in ClusterOrdersScreen
2. The DeliveryPartnerSelectionModal opens
3. The modal fetches delivery partners from `/admin/delivery-partners/available`
4. The transformResponse flattens the nested structure
5. The modal displays the list of available delivery partners with:
   - Name
   - Phone number
   - Vehicle type
   - Current load (number of orders)
   - Availability status
6. User can select a partner and assign the cluster

## Testing Checklist
- [ ] Open ClusterOrdersScreen
- [ ] Click "Assign Delivery Boy" on a cluster
- [ ] Verify modal opens and shows loading state
- [ ] Verify delivery partners list appears (not empty)
- [ ] Verify each partner shows: name, phone, vehicle type, current load
- [ ] Verify unavailable partners are grayed out
- [ ] Select an available partner
- [ ] Click "Assign Partner"
- [ ] Verify success toast appears
- [ ] Verify navigation back to AdminOrdersScreen
- [ ] Verify rider receives the orders in their app

## Related Files
- `apps/customer-app/src/api/adminApi.ts` - Added transformResponse
- `apps/customer-app/src/api/baseApi.ts` - Already has 'DeliveryPartners' tag type
- `apps/customer-app/src/components/admin/DeliveryPartnerSelectionModal.tsx` - Expects flat structure
- `apps/customer-app/src/screens/admin/ClusterOrdersScreen.tsx` - Uses the modal
- `backend/src/controllers/adminController.ts` - getAdminDeliveryBoys function returns nested structure
- `backend/src/routes/admin.ts` - Routes /admin/delivery-partners/available to getAdminDeliveryBoys
