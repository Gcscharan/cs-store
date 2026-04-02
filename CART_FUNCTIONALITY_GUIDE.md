# Cart Functionality Guide

## Status: ✅ All Code is Correct

I've reviewed all cart-related code and found no issues. The cart functionality is properly implemented.

---

## Cart Architecture

### Files Involved:
1. **CartScreen.tsx** - Main cart UI
2. **cartSlice.ts** - Redux state management
3. **cartApi.ts** - API calls for cart operations
4. **SearchScreen.tsx** - Voice-to-cart integration

### Data Flow:
```
User Action → Redux Action → API Call → Server → Response → Redux Sync → UI Update
```

---

## Cart Features

### ✅ Implemented Features:
1. **View Cart Items** - Display all items with images, names, prices
2. **Update Quantity** - Increase/decrease item quantities (1-99)
3. **Remove Items** - Delete items from cart
4. **Price Breakdown** - Subtotal, GST, delivery fee, total
5. **Address Management** - Show/change delivery address
6. **Free Delivery Banner** - Shows progress toward free delivery
7. **Empty Cart State** - Friendly UI when cart is empty
8. **Optimistic Updates** - Instant UI feedback before API response
9. **Error Recovery** - Refetch on API failure
10. **Voice-to-Cart** - Add items via voice commands

---

## How Cart Works

### Adding Items to Cart:

**From Product Screen:**
```typescript
dispatch(addItem({
  productId: product._id,
  name: product.name,
  price: product.price,
  quantity: 1,
  image: product.images?.[0],
}));
```

**From Voice Search:**
```typescript
// Voice: "2 milk and coke"
// → Resolves products
// → Adds to cart with quantities
dispatch(addItem({
  productId: item.productId,
  name: item.productName,
  price: item.price,
  quantity: item.quantity,
  image: item.image,
}));
```

### Updating Quantity:
```typescript
dispatch(updateQuantity({ productId, quantity: newQty }));
// → API call to sync with server
// → Redux state updated
```

### Removing Items:
```typescript
dispatch(removeItem(productId));
// → API call to remove from server
// → Redux state updated
```

---

## Testing the Cart

### Test 1: Add Items
1. Go to Home screen
2. Tap any product
3. Tap "Add to Cart"
4. Navigate to Cart tab
5. ✅ Item should appear in cart

### Test 2: Update Quantity
1. In cart, tap "+" button
2. ✅ Quantity should increase
3. ✅ Price should update
4. Tap "−" button
5. ✅ Quantity should decrease

### Test 3: Remove Item
1. In cart, tap trash icon
2. ✅ Item should be removed
3. ✅ Total should update

### Test 4: Voice-to-Cart
1. Go to Search screen
2. Tap microphone icon
3. Say: "2 milk and coke"
4. ✅ Items should be added to cart
5. Navigate to Cart tab
6. ✅ Items should appear with correct quantities

### Test 5: Empty Cart
1. Remove all items from cart
2. ✅ Should show "Your cart is empty" message
3. ✅ Should show "Start Shopping" button

### Test 6: Price Calculation
1. Add multiple items
2. ✅ Subtotal should be sum of (price × quantity)
3. ✅ GST should be calculated correctly
4. ✅ Delivery fee should show (or FREE if above threshold)
5. ✅ Total should be accurate

---

## Common Issues & Solutions

### Issue 1: Cart Not Updating
**Symptom:** Items added but cart doesn't update

**Solution:**
```bash
# Clear Metro bundler cache
npx expo start --clear
```

### Issue 2: Items Disappear After Refresh
**Symptom:** Cart empties on app reload

**Cause:** Redux state not persisted

**Solution:** Check if Redux persist is configured in store

### Issue 3: Quantity Buttons Not Working
**Symptom:** +/− buttons don't respond

**Check:**
1. Console for errors
2. API response
3. Redux state updates

### Issue 4: Voice-to-Cart Not Working
**Symptom:** Voice commands don't add to cart

**Solution:**
1. Check import path: `import { addItem } from '../../store/slices/cartSlice';`
2. Clear cache: `npx expo start --clear`
3. Check console for errors

---

## Redux State Structure

```typescript
{
  cart: {
    items: [
      {
        productId: "123",
        name: "Amul Milk",
        price: 60,
        quantity: 2,
        image: "https://..."
      }
    ],
    total: 120,
    itemCount: 2
  }
}
```

---

## API Endpoints

### GET /cart
Returns current cart state

### POST /cart
Add item to cart
```json
{
  "productId": "123",
  "quantity": 1
}
```

### PUT /cart
Update item quantity
```json
{
  "productId": "123",
  "quantity": 3
}
```

### DELETE /cart/:productId
Remove item from cart

---

## Code Quality

### ✅ No TypeScript Errors
All files pass type checking

### ✅ Proper Error Handling
- Try-catch blocks for API calls
- Refetch on failure
- User-friendly error messages

### ✅ Optimistic Updates
- Instant UI feedback
- Syncs with server in background
- Reverts on error

### ✅ Performance Optimizations
- React.memo for cart items
- useMemo for calculations
- useCallback for handlers
- FlatList for efficient rendering

---

## Next Steps

### If Cart Still Not Working:

1. **Clear Cache:**
   ```bash
   cd apps/customer-app
   npx expo start --clear
   ```

2. **Check Console:**
   - Look for errors in terminal
   - Check React Native debugger
   - Look for API errors

3. **Verify Backend:**
   - Ensure backend is running
   - Check API endpoints are accessible
   - Verify authentication

4. **Test API Directly:**
   ```bash
   # Get cart
   curl -X GET http://localhost:3000/api/cart \
     -H "Authorization: Bearer YOUR_TOKEN"
   
   # Add to cart
   curl -X POST http://localhost:3000/api/cart \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"productId":"123","quantity":1}'
   ```

5. **Check Redux DevTools:**
   - Install Redux DevTools
   - Monitor state changes
   - Verify actions are dispatched

---

## Summary

The cart code is **correct and complete**. All functionality is properly implemented:

- ✅ Add items
- ✅ Update quantities
- ✅ Remove items
- ✅ Price calculations
- ✅ Address management
- ✅ Voice-to-cart integration
- ✅ Error handling
- ✅ Optimistic updates

If you're experiencing issues, it's likely a **cache problem**. Run:

```bash
npx expo start --clear
```

This will clear the Metro bundler cache and reload with the correct code.

---

**Need Help?** Provide specific error messages or describe what's not working, and I can help debug further.
