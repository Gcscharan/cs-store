# i18n Quick Reference Card

**Last Updated**: 2026-04-05

---

## 🚀 Quick Start

### Import
```typescript
import { safeT } from '../utils/safeTranslate';
import { useTranslation } from 'react-i18next';
```

### Basic Usage
```typescript
const { t } = useTranslation();

// Simple translation
<Text>{safeT(t, 'home.title', 'Home')}</Text>

// With interpolation
<Text>{safeT(t, 'welcome.message', 'Welcome!')}</Text>
```

---

## 📖 Common Patterns

### Error Messages
```typescript
safeT(t, 'error.loading', 'Failed to load')
safeT(t, 'error.network', 'Network error')
safeT(t, 'error.unknown', 'Something went wrong')
```

### Empty States
```typescript
safeT(t, 'cart.empty', 'Your cart is empty')
safeT(t, 'orders.no_orders', 'No orders yet')
safeT(t, 'products.no_results', 'No products found')
```

### Actions
```typescript
safeT(t, 'common.save', 'Save')
safeT(t, 'common.cancel', 'Cancel')
safeT(t, 'common.retry', 'Try Again')
safeT(t, 'common.refresh', 'Refresh')
```

### Loading States
```typescript
safeT(t, 'common.loading', 'Loading...')
safeT(t, 'common.please_wait', 'Please wait')
```

---

## 🎯 Key Naming Convention

### Pattern: `section.context_action`

```typescript
// ✅ Good
'home.error_loading'
'cart.empty_title'
'orders.no_orders_desc'
'auth.login_failed'

// ❌ Bad
'homeErrorLoading'
'err1'
'msg'
```

### Common Prefixes
- `error_*` → Error messages
- `no_*` → Empty states
- `empty_*` → Empty states
- `loading_*` → Loading states
- `success_*` → Success messages

---

## 🔧 API Reference

### `safeT(t, key, fallback)`
Safe translation with fallback.

```typescript
safeT(t, 'home.title', 'Home')
// Returns: Translated text or 'Home'
```

### `safeTWithOptions(t, key, options)`
Safe translation with interpolation.

```typescript
safeTWithOptions(t, 'welcome.message', {
  name: 'John',
  fallback: 'Welcome!'
})
// Returns: "Welcome, John!" or 'Welcome!'
```

### `checkMissingTranslations(t, keys)`
Check for missing translations.

```typescript
const missing = checkMissingTranslations(t, [
  'home.title',
  'cart.empty'
]);
// Returns: Array of missing keys
```

---

## ✅ Checklist

### Before Using a Translation Key
- [ ] Key exists in `packages/i18n/src/locales/en.json`
- [ ] Key follows naming convention
- [ ] Fallback text is meaningful
- [ ] Using `safeT()` instead of direct `t()`

### Before Committing
- [ ] Run `npm run validate:i18n`
- [ ] All translations exist
- [ ] No raw keys in UI
- [ ] Tests pass

---

## 🚨 Common Mistakes

### ❌ Don't
```typescript
// No fallback
t('key')

// Hardcoded text
<Text>Error loading</Text>

// Wrong key format
t('HomeErrorLoading')

// Using non-existent key
safeT(t, 'new.key', 'Text')  // Key not in en.json
```

### ✅ Do
```typescript
// With fallback
safeT(t, 'key', 'Fallback')

// Translatable
<Text>{safeT(t, 'error.loading', 'Error loading')}</Text>

// Correct format
safeT(t, 'home.error_loading', 'Error')

// Add key first, then use
// 1. Add to en.json
// 2. Use in code
```

---

## 🛠️ Commands

```bash
# Validate translations
npm run validate:i18n

# Show statistics
npm run validate:i18n --stats

# Run tests
npm test -- safeTranslate.test.ts
```

---

## 📁 File Locations

### Translation Files
- `packages/i18n/src/locales/en.json`
- `packages/i18n/src/locales/hi.json`
- `packages/i18n/src/locales/te.json`

### Utility
- `apps/customer-app/src/utils/safeTranslate.ts`

### Config
- `apps/customer-app/src/i18n/index.ts`

---

## 💡 Tips

1. **Always provide fallbacks**
   ```typescript
   safeT(t, 'key', 'Meaningful fallback')
   ```

2. **Use common keys for repeated text**
   ```typescript
   safeT(t, 'common.loading', 'Loading...')
   ```

3. **Group related translations**
   ```json
   {
     "cart": {
       "title": "Cart",
       "empty": "Empty",
       "checkout": "Checkout"
     }
   }
   ```

4. **Test with missing translations**
   - Remove key temporarily
   - Verify fallback displays

---

## 🆘 Troubleshooting

### Raw key displayed
1. Check if key exists in en.json
2. Add missing key
3. Restart app

### Translation not updating
1. Clear cache
2. Restart Metro
3. Reload app

### Validation fails
1. Check Node.js installed
2. Run `npm install`
3. Check file paths

---

## 📚 Documentation

- `I18N_AUDIT_REPORT.md` - Complete audit
- `I18N_MIGRATION_GUIDE.md` - Migration guide
- `I18N_IMPLEMENTATION_SUMMARY.md` - Summary
- `I18N_BEFORE_AFTER.md` - Before/after comparison

---

## 🎯 Remember

> **Always use `safeT()` with meaningful fallbacks**  
> **Never display raw translation keys to users**  
> **Validate before committing**

---

**Print this card and keep it handy! 📌**
