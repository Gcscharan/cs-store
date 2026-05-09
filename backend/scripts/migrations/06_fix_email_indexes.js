/**
 * Migration: Fix Email Indexes for Production Safety
 * 
 * CRITICAL: This migration fixes dangerous unique email constraints
 * that will cause crashes when multiple users have null email values.
 * 
 * Run this BEFORE deploying email removal changes.
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  process.exit(1);
}

async function runMigration() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    
    // 1. VALIDATE NO DUPLICATE EMAILS (MUST BE FIRST - FAIL FAST)
    console.log('\n🔍 Step 1: Validating no duplicate emails (CRITICAL)...');
    const duplicateEmails = await db.collection('users').aggregate([
      { $match: { email: { $exists: true, $ne: null, $ne: "" } } },
      { $group: { _id: "$email", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    if (duplicateEmails.length > 0) {
      console.error('❌ CRITICAL: Found duplicate emails:', duplicateEmails);
      console.error('❌ Cannot proceed with migration - fix duplicates manually first');
      console.error('❌ Use this query to find affected users:');
      duplicateEmails.forEach(dup => {
        console.error(`   db.users.find({ email: "${dup._id}" })`);
      });
      process.exit(1);
    } else {
      console.log('✅ No duplicate emails found - safe to proceed');
    }
    
    // 2. VALIDATE PHONE UNIQUENESS (CRITICAL)
    console.log('\n🔍 Step 2: Validating phone uniqueness...');
    const duplicatePhones = await db.collection('users').aggregate([
      { $match: { phone: { $exists: true, $ne: null, $ne: "" } } },
      { $group: { _id: "$phone", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    if (duplicatePhones.length > 0) {
      console.error('❌ CRITICAL: Found duplicate phone numbers:', duplicatePhones);
      console.error('❌ Cannot proceed with migration - fix duplicates manually first');
      console.error('❌ Use this query to find affected users:');
      duplicatePhones.forEach(dup => {
        console.error(`   db.users.find({ phone: "${dup._id}" })`);
      });
      process.exit(1);
    } else {
      console.log('✅ No duplicate phones found - safe to proceed');
    }
    
    // 3. DROP DANGEROUS UNIQUE EMAIL INDEX
    console.log('\n🔥 Step 3: Dropping dangerous unique email index...');
    try {
      await db.collection('users').dropIndex('email_1');
      console.log('✅ Dropped email_1 index');
    } catch (error) {
      if (error.message.includes('index not found')) {
        console.log('ℹ️  email_1 index not found (already dropped)');
      } else {
        console.error('❌ Error dropping email_1 index:', error.message);
      }
    }
    
    // 4. CLEAN INVALID EMAIL DATA (BEFORE INDEX CREATION)
    console.log('\n🧹 Step 4: Cleaning invalid email data...');
    const emptyEmailResult = await db.collection('users').updateMany(
      { email: "" },
      { $unset: { email: "" } }
    );
    console.log(`✅ Cleaned ${emptyEmailResult.modifiedCount} users with empty email strings`);
    
    const nullEmailResult = await db.collection('users').updateMany(
      { email: null },
      { $unset: { email: "" } }
    );
    console.log(`✅ Cleaned ${nullEmailResult.modifiedCount} users with null emails`);
    
    // 5. CREATE SAFE SPARSE UNIQUE EMAIL INDEX (AFTER CLEANING)
    console.log('\n🛡️  Step 5: Creating safe sparse unique email index...');
    try {
      await db.collection('users').createIndex(
        { email: 1 },
        { 
          unique: true, 
          sparse: true,
          name: 'email_1_sparse'
        }
      );
      console.log('✅ Created sparse unique email index');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('ℹ️  Sparse email index already exists');
      } else {
        console.error('❌ Error creating sparse email index:', error.message);
        throw error;
      }
    }
    
    // 6. ENSURE PHONE UNIQUE INDEX EXISTS (CRITICAL)
    console.log('\n🔐 Step 6: Ensuring phone unique index exists...');
    const userIndexes = await db.collection('users').indexes();
    const hasPhoneUniqueIndex = userIndexes.some(index => 
      index.key && index.key.phone === 1 && index.unique === true
    );
    
    if (!hasPhoneUniqueIndex) {
      console.log('⚠️  Phone unique index missing - creating now...');
      try {
        await db.collection('users').createIndex(
          { phone: 1 },
          { unique: true, name: 'phone_1_unique' }
        );
        console.log('✅ Created phone unique index');
      } catch (error) {
        if (error.message.includes('duplicate key')) {
          console.error('❌ CRITICAL: Cannot create phone unique index - duplicates exist');
          console.error('❌ This should have been caught in Step 2');
          throw error;
        } else if (error.message.includes('already exists')) {
          console.log('ℹ️  Phone unique index already exists');
        } else {
          throw error;
        }
      }
    } else {
      console.log('✅ Phone unique index already exists');
    }
    
    // 7. FIX OTP MODEL INDEXES
    console.log('\n📦 Step 4: Fixing OTP model indexes...');
    try {
      // Check if email index exists on OTP collection
      const otpIndexes = await db.collection('otps').indexes();
      const hasEmailIndex = otpIndexes.some(index => 
        index.key && index.key.email === 1
      );
      
      if (hasEmailIndex) {
        // Make OTP email index sparse too
        await db.collection('otps').dropIndex({ email: 1, type: 1, isUsed: 1 });
        await db.collection('otps').createIndex(
          { email: 1, type: 1, isUsed: 1 },
          { sparse: true, name: 'email_type_isUsed_sparse' }
        );
        console.log('✅ Updated OTP email index to sparse');
      } else {
        console.log('ℹ️  No email index found on OTP collection');
      }
    } catch (error) {
      console.log('⚠️  OTP index update failed (may not exist):', error.message);
    }
    
    // 8. VERIFY FINAL STATE
    console.log('\n🔍 Step 8: Verifying final index state...');
    const finalUserIndexes = await db.collection('users').indexes();
    console.log('📋 User collection indexes:');
    finalUserIndexes.forEach(index => {
      console.log(`   - ${index.name}: ${JSON.stringify(index.key)} ${index.unique ? '(unique)' : ''} ${index.sparse ? '(sparse)' : ''}`);
    });
    
    // Verify critical indexes exist
    const hasEmailSparseUnique = finalUserIndexes.some(index => 
      index.key && index.key.email === 1 && index.unique === true && index.sparse === true
    );
    const hasPhoneUnique = finalUserIndexes.some(index => 
      index.key && index.key.phone === 1 && index.unique === true
    );
    
    if (!hasEmailSparseUnique) {
      console.error('❌ CRITICAL: Email sparse unique index not found');
      process.exit(1);
    }
    if (!hasPhoneUnique) {
      console.error('❌ CRITICAL: Phone unique index not found');
      process.exit(1);
    }
    
    console.log('✅ All critical indexes verified');
    
    // 9. FINAL DUPLICATE CHECK (PARANOID VALIDATION)
    console.log('\n✅ Step 9: Final duplicate validation...');
    const finalDuplicateEmails = await db.collection('users').aggregate([
      { $match: { email: { $exists: true, $ne: null, $ne: "" } } },
      { $group: { _id: "$email", count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    if (finalDuplicateEmails.length > 0) {
      console.error('❌ CRITICAL: Duplicates still exist after migration:', finalDuplicateEmails);
      process.exit(1);
    } else {
      console.log('✅ No duplicate emails found (final check)');
    }
    
    console.log('\n🎉 MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('✅ Database is now safe for email removal deployment');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run migration
console.log('🚀 Starting Email Index Migration...');
console.log('📋 This migration will:');
console.log('   1. Validate no duplicate emails (FAIL FAST)');
console.log('   2. Validate no duplicate phones (FAIL FAST)');
console.log('   3. Drop dangerous unique email index');
console.log('   4. Clean invalid email data');
console.log('   5. Create safe sparse unique email index');
console.log('   6. Ensure phone unique index exists');
console.log('   7. Fix OTP model indexes');
console.log('   8. Verify final state');
console.log('   9. Final duplicate validation');
console.log('');

runMigration();