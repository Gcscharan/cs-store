/**
 * Rollback Script: Payment Idempotency Deployment
 * 
 * This script rolls back the payment idempotency fixes to a previous phase.
 * Use this in case of critical issues during deployment.
 * 
 * Usage:
 *   node scripts/rollback-idempotency-deployment.js --from=2 --to=1
 *   node scripts/rollback-idempotency-deployment.js --from=3 --to=2
 * 
 * WARNING: This script only handles database changes. You must also:
 * 1. Revert code changes (git revert, redeploy)
 * 2. Restart backend services
 * 3. Monitor for issues
 */

const { MongoClient } = require('mongodb');
const readline = require('readline');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is required');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);
const fromArg = args.find(arg => arg.startsWith('--from='));
const toArg = args.find(arg => arg.startsWith('--to='));
const fromPhase = fromArg ? parseInt(fromArg.split('=')[1]) : null;
const toPhase = toArg ? parseInt(toArg.split('=')[1]) : null;

if (!fromPhase || !toPhase || fromPhase < 1 || fromPhase > 4 || toPhase < 0 || toPhase >= fromPhase) {
  console.error('❌ Invalid phases. Usage: node rollback-idempotency-deployment.js --from=<2|3|4> --to=<1|2|3>');
  console.error('   Example: node rollback-idempotency-deployment.js --from=3 --to=2');
  process.exit(1);
}

async function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function rollbackPhase3To2(db) {
  console.log('\n🔄 Rolling back Phase 3 to Phase 2...');
  console.log('=====================================\n');
  
  console.log('📋 Actions:');
  console.log('   1. Database: No changes needed (idempotency key field remains)');
  console.log('   2. Code: Revert enforcement code (make idempotency key optional)');
  console.log('   3. Environment: Set IDEMPOTENCY_KEY_REQUIRED=false');
  console.log('');
  
  console.log('⚠️  MANUAL STEPS REQUIRED:');
  console.log('   1. SSH to production server');
  console.log('   2. Set environment variable: export IDEMPOTENCY_KEY_REQUIRED=false');
  console.log('   3. Restart backend: pm2 restart backend');
  console.log('   4. Verify order creation works without idempotency key');
  console.log('');
  
  return true;
}

async function rollbackPhase2To1(db) {
  console.log('\n🔄 Rolling back Phase 2 to Phase 1...');
  console.log('=====================================\n');
  
  console.log('📋 Actions:');
  console.log('   1. Database: No changes needed (fields and indexes remain)');
  console.log('   2. Code: Revert to Phase 1 code (remove cart hash generation, atomic operations)');
  console.log('');
  
  console.log('⚠️  MANUAL STEPS REQUIRED:');
  console.log('   1. SSH to production server');
  console.log('   2. Revert code: git revert <commit_hash>');
  console.log('   3. Rebuild: npm run build');
  console.log('   4. Restart backend: pm2 reload backend');
  console.log('   5. Verify order creation works');
  console.log('');
  
  return true;
}

async function rollbackPhase4To3(db) {
  console.log('\n🔄 Rolling back Phase 4 to Phase 3...');
  console.log('=====================================\n');
  
  console.log('📋 Actions:');
  console.log('   1. Database: Cart hashes will remain (safe to keep)');
  console.log('   2. Code: Revert cleanup code');
  console.log('');
  
  console.log('⚠️  MANUAL STEPS REQUIRED:');
  console.log('   1. SSH to production server');
  console.log('   2. Revert code: git revert <commit_hash>');
  console.log('   3. Rebuild: npm run build');
  console.log('   4. Restart backend: pm2 reload backend');
  console.log('');
  
  return true;
}

async function rollbackPhase1To0(db) {
  console.log('\n🔄 Rolling back Phase 1 to Phase 0 (pre-deployment)...');
  console.log('=======================================================\n');
  
  const ordersCollection = db.collection('orders');
  
  console.log('⚠️  WARNING: This will drop indexes and may affect performance');
  console.log('');
  
  const confirmed = await askConfirmation('Are you sure you want to drop indexes? (yes/no): ');
  if (!confirmed) {
    console.log('❌ Rollback cancelled');
    return false;
  }
  
  // Drop cart hash index
  console.log('\n🔄 Dropping cart hash index...');
  try {
    await ordersCollection.dropIndex('userId_1_cartHash_1_createdAt_1');
    console.log('✅ Dropped cart hash index');
  } catch (error) {
    if (error.message.includes('index not found')) {
      console.log('ℹ️  Cart hash index not found (already dropped)');
    } else {
      console.error('❌ Error dropping cart hash index:', error.message);
      throw error;
    }
  }
  
  // Drop admin assigned index
  console.log('\n🔄 Dropping admin assigned index...');
  try {
    await ordersCollection.dropIndex('adminAssigned_1');
    console.log('✅ Dropped admin assigned index');
  } catch (error) {
    if (error.message.includes('index not found')) {
      console.log('ℹ️  Admin assigned index not found (already dropped)');
    } else {
      console.error('❌ Error dropping admin assigned index:', error.message);
      throw error;
    }
  }
  
  // Restore old idempotency key index with partial filter
  console.log('\n🔄 Restoring old idempotency key index...');
  try {
    await ordersCollection.dropIndex('userId_1_idempotencyKey_1');
    console.log('✅ Dropped current idempotency key index');
  } catch (error) {
    if (error.message.includes('index not found')) {
      console.log('ℹ️  Idempotency key index not found');
    } else {
      console.error('❌ Error dropping idempotency key index:', error.message);
      throw error;
    }
  }
  
  try {
    await ordersCollection.createIndex(
      { userId: 1, idempotencyKey: 1 },
      {
        unique: true,
        partialFilterExpression: {
          idempotencyKey: { $type: "string" }
        },
        name: 'userId_1_idempotencyKey_1'
      }
    );
    console.log('✅ Restored old idempotency key index (with partial filter)');
  } catch (error) {
    console.error('❌ Error creating old idempotency key index:', error.message);
    throw error;
  }
  
  console.log('\n✅ Database rollback completed');
  console.log('');
  console.log('⚠️  MANUAL STEPS REQUIRED:');
  console.log('   1. SSH to production server');
  console.log('   2. Revert code: git revert <commit_hash>');
  console.log('   3. Rebuild: npm run build');
  console.log('   4. Restart backend: pm2 reload backend');
  console.log('   5. Verify order creation works');
  console.log('');
  
  return true;
}

async function runRollback() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('🚀 Starting Payment Idempotency Deployment Rollback');
    console.log(`📋 Rolling back from Phase ${fromPhase} to Phase ${toPhase}`);
    console.log('');
    
    console.log('⚠️  WARNING: This is a DESTRUCTIVE operation!');
    console.log('⚠️  Make sure you have a database backup before proceeding.');
    console.log('');
    
    const confirmed = await askConfirmation('Do you want to proceed with rollback? (yes/no): ');
    if (!confirmed) {
      console.log('❌ Rollback cancelled');
      process.exit(0);
    }
    
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db();
    
    let success = false;
    
    if (fromPhase === 3 && toPhase === 2) {
      success = await rollbackPhase3To2(db);
    } else if (fromPhase === 2 && toPhase === 1) {
      success = await rollbackPhase2To1(db);
    } else if (fromPhase === 4 && toPhase === 3) {
      success = await rollbackPhase4To3(db);
    } else if (fromPhase === 1 && toPhase === 0) {
      success = await rollbackPhase1To0(db);
    } else {
      console.error(`❌ Unsupported rollback path: Phase ${fromPhase} to Phase ${toPhase}`);
      process.exit(1);
    }
    
    console.log('\n' + '='.repeat(50));
    if (success) {
      console.log('🎉 ROLLBACK COMPLETED!');
      console.log(`✅ Rolled back from Phase ${fromPhase} to Phase ${toPhase}`);
      console.log('');
      console.log('📋 Next Steps:');
      console.log('   1. Complete manual steps listed above');
      console.log('   2. Verify system is working correctly');
      console.log('   3. Monitor for issues');
      console.log('   4. Investigate root cause of rollback');
      console.log('   5. Fix issues before re-deploying');
    } else {
      console.log('❌ ROLLBACK FAILED!');
      console.log('❌ Review logs above for details');
      process.exit(1);
    }
    console.log('='.repeat(50) + '\n');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run rollback
runRollback();
