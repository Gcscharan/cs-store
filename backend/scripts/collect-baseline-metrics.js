#!/usr/bin/env node

/**
 * Baseline Metrics Collection Script
 * 
 * This script collects current performance metrics to establish a baseline
 * before deploying the idempotency fixes.
 * 
 * Usage:
 *   node scripts/collect-baseline-metrics.js --output=baseline.json [--verbose]
 * 
 * Options:
 *   --output=PATH  Path to save baseline metrics (required)
 *   --verbose      Show detailed output
 */

const fs = require('fs');
const https = require('https');
const http = require('http');

// Parse command line arguments
const args = process.argv.slice(2);
const outputArg = args.find(arg => arg.startsWith('--output='));
const verbose = args.includes('--verbose');

if (!outputArg) {
  console.error('❌ Error: --output argument is required');
  console.error('Usage: node scripts/collect-baseline-metrics.js --output=baseline.json');
  process.exit(1);
}

const outputFile = outputArg.split('=')[1];

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

async function collectMetrics() {
  log('\n📋 Collecting baseline metrics from Prometheus...', colors.blue);
  
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
  let successCount = 0;
  
  for (const [name, query] of Object.entries(queries)) {
    try {
      const value = await queryPrometheus(query);
      
      if (value !== null) {
        metrics[name] = value;
        successCount++;
        
        if (verbose) {
          log(`   ✅ ${name}: ${value.toFixed(2)}ms`, colors.green);
        }
      } else {
        log(`   ⚠️  ${name}: No data available`, colors.yellow);
      }
    } catch (error) {
      log(`   ❌ ${name}: Error - ${error.message}`, colors.red);
    }
  }
  
  if (successCount === 0) {
    throw new Error('No metrics could be collected from Prometheus');
  }
  
  log(`\n✅ Collected ${successCount}/${Object.keys(queries).length} metrics`, colors.green);
  
  return metrics;
}

function saveBaseline(metrics) {
  log('\n📋 Saving baseline metrics...', colors.blue);
  
  const baseline = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    prometheusUrl: process.env.PROMETHEUS_URL || 'http://localhost:9090',
    metrics,
  };
  
  fs.writeFileSync(outputFile, JSON.stringify(baseline, null, 2));
  
  log(`✅ Baseline saved to ${outputFile}`, colors.green);
  
  if (verbose) {
    log('\nBaseline content:');
    console.log(JSON.stringify(baseline, null, 2));
  }
}

async function main() {
  try {
    log('🔍 Payment Idempotency: Baseline Metrics Collection', colors.blue);
    
    // Collect metrics
    const metrics = await collectMetrics();
    
    // Save baseline
    saveBaseline(metrics);
    
    // Summary
    log('\n' + '='.repeat(60), colors.blue);
    log('📊 BASELINE COLLECTION SUMMARY', colors.blue);
    log('='.repeat(60), colors.blue);
    
    log('\n✅ Baseline metrics collected successfully', colors.green);
    log(`✅ Saved to: ${outputFile}`, colors.green);
    log(`✅ Timestamp: ${new Date().toISOString()}`, colors.green);
    
    log('\n📖 Next steps:', colors.blue);
    log('   1. Deploy idempotency fixes', colors.blue);
    log('   2. Wait 24 hours for metrics to stabilize', colors.blue);
    log('   3. Run verification: node scripts/verify-performance.js --baseline-file=' + outputFile, colors.blue);
    
    log('\n🎉 Baseline collection completed', colors.green);
    
    process.exit(0);
    
  } catch (error) {
    log(`\n❌ Error during baseline collection: ${error.message}`, colors.red);
    if (verbose) {
      console.error(error);
    }
    
    log('\n📖 Troubleshooting:', colors.yellow);
    log('   1. Verify Prometheus is running and accessible', colors.yellow);
    log('   2. Check PROMETHEUS_URL environment variable', colors.yellow);
    log('   3. Verify metrics are being exported by the application', colors.yellow);
    log('   4. Try: curl $PROMETHEUS_URL/api/v1/query?query=up', colors.yellow);
    
    process.exit(1);
  }
}

// Run the script
main();
