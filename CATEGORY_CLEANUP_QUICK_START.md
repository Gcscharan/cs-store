# Category Cleanup - Quick Start Guide

## 🚀 TL;DR - Safe Product Cleanup

**Goal**: Remove or migrate products with invalid categories  
**Safety**: Maximum (Order Protection + Soft Delete + Dry Run)  
**Time**: 15-45 minutes

---

## ⚡ Quick Commands

### 1. Analyze (ALWAYS RUN FIRST)
```bash
cd backend
npm run analyze:products
```

### 2. Migrate Everything (RECOMMENDED)
```bash
# Dry run
npm run migrate:categories

# Execute
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories
```

### 3. Delete Unused Only
```bash
# Dry run
npm run cleanup:products

# Execute
DRY_RUN=false npm run cleanup:products
```

### 4. Validate
```bash
npm run validate:categories
```

---

## 🎯 Valid Categories

Only these 7 backend categories are valid:
```
chocolates, biscuits, snacks, beverages, hot_snacks, ladoos, cakes
```

---

## 🛡️ Safety Guarantees

✅ **NEVER deletes products used in orders**  
✅ **NEVER deletes products in active carts**  
✅ **NEVER hard deletes** (always soft delete)  
✅ **Dry run by default** (must explicitly execute)  
✅ **100% reversible** (can undo everything)

---

## 📋 Complete Workflow

### Step 1: Backup (MANDATORY)
```bash
mongodump --uri="$MONGO_URI" --out=backup/pre-cleanup-$(date +%Y%m%d)
```

### Step 2: Analyze
```bash
cd backend
npm run analyze:products
```

**Look for**:
- Total products with invalid categories
- Products used in orders (MUST migrate)
- Products in carts (review needed)
- Products safe to delete

### Step 3: Choose Strategy

**Option A: Migrate Everything** (Preserves all inventory)
```bash
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories
```

**Option B: Migrate Orders + Delete Unused** (Clean database)
```bash
# Migrate products in orders
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories

# Delete unused products
DRY_RUN=false npm run cleanup:products
```

**Option C: Delete Everything Unused** (Aggressive)
```bash
DRY_RUN=false npm run cleanup:products
```

### Step 4: Validate
```bash
npm run validate:categories
```

**Expected**: `✅ Validation passed! All active products have valid categories.`

---

## 🔄 Rollback

### Undo Soft Deletes
```javascript
db.products.updateMany(
  { deletedAt: { $ne: null } },
  { $set: { deletedAt: null, isActive: true, isSellable: true } }
)
```

### Undo Migrations
```bash
mongorestore --uri="$MONGO_URI" --drop backup/pre-cleanup-YYYYMMDD
```

---

## 📊 What Each Script Does

### `analyze:products` (Read-Only)
- Shows what would be affected
- Makes NO changes
- Provides recommendations

### `migrate:categories` (Smart Migration)
- Migrates invalid → valid categories
- Protects order history
- Preserves inventory

### `cleanup:products` (Soft Delete)
- Soft-deletes unused products
- Skips products in orders/carts
- Skips products with stock

---

## 💡 Pro Tips

1. **Always backup first** - Takes 2 minutes, saves hours
2. **Always dry run first** - See what would happen
3. **Prefer migration over deletion** - Preserves revenue
4. **Validate after changes** - Confirms success
5. **Monitor for a week** - Catch any edge cases

---

## 🚨 Common Scenarios

### Scenario 1: "I want to clean everything safely"
```bash
# Backup
mongodump --uri="$MONGO_URI" --out=backup/pre-cleanup-$(date +%Y%m%d)

# Analyze
npm run analyze:products

# Migrate everything
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories

# Validate
npm run validate:categories
```

### Scenario 2: "I want to delete unused products"
```bash
# Backup
mongodump --uri="$MONGO_URI" --out=backup/pre-cleanup-$(date +%Y%m%d)

# Analyze
npm run analyze:products

# Migrate products in orders
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories

# Delete unused
DRY_RUN=false npm run cleanup:products

# Validate
npm run validate:categories
```

### Scenario 3: "I made a mistake, need to rollback"
```bash
# Restore from backup
mongorestore --uri="$MONGO_URI" --drop backup/pre-cleanup-YYYYMMDD
```

---

## 📚 Full Documentation

- **Complete Guide**: `CATEGORY_CLEANUP_GUIDE.md`
- **Implementation Details**: `CATEGORY_CLEANUP_COMPLETE.md`
- **Category System**: `CATEGORY_SYSTEM_FINAL_SUMMARY.md`

---

## ✅ Checklist

Before running cleanup:
- [ ] Database backup created
- [ ] Analysis script run
- [ ] Strategy chosen
- [ ] Dry run reviewed
- [ ] Ready to execute

After cleanup:
- [ ] Validation passed
- [ ] No errors in logs
- [ ] Category filtering works
- [ ] Admin workflows functional
- [ ] Monitoring active

---

**Status**: Production-Ready ✅  
**Safety**: Maximum 🛡️  
**Time**: 15-45 minutes ⏱️

