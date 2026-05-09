# Category Migration Guide - Production Safe

## 🎯 Overview

This guide walks you through safely migrating products with invalid categories to the new standardized category system.

**What this does**:
- ✅ Migrates products to valid categories
- ✅ Preserves order history
- ✅ Soft deletes (reversible)
- ✅ Dry run mode (safe testing)
- ✅ Detailed logging

**What this prevents**:
- ❌ Breaking foreign keys (orders, carts)
- ❌ Losing test data
- ❌ Empty UI states
- ❌ Data loss

---

## 📋 Valid Categories (Final)

After standardization, only these 7 categories are valid:

```javascript
[
  'chocolates',
  'biscuits',
  'snacks',
  'beverages',
  'hot_snacks',
  'ladoos',
  'cakes'
]
```

---

## 🗺️ Migration Strategy

### Smart Category Mapping

Products with invalid categories will be migrated to the best-fit valid category:

| Invalid Category | Migrates To | Reason |
|-----------------|-------------|---------|
| groceries | snacks | General food items |
| vegetables | snacks | Fresh produce |
| fruits | snacks | Fresh produce |
| dairy | beverages | Milk products |
| meat | hot_snacks | Protein items |
| household | snacks | General items |
| personal_care | snacks | General items |
| medicines | snacks | General items |
| electronics | snacks | General items |
| clothing | snacks | General items |
| other | snacks | Catch-all |

**Note**: You can customize these mappings in the script if needed.

---

## 🚀 Migration Modes

### Mode 1: Dry Run (Recommended First)
**What it does**: Shows what WOULD happen without making changes

```bash
# Default mode - safe to run anytime
npm run migrate:categories
```

**Output**:
```
[DRY RUN] Would migrate: "Product A" (groceries → snacks)
[DRY RUN] Would migrate: "Product B" (dairy → beverages)
```

### Mode 2: Auto-Migrate
**What it does**: Automatically migrates all products to valid categories

```bash
# Migrate all products
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories
```

**Use when**: You trust the migration mappings and want to migrate everything

### Mode 3: Soft Delete Unused
**What it does**: Soft deletes products NOT used in orders

```bash
# Soft delete unused products with invalid categories
DRY_RUN=false SOFT_DELETE_UNUSED=true npm run migrate:categories
```

**Use when**: You want to remove unused products instead of migrating them

---

## 📝 Step-by-Step Migration Process

### Step 1: Backup Database (MANDATORY)

```bash
# Create backup before any changes
mongodump --uri="$MONGO_URI" --out=backup/pre-category-migration-$(date +%Y%m%d)
```

**Why**: Allows complete rollback if needed

---

### Step 2: Check Current State

```bash
# Connect to MongoDB
mongo $MONGO_URI

# Check invalid categories
db.products.aggregate([
  { $match: { 
      category: { $nin: ['chocolates', 'biscuits', 'snacks', 'beverages', 'hot_snacks', 'ladoos', 'cakes'] },
      deletedAt: null 
  }},
  { $group: { _id: '$category', count: { $sum: 1 } }},
  { $sort: { count: -1 }}
])
```

**Expected output**:
```javascript
{ "_id": "groceries", "count": 45 }
{ "_id": "vegetables", "count": 23 }
{ "_id": "dairy", "count": 12 }
// ... etc
```

---

### Step 3: Run Dry Run

```bash
cd backend
npm run migrate:categories
```

**Review the output carefully**:
- Check which products will be migrated
- Verify migration targets make sense
- Note any products used in orders (must be migrated)

---

### Step 4: Execute Migration

**Option A: Auto-Migrate All** (Recommended)
```bash
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories
```

**Option B: Soft Delete Unused**
```bash
DRY_RUN=false SOFT_DELETE_UNUSED=true npm run migrate:categories
```

**Option C: Hybrid Approach**
```bash
# First migrate products used in orders
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories

# Then soft delete remaining unused products
DRY_RUN=false SOFT_DELETE_UNUSED=true npm run migrate:categories
```

---

### Step 5: Validate Results

```bash
# Check for remaining invalid categories
mongo $MONGO_URI

db.products.countDocuments({
  category: { $nin: ['chocolates', 'biscuits', 'snacks', 'beverages', 'hot_snacks', 'ladoos', 'cakes'] },
  deletedAt: null
})

# Should return: 0
```

---

### Step 6: Test in UI

1. Open mobile app
2. Navigate to Categories
3. Verify all 10 categories display correctly
4. Test filtering for each category
5. Verify products appear in correct categories
6. Test admin product creation/editing

---

## 🔧 Script Configuration

### Environment Variables

```bash
# Dry run mode (default: true for safety)
DRY_RUN=false

# Auto-migrate all products (default: false)
AUTO_MIGRATE=true

# Soft delete unused products (default: false)
SOFT_DELETE_UNUSED=true

# MongoDB connection
MONGO_URI=mongodb://localhost:27017/your-database
```

### NPM Scripts

Add to `backend/package.json`:

```json
{
  "scripts": {
    "migrate:categories": "ts-node src/scripts/migrateInvalidCategories.ts",
    "migrate:categories:dry": "DRY_RUN=true ts-node src/scripts/migrateInvalidCategories.ts",
    "migrate:categories:auto": "DRY_RUN=false AUTO_MIGRATE=true ts-node src/scripts/migrateInvalidCategories.ts",
    "migrate:categories:delete": "DRY_RUN=false SOFT_DELETE_UNUSED=true ts-node src/scripts/migrateInvalidCategories.ts"
  }
}
```

---

## 🛡️ Safety Features

### 1. Order Protection
```typescript
// Products used in orders MUST be migrated (never deleted)
const usedInOrders = await Order.countDocuments({
  'items.productId': productId
});

if (usedInOrders) {
  // Force migration, skip deletion
}
```

### 2. Soft Delete (Reversible)
```typescript
// Soft delete sets deletedAt, doesn't remove from DB
await Product.updateOne(
  { _id: productId },
  { 
    $set: { 
      deletedAt: new Date(),
      isActive: false,
      isSellable: false
    }
  }
);
```

### 3. Dry Run Mode
```typescript
if (options.dryRun) {
  console.log('[DRY RUN] Would migrate: ...');
  return; // No changes made
}
```

---

## 🔄 Rollback Procedures

### Rollback Migration

```bash
# Restore from backup
mongorestore --uri="$MONGO_URI" --drop backup/pre-category-migration-YYYYMMDD
```

### Undo Soft Deletes

```bash
# Restore soft-deleted products
mongo $MONGO_URI

db.products.updateMany(
  { deletedAt: { $ne: null } },
  { 
    $set: { 
      deletedAt: null,
      isActive: true,
      isSellable: true
    }
  }
)
```

### Revert Specific Product

```bash
# Revert single product to original category
db.products.updateOne(
  { _id: ObjectId('product_id') },
  { $set: { category: 'original_category' }}
)
```

---

## 📊 Expected Results

### Before Migration
```
Total Products: 500
Invalid Categories: 150
  - groceries: 45
  - vegetables: 23
  - dairy: 12
  - other: 70
```

### After Migration (Auto-Migrate)
```
Total Products: 500
Invalid Categories: 0
Migrated: 150
  - groceries → snacks: 45
  - vegetables → snacks: 23
  - dairy → beverages: 12
  - other → snacks: 70
```

### After Migration (Soft Delete Unused)
```
Total Active Products: 380
Soft Deleted: 120
Invalid Categories: 0
Migrated (used in orders): 30
```

---

## ⚠️ Common Issues & Solutions

### Issue 1: "No migration mapping found"
**Cause**: Product has category not in CATEGORY_MIGRATION_MAP  
**Solution**: Add mapping to script or manually update product

### Issue 2: "Product is used in orders"
**Cause**: Product cannot be deleted (has order history)  
**Solution**: Product will be auto-migrated (this is correct behavior)

### Issue 3: "Connection timeout"
**Cause**: Large dataset, slow connection  
**Solution**: Increase timeout or process in batches

---

## 🧪 Testing Checklist

### Pre-Migration Testing
- [ ] Backup created successfully
- [ ] Dry run completed without errors
- [ ] Migration targets reviewed and approved
- [ ] Order dependencies identified

### Post-Migration Testing
- [ ] No invalid categories remain
- [ ] All products visible in UI
- [ ] Category filtering works
- [ ] Admin workflows functional
- [ ] Order history intact
- [ ] No broken foreign keys

---

## 📈 Monitoring

### During Migration
```bash
# Watch migration progress
tail -f migration.log

# Monitor database
watch -n 1 'mongo $MONGO_URI --eval "db.products.countDocuments({deletedAt: null})"'
```

### After Migration
```bash
# Check category distribution
db.products.aggregate([
  { $match: { deletedAt: null }},
  { $group: { _id: '$category', count: { $sum: 1 }}},
  { $sort: { count: -1 }}
])
```

---

## 🎯 Success Criteria

### Migration Success
- ✅ Zero products with invalid categories
- ✅ All orders intact
- ✅ UI displays all categories correctly
- ✅ Admin workflows functional
- ✅ No user-reported issues

### Validation Queries
```javascript
// Should return 0
db.products.countDocuments({
  category: { $nin: ['chocolates', 'biscuits', 'snacks', 'beverages', 'hot_snacks', 'ladoos', 'cakes'] },
  deletedAt: null
})

// Should return total active products
db.products.countDocuments({ deletedAt: null })

// Should show only valid categories
db.products.distinct('category', { deletedAt: null })
```

---

## 💡 Best Practices

### 1. Always Start with Dry Run
```bash
# Safe - shows what would happen
npm run migrate:categories
```

### 2. Backup Before Changes
```bash
# Create timestamped backup
mongodump --uri="$MONGO_URI" --out=backup/$(date +%Y%m%d-%H%M%S)
```

### 3. Migrate in Stages
```bash
# Stage 1: Migrate products used in orders
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories

# Stage 2: Review and soft delete unused
DRY_RUN=false SOFT_DELETE_UNUSED=true npm run migrate:categories
```

### 4. Validate After Each Stage
```bash
# Check results after each migration
npm run migrate:categories:validate
```

---

## 🚀 Alternative: Manual Migration

If you prefer manual control:

```javascript
// Update specific products
db.products.updateMany(
  { category: 'groceries', deletedAt: null },
  { $set: { category: 'snacks' }}
)

// Verify
db.products.countDocuments({ category: 'groceries', deletedAt: null })
// Should return: 0
```

---

## 📞 Support

### If Migration Fails
1. **Don't panic** - soft deletes are reversible
2. **Check logs** - review error messages
3. **Restore backup** - if needed
4. **Contact team** - for assistance

### Rollback Command
```bash
# Full rollback
mongorestore --uri="$MONGO_URI" --drop backup/pre-category-migration-YYYYMMDD
```

---

## ✅ Final Checklist

Before deploying category system:
- [ ] Database backup created
- [ ] Dry run completed successfully
- [ ] Migration executed (auto-migrate or soft-delete)
- [ ] Validation passed (0 invalid categories)
- [ ] UI testing completed
- [ ] Admin workflows tested
- [ ] Order history verified
- [ ] Rollback procedure documented

---

**Migration Script**: `backend/src/scripts/migrateInvalidCategories.ts`  
**Created**: Context Transfer Session  
**Status**: Production-Ready
