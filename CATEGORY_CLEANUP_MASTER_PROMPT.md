# MASTER PROMPT — SAFE PRODUCT CLEANUP (FINAL)

**Copy this into Kiro when you want to run or re-run cleanup safely.**

---

## 🧠 CONTEXT

We have a production system with strict category standardization.

**Only these backend categories are valid:**
```
chocolates, biscuits, snacks, beverages, hot_snacks, ladoos, cakes
```

**Products outside this set must be:**
- ✅ Migrated (preferred)
- ✅ Or safely soft-deleted (if unused)

**System already supports:**
- Soft delete (deletedAt)
- Order protection
- Cart protection
- Dry run mode
- Observability/logging

---

## 🎯 OBJECTIVE

Clean the database WITHOUT breaking:
- Orders
- Active carts
- Sellable inventory

---

## ⚠️ RULES (STRICT)

**NEVER:**
- ❌ Never hard delete immediately
- ❌ Never touch products used in orders
- ❌ Never delete products in carts
- ❌ Never run without backup

**ALWAYS:**
- ✅ Always run ANALYZE first
- ✅ Always run DRY RUN before execution
- ✅ Prefer migration over deletion

---

## 🔹 STEP 1: BACKUP (MANDATORY)

```bash
mongodump --uri="$MONGO_URI" --out=backup/pre-cleanup-$(date +%Y%m%d)
```

---

## 🔹 STEP 2: ANALYZE CURRENT STATE

```bash
cd backend
npm run analyze:products
```

**Review output carefully:**
- Total invalid products
- Used in orders (CRITICAL)
- In carts (SKIP)
- Safe to delete

---

## 🔹 STEP 3: CHOOSE STRATEGY

### ✅ OPTION A — SAFE (RECOMMENDED)
**👉 Preserve everything**

```bash
# Dry run first
npm run migrate:categories

# Execute
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories
```

**Benefits:**
- ✔ Keeps all products
- ✔ Fixes categories
- ✔ Zero business loss

---

### ⚖️ OPTION B — BALANCED
**👉 Clean unused, keep important**

```bash
# Step 1: Migrate important products
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories

# Step 2: Delete unused products
DRY_RUN=false npm run cleanup:products
```

**Benefits:**
- ✔ Keeps order-related data
- ✔ Removes clutter

---

### 🔥 OPTION C — AGGRESSIVE CLEANUP
**👉 Only unused products**

```bash
# Dry run first (MANDATORY)
npm run cleanup:products

# Execute
DRY_RUN=false npm run cleanup:products
```

**Benefits:**
- ✔ Maximum cleanup
- ⚠ Only if analysis confirms safe

---

## 🔹 STEP 4: VALIDATE

```bash
npm run validate:categories
```

**Expected:**
```
✅ Validation passed! All active products have valid categories
```

---

## 🔹 STEP 5: MONITOR (IMPORTANT)

**Watch logs for:**
```
[Category] Unmapped backend category
```

**If seen:**
1. Fix mapping
2. Re-run migration

---

## 🔹 STEP 6: OPTIONAL HARD DELETE (AFTER STABILITY)

**After 3–7 days:**

```javascript
// MongoDB shell
db.products.deleteMany({ deletedAt: { $ne: null } })
```

---

## 🔄 ROLLBACK PLAN

### Undo Soft Delete
```javascript
db.products.updateMany(
  { deletedAt: { $ne: null } },
  { $set: { deletedAt: null, isActive: true, isSellable: true } }
)
```

### Full Rollback
```bash
mongorestore --uri="$MONGO_URI" --drop backup/pre-cleanup-YYYYMMDD
```

---

## 🧠 DECISION GUIDE

| Situation | What to do |
|-----------|------------|
| You want safety | ✅ Migrate |
| You want clean DB | ⚖️ Migrate + Delete |
| You want aggressive cleanup | 🔥 Delete unused |
| You're unsure | 👉 ALWAYS migrate |

---

## 💡 FINAL ENGINEERING ADVICE

You built an observable, controlled system.

So your cleanup should follow the same philosophy:

> **"Preserve value, remove risk, never destroy blindly"**

---

## 🏁 FINAL STATE AFTER CLEANUP

```
✅ All products use valid categories
✅ No invisible inventory
✅ No broken orders
✅ No cart issues
✅ System remains observable
✅ Fully reversible
```

---

## 🚀 YOU'RE READY

This is:
- Production-safe
- Reusable
- Team-friendly
- Scalable

---

## 🔥 NEXT LEVEL (OPTIONAL)

If you want next level:

**👉 say "automate this cleanup in CI/CD"**

I'll help you make this run safely before every deployment.

---

## 📋 QUICK REFERENCE

### Analysis
```bash
npm run analyze:products
```

### Migration (Safe)
```bash
DRY_RUN=false AUTO_MIGRATE=true npm run migrate:categories
```

### Cleanup (Aggressive)
```bash
DRY_RUN=false npm run cleanup:products
```

### Validation
```bash
npm run validate:categories
```

### Rollback
```javascript
db.products.updateMany(
  { deletedAt: { $ne: null } },
  { $set: { deletedAt: null, isActive: true, isSellable: true } }
)
```

---

## 🎯 SUCCESS CHECKLIST

**Before Cleanup:**
- [ ] Database backup created
- [ ] Analysis script run
- [ ] Strategy chosen
- [ ] Dry run reviewed
- [ ] Team notified (if production)

**After Cleanup:**
- [ ] Validation passed
- [ ] No errors in logs
- [ ] Category filtering works
- [ ] Admin workflows functional
- [ ] Monitoring active
- [ ] Team notified of completion

---

**Status**: Production-Ready ✅  
**Safety Level**: Maximum 🛡️  
**Reversibility**: 100% 🔄  
**Team-Friendly**: Yes 👥  

---

**Created**: Context Transfer Session  
**Last Updated**: Final Implementation  
**Version**: 1.0.0

