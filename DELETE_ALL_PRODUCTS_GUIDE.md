# Delete All Products - Safe Execution Guide

## 🚨 WARNING: PERMANENT DELETION

This script **permanently deletes ALL products** from the database.

**Status**: Production-Safe (with safeguards)  
**Reversibility**: Only via database backup  
**Risk Level**: HIGH (breaks orders and carts if products are referenced)

---

## ⚠️ CRITICAL: Read Before Running

### What This Script Does

**Permanently deletes**:
- ✅ All active products
- ✅ All soft-deleted products
- ✅ All product data (images, descriptions, prices, etc.)

**Side Effects**:
- ⚠️ Breaks order history (if products are referenced in orders)
- ⚠️ Breaks active carts (if products are in user carts)
- ⚠️ Cannot be undone (except via backup restore)

---

## 🛡️ Safety Features

### 1. Dry Run Mode (Default)
```bash
npm run delete:products
```
Shows what would be deleted WITHOUT actually deleting

### 2. Force Flag Required
```bash
FORCE=true npm run delete:products
```
Must explicitly set FORCE=true to proceed

### 3. Analysis Before Deletion
Shows:
- Total products
- Active vs soft-deleted
- Products used in orders (WARNING)
- Products in active carts (WARNING)

### 4. Backup Reminder
Reminds you to backup before deletion

### 5. Connection Safety
- Loads .env automatically
- Masks credentials in logs
- Fails fast if URI missing

---

## 📋 Complete Workflow

### Step 1: Backup Database (MANDATORY)

```bash
mongodump --uri="$MONGO_URI" --out=backup/pre-delete-$(date +%Y%m%d)
```

**Why**: This is your ONLY way to restore if something goes wrong.

---

### Step 2: Dry Run (See What Would Be Deleted)

```bash
cd backend
npm run delete:products
```

**Expected Output**:
```
🚨 DELETE ALL PRODUCTS - PERMANENT OPERATION

📊 Analyzing products...

  Total products: 150
  Active products: 145
  Soft-deleted products: 5
  Products referenced in orders: 80
  Products referenced in carts: 12

🧪 DRY RUN MODE - No data will be deleted

What would be deleted:
  - 150 products (all)
  - 145 active products
  - 5 soft-deleted products

⚠️  WARNING: 80 products are referenced in orders
   Deleting these will break order history!

⚠️  WARNING: 12 products are in active carts
   Deleting these will break user carts!

To execute deletion, run:
DRY_RUN=false FORCE=true npm run delete:products
```

---

### Step 3: Review Output Carefully

**Ask yourself**:
1. Do I have a backup? (YES required)
2. Am I okay breaking order history? (Consider implications)
3. Am I okay breaking active carts? (Users will lose cart items)
4. Is this really what I want? (No undo)

---

### Step 4: Execute Deletion (PERMANENT)

```bash
cd backend
DRY_RUN=false FORCE=true npm run delete:products
```

**Expected Output**:
```
🚨 DELETE ALL PRODUCTS - PERMANENT OPERATION

📊 Analyzing products...
  [Analysis output...]

🔥 EXECUTING PERMANENT DELETION

⚠️  WARNING: Deleting 80 products used in orders
   This WILL break order history!

⚠️  WARNING: Deleting 12 products in carts
   This WILL break user carts!

Deleting all products...

✅ Deleted 150 products

Remaining products: 0

✅ All products successfully deleted
```

---

### Step 5: Verify Deletion

```bash
# MongoDB shell or Compass
db.products.countDocuments()
// Should return: 0
```

---

## 🔄 Rollback (Restore from Backup)

If you need to restore:

```bash
mongorestore --uri="$MONGO_URI" --drop backup/pre-delete-YYYYMMDD
```

**Note**: This restores the ENTIRE database to the backup state.

---

## 🚨 Common Scenarios

### Scenario 1: "I want to delete all products and start fresh"

```bash
# 1. Backup
mongodump --uri="$MONGO_URI" --out=backup/pre-delete-$(date +%Y%m%d)

# 2. Dry run
npm run delete:products

# 3. Review output carefully

# 4. Execute
DRY_RUN=false FORCE=true npm run delete:products

# 5. Verify
# Check db.products.countDocuments() = 0
```

---

### Scenario 2: "I want to delete products but keep order history"

**DON'T use this script.**

Instead:
1. Soft-delete all products:
   ```javascript
   db.products.updateMany({}, { $set: { deletedAt: new Date(), isActive: false } })
   ```
2. This preserves order history while hiding products

---

### Scenario 3: "I accidentally deleted all products"

```bash
# Restore from backup
mongorestore --uri="$MONGO_URI" --drop backup/pre-delete-YYYYMMDD
```

---

## ⚠️ Impact Analysis

### What Breaks

**Orders**:
- ❌ Order details will show missing product info
- ❌ Order history becomes incomplete
- ❌ Reports/analytics break

**Carts**:
- ❌ User carts become empty
- ❌ Users lose their cart items
- ❌ Checkout breaks for users with items

**Admin**:
- ❌ Product management screens show no products
- ❌ Inventory reports show zero
- ❌ Category filtering shows no results

**Frontend**:
- ❌ Product listings show empty
- ❌ Search returns no results
- ❌ Category pages show no products

---

### What Doesn't Break

**Users**:
- ✅ User accounts remain intact
- ✅ User authentication works
- ✅ User profiles unchanged

**Orders (structure)**:
- ✅ Order records remain
- ✅ Order status unchanged
- ✅ Payment records intact

**System**:
- ✅ Application continues running
- ✅ No code changes needed
- ✅ Database structure intact

---

## 💡 Alternatives to Consider

### Option 1: Soft Delete All Products
```javascript
// MongoDB shell
db.products.updateMany(
  {},
  { 
    $set: { 
      deletedAt: new Date(),
      isActive: false,
      isSellable: false
    }
  }
)
```

**Benefits**:
- ✅ Preserves order history
- ✅ Reversible (just unset deletedAt)
- ✅ No data loss

---

### Option 2: Delete Unused Products Only
```bash
npm run cleanup:products
```

**Benefits**:
- ✅ Keeps products in orders
- ✅ Keeps products in carts
- ✅ Safer approach

---

### Option 3: Migrate to Valid Categories
```bash
npm run migrate:categories
```

**Benefits**:
- ✅ Fixes invalid categories
- ✅ Preserves all products
- ✅ No data loss

---

## 🎯 When to Use This Script

**Use when**:
- ✅ Starting completely fresh
- ✅ Testing/development environment
- ✅ You have a backup
- ✅ You understand the consequences
- ✅ Order history doesn't matter

**DON'T use when**:
- ❌ You have active orders
- ❌ You have active users
- ❌ You're in production
- ❌ You don't have a backup
- ❌ You're unsure

---

## 📊 Script Behavior

### Dry Run (Default)
```bash
npm run delete:products
```

**Behavior**:
- ✅ Analyzes products
- ✅ Shows what would be deleted
- ✅ Shows warnings
- ❌ Does NOT delete anything

---

### Execute (Requires FORCE)
```bash
DRY_RUN=false FORCE=true npm run delete:products
```

**Behavior**:
- ✅ Analyzes products
- ✅ Shows warnings
- ✅ Deletes ALL products
- ✅ Verifies deletion

---

## 🔍 Troubleshooting

### Issue: "FORCE flag not provided"

**Cause**: Safety check - must explicitly set FORCE=true

**Solution**:
```bash
DRY_RUN=false FORCE=true npm run delete:products
```

---

### Issue: "MONGO_URI not found"

**Cause**: .env not loaded or MONGO_URI not set

**Solution**:
1. Check `.env` file exists in `backend/`
2. Verify `MONGODB_URI` is set
3. Try: `cat backend/.env | grep MONGODB_URI`

---

### Issue: Connection refused

**Cause**: Can't connect to MongoDB

**Solution**:
1. Check MongoDB is running
2. Verify MONGO_URI is correct
3. Check network/firewall

---

## ✅ Success Criteria

After deletion:
- ✅ `db.products.countDocuments()` returns 0
- ✅ Product listings show empty
- ✅ No errors in logs
- ✅ Application still runs

---

## 🏁 Final Checklist

Before running deletion:
- [ ] Database backup created
- [ ] Dry run executed and reviewed
- [ ] Understand order history will break
- [ ] Understand carts will break
- [ ] Have rollback plan ready
- [ ] Team notified (if applicable)
- [ ] Ready to proceed

After deletion:
- [ ] Verified products deleted
- [ ] Application still works
- [ ] No unexpected errors
- [ ] Backup stored safely

---

## 📝 Files

**Script**: `backend/src/scripts/deleteAllProducts.ts`  
**Command**: `npm run delete:products`  
**Documentation**: This file

---

**Status**: Production-Safe (with safeguards) ✅  
**Risk Level**: HIGH ⚠️  
**Reversibility**: Backup only 🔄  
**Use With Caution**: YES 🚨

