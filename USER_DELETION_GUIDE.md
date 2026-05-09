# User Deletion Guide

## Overview

This guide explains how to safely delete all users from the database using the automated deletion script.

## What Gets Deleted

### ✅ Soft Deleted (Recoverable)
- **Users**: All user accounts are soft deleted (sets `isDeleted: true`, `deletedAt: Date`)
  - Customers
  - Admins
  - Delivery Partners

### ✅ Hard Deleted (Permanent)
- **Carts**: All shopping carts
- **Notifications**: All user notifications
- **User Preferences**: Product preference data
- **Category Preferences**: Category preference data
- **User Sessions**: Active login sessions
- **Delivery Boys**: Marked as inactive (not deleted)

### ❌ Preserved (For Audit/Analytics)
- **Orders**: Historical order data (required for financial records)
- **Payments**: Payment transaction records (required by law)
- **Reviews**: Product reviews (valuable for product insights)
- **Products**: Product catalog (unaffected)

## Safety Features

1. **Soft Delete Strategy**: Users are marked as deleted, not permanently removed
2. **Double Confirmation**: Requires two confirmations before proceeding
3. **Statistics Display**: Shows counts before deletion
4. **Audit Trail**: Preserves orders, payments, and reviews
5. **Rollback Possible**: Soft deleted users can be restored if needed

## Usage

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Run the Deletion Script
```bash
npm run delete:users
```

### Step 3: Review Statistics
The script will display:
- Total users count
- Active vs already deleted users
- User breakdown by role (customer, admin, delivery)
- Related data counts (carts, notifications, etc.)

### Step 4: Confirm Deletion
You will be asked two confirmation questions:
1. "Are you sure you want to delete ALL users? (yes/no)"
2. "Type 'DELETE ALL USERS' to confirm"

### Step 5: Verify Results
After completion, the script shows:
- Number of users soft deleted
- Number of delivery boys deactivated
- Counts of deleted related data
- Final statistics

## Example Output

```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB

📊 Current User Statistics:
   Total Users: 150
   Active Users: 145
   Already Deleted: 5

👥 User Breakdown:
   Customers: 120
   Admins: 5
   Delivery Partners: 20

🗂️  Related Data to Clean:
   Carts: 85
   Notifications: 342
   User Preferences: 1250
   Category Preferences: 450
   Active Sessions: 67

⚠️  WARNING: This action will:
   1. Soft delete all active users (set isDeleted: true)
   2. Delete all carts
   3. Delete all notifications
   4. Delete all user preferences
   5. Delete all user sessions
   6. Mark delivery boys as inactive

   Orders, Payments, and Reviews will be PRESERVED for audit.

❓ Are you sure you want to delete ALL users? (yes/no): yes
❓ Type 'DELETE ALL USERS' to confirm: DELETE ALL USERS

🚀 Starting deletion process...

1️⃣  Soft deleting all users...
   ✅ Soft deleted 145 users
2️⃣  Marking delivery boys as inactive...
   ✅ Deactivated 20 delivery boys
3️⃣  Deleting all carts...
   ✅ Deleted 85 carts
4️⃣  Deleting all notifications...
   ✅ Deleted 342 notifications
5️⃣  Deleting all user preferences...
   ✅ Deleted 1250 user preferences
6️⃣  Deleting all category preferences...
   ✅ Deleted 450 category preferences
7️⃣  Deleting all user sessions...
   ✅ Deleted 67 user sessions

📊 Final Statistics:
   Active Users: 0
   Deleted Users: 150
   Remaining Carts: 0
   Remaining Notifications: 0
   Remaining Preferences: 0
   Remaining Sessions: 0

✅ All users deleted successfully!

💡 Note: Orders, Payments, and Reviews have been preserved for audit purposes.
   To permanently delete user records, run a hard delete script (not recommended).

🔌 Disconnected from MongoDB
```

## Cancelling the Operation

You can cancel at any time by:
- Typing "no" when asked for confirmation
- Typing anything other than "DELETE ALL USERS" for the second confirmation
- Pressing Ctrl+C to abort

## Post-Deletion

### What Happens to the Frontend?
- Admin user management screen will show no users
- Login attempts will fail (no active users exist)
- Orders screen will still show historical orders
- Products remain unaffected

### How to Restore Users?
If you need to restore soft-deleted users:

```javascript
// Run this in MongoDB shell or create a restore script
db.users.updateMany(
  { isDeleted: true },
  { 
    $set: { isDeleted: false },
    $unset: { deletedAt: "" }
  }
)
```

### Creating New Users
After deletion, you can:
1. Create new admin accounts using the bootstrap script
2. Allow new customer registrations through the app
3. Add new delivery partners through the admin panel

## Related Scripts

- `npm run delete:products` - Delete all products
- `npm run seed-products` - Seed sample products
- `npm run seed-pincodes` - Seed pincode data

## Technical Details

### Database Collections Affected

| Collection | Action | Recoverable |
|------------|--------|-------------|
| users | Soft delete | ✅ Yes |
| deliveryboys | Mark inactive | ✅ Yes |
| carts | Hard delete | ❌ No |
| notifications | Hard delete | ❌ No |
| userpreferences | Hard delete | ❌ No |
| usercategorypreferences | Hard delete | ❌ No |
| usersessions | Hard delete | ❌ No |
| orders | Preserved | N/A |
| payments | Preserved | N/A |
| reviews | Preserved | N/A |

### Soft Delete Implementation

Users are soft deleted using:
```javascript
{
  isDeleted: true,
  deletedAt: new Date()
}
```

The backend API filters out soft-deleted users:
```javascript
{
  $or: [
    { isDeleted: { $exists: false } },
    { isDeleted: false }
  ]
}
```

## Security Considerations

1. **Backup First**: Always backup your database before running deletion scripts
2. **Production Warning**: Never run this on production without explicit approval
3. **Audit Trail**: Orders and payments are preserved for compliance
4. **Access Control**: Only database administrators should run this script
5. **Confirmation Required**: Double confirmation prevents accidental deletion

## Troubleshooting

### Script Fails to Connect
- Check `MONGO_URI` in `.env` file
- Verify MongoDB is running
- Check network connectivity

### Partial Deletion
- Script is transactional per collection
- If it fails midway, some collections may be cleaned while others aren't
- Re-run the script to complete the process

### Cannot Restore Users
- Check if users have `isDeleted: true` flag
- Use MongoDB Compass or shell to manually update
- Contact database administrator

## Support

For issues or questions:
1. Check the script logs for error messages
2. Verify MongoDB connection
3. Review this documentation
4. Contact the development team

---

**⚠️ WARNING**: This is a destructive operation. Always backup your database before proceeding.
