#!/usr/bin/env node
/**
 * Rollback Script: Phase 3 - Idempotency Key Enforcement
 * 
 * This script reverts the enforcement of mandatory idempotency keys.
 * 
 * WHAT IT DOES:
 * - Sets environment variable to make idempotency key optional
 * - Enables grace period mode
 * - Restarts backend service
 * 
 * WHEN TO USE:
 * - If client adoption is too low (<95%)
 * - If error rate is too high (>5%)
 * - If customer complaints increase
 * - If mobile app has compatibility issues
 * 
 * SAFETY:
 * - Does NOT revert code changes
 * - Does NOT revert schema changes
 * - Only changes runtime behavior
 * - Can be re-enabled after fixing client issues
 * 
 * USAGE:
 *   node backend/scripts/rollback/rollback-phase3-enforcement.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

function executeCommand(command, description) {
  console.log(`\n${description}...`);
  try {
    const output = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    console.log('✅', description, 'completed');
    return output;
  } catch (error) {
    console.error('❌', description, 'failed:', error.message);
    throw error;
  }
}

async function rollbackPhase3() {
  console.log('🔄 Payment Idempotency Rollback - Phase 3 (Enforcement)\n');
  
  try {
    // Confirm rollback
    console.log('⚠️  WARNING: This will rollback Phase 3 enforcement');
    console.log('   - Make idempotency key optional (grace period mode)');
    console.log('   - Server will generate keys for requests without them');
    console.log('   - Requests will be logged for monitoring');
    console.log('');
    
    const answer = await askQuestion('Do you want to proceed? (yes/no): ');
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Rollback cancelled');
      process.exit(0);
    }
    
    console.log('\n🔄 Starting rollback...\n');
    
    // Step 1: Update environment variables
    console.log('1️⃣  Updating environment variables...');
    
    const envPath = path.join(process.cwd(), '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Remove or comment out IDEMPOTENCY_KEY_REQUIRED
    envContent = envContent.replace(
      /^IDEMPOTENCY_KEY_REQUIRED=true/gm,
      '# IDEMPOTENCY_KEY_REQUIRED=true  # Disabled by rollback'
    );
    
    // Add grace period flag
    if (!envContent.includes('IDEMPOTENCY_KEY_GRACE_PERIOD')) {
      envContent += '\n# Phase 3 Rollback - Grace Period Mode\n';
      envContent += 'IDEMPOTENCY_KEY_GRACE_PERIOD=true\n';
    } else {
      envContent = envContent.replace(
        /^# ?IDEMPOTENCY_KEY_GRACE_PERIOD=.*/gm,
        'IDEMPOTENCY_KEY_GRACE_PERIOD=true'
      );
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Environment variables updated');
    
    // Step 2: Show environment changes
    console.log('\n📋 Environment changes:');
    console.log('   IDEMPOTENCY_KEY_REQUIRED: false (commented out)');
    console.log('   IDEMPOTENCY_KEY_GRACE_PERIOD: true');
    
    // Step 3: Restart backend service
    console.log('\n2️⃣  Restarting backend service...');
    
    try {
      // Try PM2 first
      try {
        executeCommand('pm2 reload backend', 'PM2 reload');
      } catch (pm2Error) {
        // Try systemctl
        try {
          executeCommand('sudo systemctl restart backend', 'systemctl restart');
        } catch (systemctlError) {
          console.log('⚠️  Could not detect process manager');
          console.log('Please restart the backend service manually:');
          console.log('   pm2 restart backend');
          console.log('   # or');
          console.log('   sudo systemctl restart backend');
        }
      }
    } catch (error) {
      console.error('❌ Failed to restart backend:', error.message);
      console.log('\nPlease restart manually and verify the new environment variables are loaded');
    }
    
    // Step 4: Verify deployment
    console.log('\n3️⃣  Verifying deployment...');
    
    // Wait for service to start
    console.log('Waiting 5 seconds for service to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if backend is responding
    try {
      const { execSync } = require('child_process');
      const healthUrl = process.env.HEALTH_URL || 'http://localhost:3000/health';
      execSync(`curl -f -s ${healthUrl}`, { stdio: 'pipe' });
      console.log('✅ Backend is responding');
    } catch (error) {
      console.log('⚠️  Backend health check failed');
      console.log('Please check logs manually');
    }
    
    // Step 5: Test order creation without idempotency key
    console.log('\n4️⃣  Testing order creation without idempotency key...');
    console.log('ℹ️  Manual test required:');
    console.log('');
    console.log('   curl -X POST http://localhost:3000/api/orders/create \\');
    console.log('     -H "Authorization: Bearer <token>" \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"paymentMethod":"UPI"}\'');
    console.log('');
    console.log('   Expected: 201 Created (should NOT return 400 error)');
    
    console.log('\n✅ Phase 3 rollback completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Verify backend logs show grace period mode:');
    console.log('      pm2 logs backend --lines 50 | grep "GRACE_PERIOD"');
    console.log('');
    console.log('   2. Test order creation without idempotency key (should succeed)');
    console.log('');
    console.log('   3. Monitor client adoption rate:');
    console.log('      # Prometheus query');
    console.log('      rate(order_creation_with_key_total[5m]) / rate(order_creation_attempts_total[5m]) * 100');
    console.log('');
    console.log('   4. Notify mobile team about extended timeline');
    console.log('');
    console.log('   5. Re-enable enforcement when client adoption >95%:');
    console.log('      - Set IDEMPOTENCY_KEY_REQUIRED=true');
    console.log('      - Remove IDEMPOTENCY_KEY_GRACE_PERIOD');
    console.log('      - Restart backend');
    
  } catch (error) {
    console.error('\n❌ Rollback failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run rollback
rollbackPhase3();
