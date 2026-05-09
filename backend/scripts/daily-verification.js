#!/usr/bin/env node

/**
 * Daily Verification Script
 * 
 * This script runs daily verification checks and sends a summary report.
 * Designed to be run as a cron job.
 * 
 * Usage:
 *   node scripts/daily-verification.js [--email=admin@example.com] [--slack-webhook=URL]
 * 
 * Options:
 *   --email=EMAIL           Send report to email (requires email service configured)
 *   --slack-webhook=URL     Send report to Slack webhook
 *   --baseline-file=PATH    Path to baseline metrics file (optional)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);
const emailArg = args.find(arg => arg.startsWith('--email='));
const slackWebhookArg = args.find(arg => arg.startsWith('--slack-webhook='));
const baselineArg = args.find(arg => arg.startsWith('--baseline-file='));

const email = emailArg ? emailArg.split('=')[1] : null;
const slackWebhook = slackWebhookArg ? slackWebhookArg.split('=')[1] : process.env.SLACK_WEBHOOK_URL;
const baselineFile = baselineArg ? baselineArg.split('=')[1] : null;

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function runScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    let output = '';
    
    const child = spawn('node', [scriptPath, ...args], {
      env: process.env,
    });
    
    child.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    
    child.stderr.on('data', (data) => {
      output += data.toString();
      process.stderr.write(data);
    });
    
    child.on('close', (code) => {
      resolve({ passed: code === 0, output });
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}

function generateReport(results) {
  const timestamp = new Date().toISOString();
  const allPassed = Object.values(results).every(r => r.passed || r.skipped);
  
  let report = '# Payment Idempotency Daily Verification Report\n\n';
  report += `**Date**: ${timestamp}\n`;
  report += `**Status**: ${allPassed ? '✅ PASSED' : '❌ FAILED'}\n\n`;
  
  report += '## Summary\n\n';
  for (const [key, result] of Object.entries(results)) {
    const status = result.skipped ? '⊘ SKIPPED' : (result.passed ? '✅ PASS' : '❌ FAIL');
    report += `- ${status} - ${result.name}\n`;
  }
  
  if (!allPassed) {
    report += '\n## Failed Checks\n\n';
    const failedChecks = Object.values(results).filter(r => !r.passed && !r.skipped);
    failedChecks.forEach(check => {
      report += `### ${check.name}\n\n`;
      report += 'Please review the detailed output above and refer to PAYMENT_IDEMPOTENCY_RUNBOOK.md for incident response.\n\n';
    });
  }
  
  report += '\n## Next Steps\n\n';
  if (allPassed) {
    report += '- Continue monitoring\n';
    report += '- Review metrics weekly\n';
    report += '- No action required\n';
  } else {
    report += '- Review failed checks immediately\n';
    report += '- Refer to PAYMENT_IDEMPOTENCY_RUNBOOK.md\n';
    report += '- Escalate if critical issues detected\n';
  }
  
  return report;
}

function sendSlackNotification(report, allPassed) {
  if (!slackWebhook) {
    log('⚠️  Slack webhook not configured, skipping notification', colors.yellow);
    return Promise.resolve();
  }
  
  log('\n📤 Sending Slack notification...', colors.blue);
  
  const payload = {
    text: allPassed ? '✅ Payment Idempotency Daily Verification: PASSED' : '❌ Payment Idempotency Daily Verification: FAILED',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: allPassed ? '✅ Daily Verification: PASSED' : '❌ Daily Verification: FAILED',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: report,
        },
      },
    ],
  };
  
  return new Promise((resolve, reject) => {
    const url = new URL(slackWebhook);
    const client = url.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }, (res) => {
      if (res.statusCode === 200) {
        log('✅ Slack notification sent', colors.green);
        resolve();
      } else {
        log(`⚠️  Slack notification failed: ${res.statusCode}`, colors.yellow);
        resolve(); // Don't fail the whole script
      }
    });
    
    req.on('error', (error) => {
      log(`⚠️  Slack notification error: ${error.message}`, colors.yellow);
      resolve(); // Don't fail the whole script
    });
    
    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function main() {
  try {
    log('🔍 Payment Idempotency: Daily Verification', colors.blue);
    log(`📅 ${new Date().toISOString()}\n`, colors.blue);
    
    const results = {
      duplicateOrders: { name: 'No Duplicate Orders', passed: false, skipped: false },
      atomicFinalization: { name: 'Atomic Finalization', passed: false, skipped: false },
      gatewayCreation: { name: 'Gateway Creation', passed: false, skipped: false },
      adminAssignment: { name: 'Admin Assignment', passed: false, skipped: false },
      performance: { name: 'Performance', passed: false, skipped: false },
    };
    
    // Run verification scripts (last 24 hours)
    const scriptArgs = ['--days=1'];
    
    // 11.1: No Duplicate Orders
    log('═'.repeat(60), colors.blue);
    log('📋 Checking: No Duplicate Orders', colors.blue);
    log('═'.repeat(60), colors.blue);
    const r1 = await runScript('verify-no-duplicate-orders.js', scriptArgs);
    results.duplicateOrders.passed = r1.passed;
    
    // 11.2: Atomic Finalization
    log('\n' + '═'.repeat(60), colors.blue);
    log('📋 Checking: Atomic Finalization', colors.blue);
    log('═'.repeat(60), colors.blue);
    const r2 = await runScript('verify-atomic-finalization.js', scriptArgs);
    results.atomicFinalization.passed = r2.passed;
    
    // 11.3: Gateway Creation
    log('\n' + '═'.repeat(60), colors.blue);
    log('📋 Checking: Gateway Creation', colors.blue);
    log('═'.repeat(60), colors.blue);
    const r3 = await runScript('verify-gateway-creation.js', scriptArgs);
    results.gatewayCreation.passed = r3.passed;
    
    // 11.4: Admin Assignment
    log('\n' + '═'.repeat(60), colors.blue);
    log('📋 Checking: Admin Assignment', colors.blue);
    log('═'.repeat(60), colors.blue);
    const r4 = await runScript('verify-admin-assignment.js', scriptArgs);
    results.adminAssignment.passed = r4.passed;
    
    // 11.5: Performance (optional)
    if (baselineFile && fs.existsSync(baselineFile)) {
      log('\n' + '═'.repeat(60), colors.blue);
      log('📋 Checking: Performance', colors.blue);
      log('═'.repeat(60), colors.blue);
      const r5 = await runScript('verify-performance.js', [`--baseline-file=${baselineFile}`]);
      results.performance.passed = r5.passed;
    } else {
      log('\n' + '═'.repeat(60), colors.yellow);
      log('📋 Skipping: Performance (no baseline file)', colors.yellow);
      log('═'.repeat(60), colors.yellow);
      results.performance.skipped = true;
      results.performance.passed = true;
    }
    
    // Generate report
    const report = generateReport(results);
    const allPassed = Object.values(results).every(r => r.passed || r.skipped);
    
    // Save report to file
    const reportFile = path.join(__dirname, '..', 'logs', `verification-report-${new Date().toISOString().split('T')[0]}.md`);
    fs.mkdirSync(path.dirname(reportFile), { recursive: true });
    fs.writeFileSync(reportFile, report);
    log(`\n📄 Report saved to: ${reportFile}`, colors.blue);
    
    // Send notifications
    await sendSlackNotification(report, allPassed);
    
    // Summary
    log('\n' + '═'.repeat(60), colors.blue);
    log('📊 DAILY VERIFICATION SUMMARY', colors.blue);
    log('═'.repeat(60), colors.blue);
    
    if (allPassed) {
      log('\n✅ All checks passed', colors.green);
      log('✅ No action required', colors.green);
    } else {
      log('\n❌ Some checks failed', colors.red);
      log('⚠️  Review report and take action', colors.yellow);
    }
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error) {
    log(`\n❌ Error during daily verification: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
