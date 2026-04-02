/**
 * Stress Test Metrics and Reporting
 */

export interface TestResult {
  input: string;
  expected: string;
  output: string;
  confidence: number;
  success: boolean;
  type: string;
  executionTime: number;
}

export function calculateMetrics(results: TestResult[]) {
  const total = results.length;
  const successCount = results.filter(r => r.success).length;
  const accuracy = (successCount / total) * 100;
  
  // Confidence stats
  const confidences = results.map(r => r.confidence);
  const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  const minConfidence = Math.min(...confidences);
  const maxConfidence = Math.max(...confidences);
  
  // Execution time stats
  const times = results.map(r => r.executionTime);
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  
  // By type
  const byType: Record<string, { total: number; success: number; accuracy: number }> = {};
  
  for (const result of results) {
    if (!byType[result.type]) {
      byType[result.type] = { total: 0, success: 0, accuracy: 0 };
    }
    byType[result.type].total++;
    if (result.success) byType[result.type].success++;
  }
  
  for (const type in byType) {
    byType[type].accuracy = (byType[type].success / byType[type].total) * 100;
  }
  
  // False corrections (correct inputs that were wrongly changed)
  const correctInputs = results.filter(r => r.type === 'correct');
  const falseCorrections = correctInputs.filter(r => !r.success);
  const falseRate = correctInputs.length > 0 
    ? (falseCorrections.length / correctInputs.length) * 100 
    : 0;
  
  return {
    total,
    successCount,
    accuracy,
    avgConfidence,
    minConfidence,
    maxConfidence,
    avgTime,
    minTime,
    maxTime,
    byType,
    falseCorrections: falseCorrections.length,
    falseRate,
  };
}

export function printMetrics(results: TestResult[]) {
  const metrics = calculateMetrics(results);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 STRESS TEST RESULTS');
  console.log('='.repeat(60));
  
  console.log('\n🎯 OVERALL METRICS:');
  console.log(`   Total inputs:     ${metrics.total.toLocaleString()}`);
  console.log(`   Successful:       ${metrics.successCount.toLocaleString()}`);
  console.log(`   Accuracy:         ${metrics.accuracy.toFixed(2)}%`);
  console.log(`   False corrections: ${metrics.falseCorrections} (${metrics.falseRate.toFixed(2)}%)`);
  
  console.log('\n📈 CONFIDENCE SCORES:');
  console.log(`   Average:  ${metrics.avgConfidence.toFixed(3)}`);
  console.log(`   Min:      ${metrics.minConfidence.toFixed(3)}`);
  console.log(`   Max:      ${metrics.maxConfidence.toFixed(3)}`);

  console.log('\n⚡ PERFORMANCE:');
  console.log(`   Avg time:  ${metrics.avgTime.toFixed(2)}ms`);
  console.log(`   Min time:  ${metrics.minTime.toFixed(2)}ms`);
  console.log(`   Max time:  ${metrics.maxTime.toFixed(2)}ms`);
  
  console.log('\n📋 BY INPUT TYPE:');
  for (const [type, stats] of Object.entries(metrics.byType)) {
    console.log(`   ${type.padEnd(15)} ${stats.success}/${stats.total} (${stats.accuracy.toFixed(1)}%)`);
  }
  
  console.log('\n' + '='.repeat(60));
  
  return metrics;
}

export function printFailures(results: TestResult[], limit: number = 50) {
  const failures = results.filter(r => !r.success);
  
  if (failures.length === 0) {
    console.log('\n✅ No failures!');
    return;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`❌ TOP ${Math.min(limit, failures.length)} FAILURES:`);
  console.log('='.repeat(60));
  
  // Sort by confidence (lowest first - most uncertain)
  const sorted = failures.sort((a, b) => a.confidence - b.confidence);
  
  const table = sorted.slice(0, limit).map((r, i) => ({
    '#': i + 1,
    'Input': r.input,
    'Expected': r.expected,
    'Got': r.output,
    'Confidence': r.confidence.toFixed(3),
    'Type': r.type,
  }));
  
  console.table(table);
}

export function printSuccessExamples(results: TestResult[], limit: number = 20) {
  const successes = results.filter(r => r.success && r.type !== 'correct');
  
  if (successes.length === 0) {
    console.log('\n⚠️ No successful corrections!');
    return;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ TOP ${Math.min(limit, successes.length)} SUCCESSFUL CORRECTIONS:`);
  console.log('='.repeat(60));
  
  // Sort by confidence (highest first)
  const sorted = successes.sort((a, b) => b.confidence - a.confidence);
  
  const table = sorted.slice(0, limit).map((r, i) => ({
    '#': i + 1,
    'Input': r.input,
    'Corrected to': r.output,
    'Confidence': r.confidence.toFixed(3),
    'Type': r.type,
  }));
  
  console.table(table);
}
