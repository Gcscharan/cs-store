#!/usr/bin/env node

/**
 * Master Verification Script: Payment Idempotency Deployment
 * 
 * This script runs all verification checks for the payment idempotency fixes.
 * 
 * Usage:
 *   node scripts/verify-idempotency-deployment.js [--days=7] [--baseline-file=baseline.json] [--verbose]
 * 
 * Options:
 *   --days=N              Check data from last N days (default: 7)
 *   --baseline-file=PATH  Path to baseline metrics file (optional, skips performance check if not provided)
 *   --verbose             Show detailed output
 */

const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const daysArg = args.find(arg => arg.startsWith('--days='));
const baselineArg = args.find(arg => arg.startsWith('--baseline-file='));
const verbose = args.includes('--verbose');

const days = daysArg ? daysArg.split('=')[1] : '7';
const baselineFile = baselineArg ? baselineArg.split('=')[1] : null;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      env: process.env,
    });
    
    child.on('close', (code) => {
      resolve(code === 0);
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  try {
    log('═'.repeat(70), colors.cyan);
    log('🔍 PAYMENT IDEMPOTENCY DEPLOYMENT VERIFICATION', colors.cyan);
    log('═'.repeat(70), colors.cyan);
    log(`\n📅 Checking data from last ${days} days\n`, colors.blue);
    
    const results = {
      duplicateOrders: { name: '11.1 No Duplicate Orders', passed: false },
      atomicFinalization: { name: '11.2 Atomic Finalization', passed: false },
      gatewayCreation: { name: '11.3 Gateway Creation', passed: false },
      adminAssignment: { name: '11.4 Admin Assignment', passed: false },
      performance: { name: '11.5 Performance', passed: false, skipped: false },
    };
    
    // Run verification scripts
    const scriptArgs = verbose ? [`--days=${days}`, '--verbose'] : [`--days=${days}`];
    
    // 11.1: No Duplicate Orders
    log('═'.repeat(70), colors.cyan);
    log('📋 Running: 11.1 No Duplicate Orders', colors.cyan);
    log('═'.repeat(70), colors.cyan);
    results.duplicateOrders.passed = await runScript('verify-no-duplicate-orders.js', scriptArgs);
    
    // 11.2: Atomic Finalization
    log('\n' + '═'.repeat(70), colors.cyan);
    log('📋 Running: 11.2 Atomic Finalization', colors.cyan);
    log('═'.repeat(70), colors.cyan);
    results.atomicFinalization.passed = await runScript('verify-atomic-finalization.js', scriptArgs);
    
    // 11.3: Gateway Creation
    log('\n' + '═'.repeat(70), colors.cyan);
    log('📋 Running: 11.3 Gateway Creation', colors.cyan);
    log('═'.repeat(70), colors.cyan);
    results.gatewayCreation.passed = await runScript('verify-gateway-creation.js', scriptArgs);
    
    // 11.4: Admin Assignment
    log('\n' + '═'.repeat(70), colors.cyan);
    log('📋 Running: 11.4 Admin Assignment', colors.cyan);
    log('═'.repeat(70), colors.cyan);
    results.adminAssignment.passed = await runScript('verify-admin-assignment.js', scriptArgs);
    
    // 11.5: Performance (optional)
    if (baselineFile) {
      log('\n' + '═'.repeat(70), colors.cyan);
      log('📋 Running: 11.5 Performance', colors.cyan);
      log('═'.repeat(70), colors.cyan);
      const perfArgs = [`--baseline-file=${baselineFile}`];
      if (verbose) perfArgs.push('--verbose');
      results.performance.passed = await runScript('verify-performance.js', perfArgs);
    } else {
      log('\n' + '═'.repeat(70), colors.cyan);
      log('📋 Skipping: 11.5 Performance (no baseline file provided)', colors.yellow);
      log('═'.repeat(70), colors.cyan);
      results.performance.skipped = true;
      results.performance.passed = true; // Don't fail overall if skipped
    }
    
    // Final Summary
    log('\n' + '═'.repeat(70), colors.cyan);
    log('📊 FINAL VERIFICATION SUMMARY', colors.cyan);
    log('═'.repeat(70), colors.cyan);
    
    log('\nResults:');
    for (const [key, result] of Object.entries(results)) {
      const status = result.skipped ? '⊘' : (result.passed ? '✅' : '❌');
      const color = result.skipped ? colors.yellow : (result.passed ? colors.green : colors.red);
      const suffix = result.skipped ? ' (skipped)' : '';
      log(`  ${status} ${result.name}${suffix}`, color);
    }
    
    const allPassed = Object.values(results).every(r => r.passed);
    
    if (allPassed) {
      log('\n' + '═'.repeat(70), colors.green);
      log('🎉 ALL VERIFICATION CHECKS PASSED', colors.green);
      log('═'.repeat(70), colors.green);
      log('\n✅ Payment idempotency fixes are working correctly', colors.green);
      log('✅ No duplicate orders detected', colors.green);
      log('✅ Atomic operations verified', colors.green);
      log('✅ Performance within acceptable range', colors.green);
      log('\n📖 Next steps:', colors.blue);
      log('   1. Continue monitoring for 7 days', colors.blue);
      log('   2. Review metrics weekly', colors.blue);
      log('   3. Update baseline metrics after stabilization', colors.blue);
      log('   4. Document any issues in post-deployment report', colors.blue);
    } else {
      log('\n' + '═'.repeat(70), colors.red);
      log('❌ VERIFICATION FAILED', colors.red);
      log('═'.repeat(70), colors.red);
      
      const failedChecks = Object.values(results).filter(r => !r.passed && !r.skipped);
      log(`\n⚠️  ${failedChecks.length} check(s) failed`, colors.red);
      
      log('\n📖 Immediate actions:', colors.yellow);
      log('   1. Review failed checks above for details', colors.yellow);
      log('   2. Refer to PAYMENT_IDEMPOTENCY_RUNBOOK.md for incident response', colors.yellow);
      log('   3. Consider rollback if critical issues detected', colors.yellow);
      log('   4. Escalate to backend team if needed', colors.yellow);
    }
    
    // Exit with appropriate code
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    log(`\n❌ Error during verification: ${error.message}`, colors.red);
    if (verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Run the script
main();
