# Quick Reference: Delete All Users

## Current Database Status
- **Total Users**: 60
- **Active Users**: 54
- **Already Deleted**: 6

### Breakdown
- Customers: 42
- Admins: 1
- Delivery Partners: 11

### Related Data
- Carts: 26
- Notifications: 467
- User Preferences: 0
- Category Preferences: 0
- Active Sessions: 0

## How to Delete All Users

### Step 1: Navigate to Backend
```bash
cd backend
```

### Step 2: Run the Script
```bash
npm run delete:users
```

### Step 3: Confirm Deletion
When prompted:
1. Type **`yes`** (not "y" or "Y") and press Enter
2. Type **`DELETE ALL USERS`** exactly and press Enter

### What Will Happen
✅ **Soft Deleted** (Recoverable):
- 54 active users will be marked as deleted

✅ **Hard Deleted** (Permanent):
- 26 carts
- 467 notifications
- All user preferences
- All user sessions

✅ **Preserved** (Audit Trail):
- All orders
- All payments
- All reviews
- All products

## Safety Features

### Double Confirmation Required
- First: Type "yes" to confirm
- Second: Type "DELETE ALL USERS" to proceed

### Soft Delete Strategy
- Users are marked as `isDeleted: true`
- Can be restored if needed
- Data integrity maintained

### Audit Preservation
- Orders preserved for financial records
- Payments preserved for legal compliance
- Reviews preserved for product insights

## After Deletion

### What to Expect
- Admin user management screen will show no users
- Login attempts will fail (no active users)
- Orders screen will still show historical orders
- Products remain completely unaffected

### How to Restore Users (If Needed)
```javascript
// Run in MongoDB shell or create a restore script
db.users.updateMany(
  { isDeleted: true },
  { 
    $set: { isDeleted: false },
    $unset: { deletedAt: "" }
  }
)

// Reactivate delivery boys
db.deliveryboys.updateMany(
  { isActive: false },
  { $set: { isActive: true } }
)
```

### Creating New Users
After deletion, you can:
1. Create new admin accounts using bootstrap script
2. Allow new customer registrations through the app
3. Add new delivery partners through admin panel

## Troubleshooting

### Script Won't Connect
- Check `.env` file has `MONGODB_URI`
- Verify MongoDB Atlas is accessible
- Check network connectivity

### Accidental Cancellation
- Just run the script again
- No harm done if cancelled

### Need to Cancel Mid-Process
- Press `Ctrl+C` to abort
- Some collections may be partially cleaned
- Re-run to complete the process

## Important Notes

⚠️ **Production Warning**: Never run this on production without explicit approval and backup

✅ **Backup First**: Always backup your database before running deletion scripts

🔒 **Access Control**: Only database administrators should run this script

📊 **Audit Compliance**: Financial and legal records are preserved automatically

🔄 **Reversible**: Soft delete allows restoration if needed

## Quick Commands

```bash
# Delete all users
npm run delete:users

# Delete all products
npm run delete:products

# Seed sample products
npm run seed-products

# Seed pincode data
npm run seed-pincodes
```

## Support

For detailed documentation, see:
- `USER_DELETION_GUIDE.md` - Comprehensive guide
- `USER_DELETION_COMPLETE.md` - Implementation details

---

**Ready to proceed?** Run `npm run delete:users` from the backend directory.
