# 🧪 Voice-to-Cart Testing Guide

## ✅ Integration Complete!

The voice-to-cart engine has been successfully integrated into SearchScreen.

---

## 🎯 What Was Changed

### Files Modified:
1. **`SearchScreen.tsx`** - Upgraded with voice-to-cart intelligence

### New Imports Added:
```typescript
import VoiceCartConfirmation from '../../components/VoiceCartConfirmation';
import { 
  processVoiceInput, 
  resolveItems, 
  voiceContext,
  type ResolvedItem 
} from '../../utils/voiceToCartEngine';
import { useDispatch } from 'react-redux';
import { addToCart } from '../../store/cartSlice';
import { ToastAndroid, Alert } from 'react-native';
```

### New State Added:
```typescript
const [showVoiceConfirmation, setShowVoiceConfirmation] = useState(false);
const [resolvedItems, setResolvedItems] = useState<ResolvedItem[]>([]);
```

### New Functions Added:
- `showToast()` - Cross-platform toast notifications
- `addItemsToCart()` - Batch add items to cart
- `handleVoiceResult()` - UPGRADED with cart intelligence
- `handleVoiceConfirm()` - Confirm voice cart additions
- `handleVoiceEdit()` - Edit voice cart selections
- `handleVoiceCancel()` - Cancel voice cart

---

## 🧪 Testing Checklist

### Phase 1: Basic Voice-to-Cart (5 minutes)

#### Test 1: Simple Add (High Confidence)
```
🎤 Say: "2 milk"
✅ Expected: 
  - Voice modal shows "2 milk"
  - Modal closes
  - Toast: "Added 2x [Product Name] 🛒"
  - Cart has 2 milk items
```

#### Test 2: Multiple Items
```
🎤 Say: "lays and coke"
✅ Expected:
  - Voice modal shows "lays and coke"
  - Confirmation modal appears
  - Shows 2 items with images and prices
  - Click "Add to Cart"
  - Toast: "Added 1x Lays, 1x Coca-Cola 🛒"
  - Cart has both items
```

#### Test 3: Word Numbers
```
🎤 Say: "one maggi"
✅ Expected:
  - Adds 1 maggi to cart
  - Toast confirmation
```

#### Test 4: Ambiguous Search
```
🎤 Say: "milk"
✅ Expected:
  - Voice modal closes
  - Shows search results for "milk"
  - No cart addition (fallback to search)
```

---

### Phase 2: Advanced Features (5 minutes)

#### Test 5: Follow-up Command
```
🎤 Say: "2 milk"
✅ Expected: Added 2 milk to cart

🎤 Say: "add one more"
✅ Expected:
  - Adds 1 more milk (total: 3)
  - Toast: "Added 1x [Product Name] 🛒"
```

#### Test 6: Large Order (Confirmation)
```
🎤 Say: "5 lays, 3 coke, 2 bread"
✅ Expected:
  - Confirmation modal appears
  - Shows all 3 items with quantities
  - Total items: 10
  - Click "Add to Cart"
  - All items added
```

#### Test 7: Edit Voice Cart
```
🎤 Say: "lays and coke"
✅ Expected: Confirmation modal appears

👆 Click: "Edit"
✅ Expected:
  - Modal closes
  - Search query set to "lays coke"
  - Shows search results
```

#### Test 8: Cancel Voice Cart
```
🎤 Say: "lays and coke"
✅ Expected: Confirmation modal appears

👆 Click: Cancel (X button)
✅ Expected:
  - Modal closes
  - Nothing added to cart
```

---

### Phase 3: Edge Cases (5 minutes)

#### Test 9: No Products Found
```
🎤 Say: "asdfgh"
✅ Expected:
  - Voice modal closes
  - Toast: "No exact matches found. Showing search results."
  - Shows empty search results
```

#### Test 10: Comma-Separated Items
```
🎤 Say: "2 lays, 1 coke, bread"
✅ Expected:
  - Parses 3 items correctly
  - Shows confirmation modal
  - All 3 items with correct quantities
```

#### Test 11: Context Timeout
```
🎤 Say: "2 milk"
✅ Expected: Added to cart

⏰ Wait: 3 minutes

🎤 Say: "add one more"
✅ Expected:
  - Context expired
  - Treats as new search
  - Shows search results for "add one more"
```

#### Test 12: Mixed Quantities
```
🎤 Say: "one lays and 3 coke"
✅ Expected:
  - Parses: 1 lays, 3 coke
  - Shows confirmation
  - Correct quantities displayed
```

---

## 🐛 Troubleshooting

### Issue: Items not resolving
**Symptom:** Voice input processed but no products found

**Fix:**
1. Check if products exist in your database
2. Verify product names match voice input
3. Add more mappings to `voiceIntentParser.ts`:
   ```typescript
   const PRODUCT_DICTIONARY = {
     your_product: ['your product', 'your prod'],
   };
   ```

### Issue: Confirmation always showing
**Symptom:** Even simple commands show confirmation

**Fix:**
Adjust confidence thresholds in `voiceToCartEngine.ts`:
```typescript
function calculateConfidence(items, rawText) {
  // Make it more lenient
  if (items.length === 1 && items[0].quantity > 0) {
    return 'high'; // Was 'medium'
  }
}
```

### Issue: Toast not showing
**Symptom:** Items added but no feedback

**Fix:**
Check platform:
- Android: Should use ToastAndroid
- iOS: Should use Alert

### Issue: Cart not updating
**Symptom:** Toast shows but cart empty

**Fix:**
1. Verify Redux store is configured
2. Check `addToCart` action exists
3. Verify cart slice is imported correctly

---

## 📊 Analytics Verification

Check these events are firing:

### 1. Voice Intent Detected
```typescript
logEvent('voice_intent_detected', {
  intent: 'ADD_TO_CART',
  itemCount: 2,
  confidence: 'high',
});
```

### 2. Voice Cart Add
```typescript
logEvent('voice_cart_add', {
  itemCount: 2,
  totalValue: 120,
});
```

### 3. Voice Cart Confirmed
```typescript
logEvent('voice_cart_confirmed', {
  itemCount: 2,
});
```

### 4. Voice Cart Edited
```typescript
logEvent('voice_cart_edited', {
  itemCount: 2,
});
```

### 5. Voice Cart Cancelled
```typescript
logEvent('voice_cart_cancelled', {
  itemCount: 2,
});
```

---

## 🎯 Success Criteria

### Functional:
- ✅ Voice input correctly parsed
- ✅ Quantities extracted accurately
- ✅ Multiple items split correctly
- ✅ Products resolved from voice
- ✅ Items added to cart
- ✅ Toast notifications show
- ✅ Confirmation modal works
- ✅ Follow-up commands work

### Performance:
- ✅ Voice-to-cart: < 3 seconds
- ✅ No UI freezing
- ✅ Smooth animations
- ✅ No memory leaks

### UX:
- ✅ Clear feedback at each step
- ✅ Graceful error handling
- ✅ Intuitive confirmation UI
- ✅ Easy to edit/cancel

---

## 🚀 Next Steps

### Immediate:
1. ✅ Run through all test cases
2. ✅ Fix any issues found
3. ✅ Test on real device
4. ✅ Get user feedback

### Short-term:
1. Add more product mappings
2. Tune confidence thresholds
3. Add combo detection
4. Improve error messages

### Long-term:
1. Add smart suggestions
2. Add natural language processing
3. Add quantity adjustment
4. A/B test with users

---

## 📝 Test Results Template

Use this to track your testing:

```
Date: ___________
Tester: ___________
Device: ___________
OS: ___________

Test 1 (Simple Add): ☐ Pass ☐ Fail
Test 2 (Multiple Items): ☐ Pass ☐ Fail
Test 3 (Word Numbers): ☐ Pass ☐ Fail
Test 4 (Ambiguous Search): ☐ Pass ☐ Fail
Test 5 (Follow-up): ☐ Pass ☐ Fail
Test 6 (Large Order): ☐ Pass ☐ Fail
Test 7 (Edit): ☐ Pass ☐ Fail
Test 8 (Cancel): ☐ Pass ☐ Fail
Test 9 (No Products): ☐ Pass ☐ Fail
Test 10 (Comma-Separated): ☐ Pass ☐ Fail
Test 11 (Context Timeout): ☐ Pass ☐ Fail
Test 12 (Mixed Quantities): ☐ Pass ☐ Fail

Issues Found:
1. ___________
2. ___________
3. ___________

Overall Rating: ☐ Excellent ☐ Good ☐ Needs Work

Notes:
___________
___________
___________
```

---

## 🎉 You're Ready!

The voice-to-cart engine is fully integrated and ready for testing.

**Run the app:**
```bash
cd apps/customer-app
npm run android  # or ios
```

**Test it:**
1. Open the app
2. Go to Search screen
3. Tap the microphone icon
4. Say: "2 milk and coke"
5. Watch the magic happen! ✨

---

**Questions?** Check the troubleshooting section or refer to `VOICE_CART_QUICKSTART.md`.

**Good luck!** 🚀
