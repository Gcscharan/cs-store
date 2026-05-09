# i18n Safe Translation Migration Guide

## Overview

This guide shows how to migrate from direct `t()` usage to the safe translation wrapper `safeT()` to prevent raw translation keys from appearing in the UI.

---

## Why Migrate?

### Problem: Raw Keys in UI
```typescript
// ❌ BAD: If translation is missing, shows "home.error_loading"
<Text>{t('home.error_loading')}</Text>
```

### Solution: Safe Translation with Fallback
```typescript
// ✅ GOOD: If translation is missing, shows "Failed to load"
<Text>{safeT(t, 'home.error_loading', 'Failed to load')}</Text>
```

---

## Quick Start

### 1. Import the Utility
```typescript
import { safeT } from '../utils/safeTranslate';
import { useTranslation } from 'react-i18next';
```

### 2. Use in Component
```typescript
export default function MyScreen() {
  const { t } = useTranslation();
  
  return (
    <View>
      <Text>{safeT(t, 'screen.title', 'Default Title')}</Text>
    </View>
  );
}
```

---

## Migration Patterns

### Pattern 1: Simple Text
```typescript
// BEFORE
<Text>{t('home.title')}</Text>

// AFTER
<Text>{safeT(t, 'home.title', 'Home')}</Text>
```

### Pattern 2: With Existing Fallback
```typescript
// BEFORE
<Text>{t('home.error') || 'Something went wrong'}</Text>

// AFTER
<Text>{safeT(t, 'home.error', 'Something went wrong')}</Text>
```

### Pattern 3: Error Messages
```typescript
// BEFORE
message={t('error.loading') || 'Failed to load'}

// AFTER
message={safeT(t, 'error.loading', 'Failed to load')}
```

### Pattern 4: Button Labels
```typescript
// BEFORE
<Button title={t('common.save') || 'Save'} />

// AFTER
<Button title={safeT(t, 'common.save', 'Save')} />
```

### Pattern 5: Placeholder Text
```typescript
// BEFORE
placeholder={t('search.placeholder') || 'Search...'}

// AFTER
placeholder={safeT(t, 'search.placeholder', 'Search...')}
```

---

## Advanced Usage

### With Interpolation
```typescript
import { safeTWithOptions } from '../utils/safeTranslate';

// Translation: "Welcome, {{name}}!"
const message = safeTWithOptions(t, 'welcome.message', {
  name: user.name,
  fallback: 'Welcome!'
});
```

### Conditional Translations
```typescript
const statusText = error
  ? safeT(t, 'status.error', 'Error')
  : safeT(t, 'status.success', 'Success');
```

### Array of Translations
```typescript
const tabs = [
  { label: safeT(t, 'tabs.home', 'Home'), value: 'home' },
  { label: safeT(t, 'tabs.cart', 'Cart'), value: 'cart' },
  { label: safeT(t, 'tabs.orders', 'Orders'), value: 'orders' },
];
```

---

## Common Scenarios

### Error States
```typescript
<ErrorState 
  message={safeT(t, 'home.error_loading', 'Failed to load products')} 
  onRetry={refetch}
/>
```

### Empty States
```typescript
<EmptyState 
  title={safeT(t, 'cart.empty_title', 'Your cart is empty')}
  description={safeT(t, 'cart.empty_desc', 'Add items to get started')}
/>
```

### Loading States
```typescript
{isLoading && (
  <Text>{safeT(t, 'common.loading', 'Loading...')}</Text>
)}
```

### Success Messages
```typescript
dispatch(showToast(
  safeT(t, 'cart.item_added', 'Item added to cart')
));
```

### Form Labels
```typescript
<TextInput
  label={safeT(t, 'form.email', 'Email')}
  placeholder={safeT(t, 'form.email_placeholder', 'Enter your email')}
/>
```

---

## Best Practices

### 1. Always Provide Meaningful Fallbacks
```typescript
// ❌ BAD: Generic fallback
safeT(t, 'home.error_loading', 'Error')

// ✅ GOOD: Specific fallback
safeT(t, 'home.error_loading', 'Failed to load products')
```

### 2. Keep Fallbacks Consistent with Keys
```typescript
// ✅ GOOD: Fallback matches intent
safeT(t, 'cart.empty_title', 'Your cart is empty')
safeT(t, 'orders.no_orders', 'No orders yet')
```

### 3. Use Common Keys for Repeated Text
```typescript
// ✅ GOOD: Reuse common translations
safeT(t, 'common.loading', 'Loading...')
safeT(t, 'common.retry', 'Try Again')
safeT(t, 'common.cancel', 'Cancel')
```

### 4. Group Related Translations
```typescript
// ✅ GOOD: Organized by feature
safeT(t, 'cart.title', 'My Cart')
safeT(t, 'cart.empty', 'Cart is empty')
safeT(t, 'cart.checkout', 'Checkout')
```

---

## Migration Checklist

For each screen/component:

- [ ] Import `safeT` from `../utils/safeTranslate`
- [ ] Find all `t('...')` calls
- [ ] Replace with `safeT(t, '...', 'fallback')`
- [ ] Verify translation keys exist in `en.json`
- [ ] Add missing keys to translation file
- [ ] Test with missing translations (remove key temporarily)
- [ ] Verify fallback text displays correctly

---

## Testing Your Changes

### 1. Test with Existing Translations
```typescript
// Should show translated text
<Text>{safeT(t, 'home.title', 'Home')}</Text>
// Expected: Translated "Home" text
```

### 2. Test with Missing Translations
```typescript
// Temporarily remove key from en.json
<Text>{safeT(t, 'home.missing_key', 'Fallback Text')}</Text>
// Expected: "Fallback Text" (not "home.missing_key")
```

### 3. Test Auto-Generated Fallbacks
```typescript
// No custom fallback provided
<Text>{safeT(t, 'home.error_loading')}</Text>
// Expected: "Error Loading" (humanized key)
```

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Forgetting Fallback
```typescript
// BAD: No fallback
safeT(t, 'key')

// GOOD: With fallback
safeT(t, 'key', 'Default text')
```

### ❌ Mistake 2: Using Wrong Key Format
```typescript
// BAD: Inconsistent naming
safeT(t, 'HomeErrorLoading', 'Error')

// GOOD: Consistent naming
safeT(t, 'home.error_loading', 'Error')
```

### ❌ Mistake 3: Hardcoding Text
```typescript
// BAD: Hardcoded text
<Text>Error loading products</Text>

// GOOD: Translatable
<Text>{safeT(t, 'home.error_loading', 'Error loading products')}</Text>
```

### ❌ Mistake 4: Not Adding Keys to Translation File
```typescript
// BAD: Using key that doesn't exist
safeT(t, 'new.feature.title', 'New Feature')
// But 'new.feature.title' not in en.json

// GOOD: Add to en.json first, then use
```

---

## Example: Complete Screen Migration

### Before
```typescript
export default function ProductsScreen() {
  const { t } = useTranslation();
  
  if (isLoading) {
    return <Text>{t('loading')}</Text>;
  }
  
  if (error) {
    return <Text>{t('products.error')}</Text>;
  }
  
  if (products.length === 0) {
    return <Text>{t('products.empty')}</Text>;
  }
  
  return (
    <View>
      <Text>{t('products.title')}</Text>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </View>
  );
}
```

### After
```typescript
import { safeT } from '../utils/safeTranslate';

export default function ProductsScreen() {
  const { t } = useTranslation();
  
  if (isLoading) {
    return <Text>{safeT(t, 'common.loading', 'Loading...')}</Text>;
  }
  
  if (error) {
    return <Text>{safeT(t, 'products.error_loading', 'Failed to load products')}</Text>;
  }
  
  if (products.length === 0) {
    return <Text>{safeT(t, 'products.empty_title', 'No products available')}</Text>;
  }
  
  return (
    <View>
      <Text>{safeT(t, 'products.title', 'Products')}</Text>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </View>
  );
}
```

---

## Automated Migration Script (Optional)

For large codebases, consider creating a script to automate the migration:

```bash
# Find all t() usage
grep -r "t('" apps/customer-app/src/screens/

# Replace pattern (manual review recommended)
# t('key') → safeT(t, 'key', 'Fallback')
```

---

## Support

For questions or issues:
1. Check `I18N_AUDIT_REPORT.md` for overview
2. Review `apps/customer-app/src/utils/safeTranslate.ts` for implementation
3. See test file for usage examples: `apps/customer-app/src/utils/__tests__/safeTranslate.test.ts`

---

## Summary

✅ **Always use `safeT()` for translations**  
✅ **Provide meaningful fallbacks**  
✅ **Add keys to translation file first**  
✅ **Test with missing translations**  
✅ **Never display raw translation keys**

---

**Status**: Ready for implementation  
**Priority**: High (prevents UI bugs)  
**Effort**: Low (simple find-and-replace pattern)
