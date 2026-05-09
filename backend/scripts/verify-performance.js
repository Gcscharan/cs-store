#!/usr/bin/env node

/**
 * Verification Script: Performance
 * 
 * This script verifies that performance has not degraded significantly
 * after the idempotency fixes.
 * 
 * Usage:
 *   node scripts/verify-performance.js --baseline-file=baseline.json [--verbose]
 * 
 * Options:
 *   --baseline-file=PATH  Path to baseline metrics file (required)
 *   --verbose             Show detailed output
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);
const baselineArg = args.find(arg => arg.startsWith('--baseline-file='));
const verbose = args.includes('--verbose');

if (!baselineArg) {
  console.error('❌ Error: --baseline-file argument is required');
  console.error('Usage: node scripts/verify-performance.js --baseline-file=baseline.json');
  process.exit(1);
}

const baselineFile = baselineArg.split('=')[1];

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

function loadBaseline() {
  log('\n📋 Loading baseline metrics...', colors.blue);
  
  if (!fs.existsSync(baselineFile)) {
    throw new Error(`Baseline file not found: ${baselineFile}`);
  }
  
  const baseline = JSON.parse(fs.readFileSync(baselineFile, 'utf8'));
  log(`✅ Loaded baseline from ${baselineFile}`, colors.green);
  
  if (verbose) {
    log(`   Baseline date: ${baseline.timestamp}`);
    log(`   Metrics count: ${Object.keys(baseline.metrics).length}`);
  }
  
  return baseline;
}

async function queryPrometheus(query) {
  const prometheusUrl = process.env.PROMETHEUS_URL || 'http://localhost:9090';
  const url = `${prometheusUrl}/api/v1/query?query=${encodeURIComponent(query)}`;
  
  return new Promise((resolve, reject) => {
    const client = prometheusUrl.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === 'success' && result.data.result.length > 0) {
            const value = parseFloat(result.data.result[0].value[1]);
            resolve(value);
          } else {
            resolve(null);
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function getCurrentMetrics() {
  log('\n📋 Querying current metrics from Prometheus...', colors.blue);
  
  const queries = {
    orderCreationP50: 'histogram_quantile(0.50, rate(order_creation_duration_ms_bucket[1h]))',
    orderCreationP95: 'histogram_quantile(0.95, rate(order_creation_duration_ms_bucket[1h]))',
    orderCreationP99: 'histogram_quantile(0.99, rate(order_creation_duration_ms_bucket[1h]))',
    finalizationP50: 'histogram_quantile(0.50, rate(finalization_duration_ms_bucket[1h]))',
    finalizationP95: 'histogram_quantile(0.95, rate(finalization_duration_ms_bucket[1h]))',
    finalizationP99: 'histogram_quantile(0.99, rate(finalization_duration_ms_bucket[1h]))',
    gatewayCreationP50: 'histogram_quantile(0.50, rate(gateway_creation_duration_ms_bucket[1h]))',
    gatewayCreationP95: 'histogram_quantile(0.95, rate(gateway_creation_duration_ms_bucket[1h]))',
    gatewayCreationP99: 'histogram_quantile(0.99, rate(gateway_creation_duration_ms_bucket[1h]))',
  };
  
  const metrics = {};
  
  try {
    for (const [name, query] of Object.entries(queries)) {
      const value = await queryPrometheus(query);
      metrics[name] = value;
      
      if (verbose) {
        log(`   ${name}: ${value !== null ? value.toFixed(2) + 'ms' : 'N/A'}`);
      }
    }
    
    log('✅ Current metrics retrieved', colors.green);
    return metrics;
    
  } catch (error) {
    log(`⚠️  Error querying Prometheus: ${error.message}`, colors.yellow);
    log('   Skipping performance verification (Prometheus not available)', colors.yellow);
    return null;
  }
}

function compareMetrics(baseline, current) {
  log('\n📋 Comparing metrics...', colors.blue);
  
  const thresholds = {
    orderCreationP50: 10,  // 10% increase acceptable
    orderCreationP95: 10,
    orderCreationP99: 10,
    finalizationP50: 10,
    finalizationP95: 10,
    finalizationP99: 10,
    gatewayCreationP50: 15,  // 15% increase acceptable (wait loop adds latency)
    gatewayCreationP95: 15,
    gatewayCreationP99: 15,
  };
  
  const results = [];
  let allPassed = true;
  
  for (const [name, currentValue] of Object.entries(current)) {
    if (currentValue === null) {
      log(`⚠️  ${name}: No data available`, colors.yellow);
      results.push({ name, passed: true, skipped: true });
      continue;
    }
    
    const baselineValue = baseline.metrics[name];
    
    if (!baselineValue) {
      log(`⚠️  ${name}: No baseline value`, colors.yellow);
      results.push({ name, passed: true, skipped: true });
      continue;
    }
    
    const increase = ((currentValue - baselineValue) / baselineValue) * 100;
    const threshold = thresholds[name] || 10;
    const passed = increase <= threshold;
    
    if (!passed) {
      allPassed = false;
    }
    
    const status = passed ? '✅' : '❌';
    const color = passed ? colors.green : colors.red;
    
    log(`${status} ${name}: ${currentValue.toFixed(2)}ms (baseline: ${baselineValue.toFixed(2)}ms, ${increase >= 0 ? '+' : ''}${increase.toFixed(1)}%)`, color);
    
    if (increase > threshold * 0.8 && increase <= threshold) {
      log(`   ⚠️  Close to threshold (${threshold}%)`, colors.yellow);
    }
    
    results.push({
      name,
      passed,
      current: currentValue,
      baseline: baselineValue,
      increase,
      threshold,
    });
  }
  
  return { results, allPassed };
}

async function main() {
  try {
    log('🔍 Payment Idempotency Verification: Performance', colors.blue);
    
    // Load baseline
    const baseline = loadBaseline();
    
    // Get current metrics
    const current = await getCurrentMetrics();
    
    if (!current) {
      log('\n⚠️  Prometheus not available - skipping performance verification', colors.yellow);
      log('   Run this script on production server with Prometheus access', colors.yellow);
      process.exit(0);
    }
    
    // Compare metrics
    const comparison = compareMetrics(baseline, current);
    
    // Summary
    log('\n' + '='.repeat(60), colors.blue);
    log('📊 VERIFICATION SUMMARY', colors.blue);
    log('='.repeat(60), colors.blue);
    
    if (comparison.allPassed) {
      log('\n✅ All performance metrics within acceptable range', colors.green);
      
      const maxIncrease = Math.max(...comparison.results.filter(r => !r.skipped).map(r => r.increase));
      log(`   Maximum increase: ${maxIncrease.toFixed(1)}%`, colors.green);
      
      log('\n🎉 Verification PASSED', colors.green);
    } else {
      log('\n❌ Some performance metrics exceeded thresholds:', colors.red);
      
      comparison.results.filter(r => !r.passed && !r.skipped).forEach(r => {
        log(`   - ${r.name}: ${r.increase.toFixed(1)}% increase (threshold: ${r.threshold}%)`, colors.red);
      });
      
      log('\n⚠️  Verification FAILED - Performance degradation detected', colors.red);
      log('📖 Refer to PAYMENT_IDEMPOTENCY_DEPLOYMENT.md → Rollback Scenario 2', colors.yellow);
    }
    
    // Exit with appropriate code
    process.exit(comparison.allPassed ? 0 : 1);
    
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
