#!/usr/bin/env ts-node
/**
 * Standalone Stress Test Script
 * 
 * Run with: npx ts-node scripts/stressTest.ts
 */

import { 
  correctVoiceQuery, 
  correctionEngine,
  normalize 
} from '../src/utils/voiceCorrection';
import type { Product } from '../src/types';

// ─── Mock Product Catalog ────────────────────────────────────────

const mockProducts: Product[] = [
  { _id: '1', name: 'Green Lays 52g', description: '', price: 20, mrp: 25, category: 'Snacks', images: [], stock: 100 },
  { _id: '2', name: 'Kurkure Masala', description: '', price: 20, mrp: 25, category: 'Snacks', images: [], stock: 100 },
  { _id: '3', name: 'Bingo Mad Angles', description: '', price: 20, mrp: 25, category: 'Snacks', images: [], stock: 100 },
  { _id: '4', name: 'Dairy Milk Chocolate', description: '', price: 50, mrp: 60, category: 'Chocolate', images: [], stock: 50 },
  { _id: '5', name: 'KitKat', description: '', price: 30, mrp: 35, category: 'Chocolate', images: [], stock: 80 },
  { _id: '6', name: 'Munch', description: '', price: 10, mrp: 12, category: 'Chocolate', images: [], stock: 120 },
  { _id: '7', name: 'Coke 500ml', description: '', price: 40, mrp: 45, category: 'Beverages', images: [], stock: 200 },
  { _id: '8', name: 'Pepsi 500ml', description: '', price: 40, mrp: 45, category: 'Beverages', images: [], stock: 200 },
  { _id: '9', name: 'Sprite 500ml', description: '', price: 40, mrp: 45, category: 'Beverages', images: [], stock: 200 },
  { _id: '10', name: 'Thumbs Up 500ml', description: '', price: 40, mrp: 45, category: 'Beverages', images: [], stock: 200 },
  { _id: '11', name: 'Amul Milk 1L', description: '', price: 60, mrp: 65, category: 'Dairy', images: [], stock: 150 },
  { _id: '12', name: 'Amul Butter 100g', description: '', price: 50, mrp: 55, category: 'Dairy', images: [], stock: 100 },
  { _id: '13', name: 'Amul Cheese', description: '', price: 120, mrp: 130, category: 'Dairy', images: [], stock: 80 },
  { _id: '14', name: 'Maggi Noodles', description: '', price: 12, mrp: 14, category: 'Instant Food', images: [], stock: 300 },
  { _id: '15', name: 'Top Ramen', description: '', price: 12, mrp: 14, category: 'Instant Food', images: [], stock: 250 },
  { _id: '16', name: 'Parle G', description: '', price: 10, mrp: 12, category: 'Biscuits', images: [], stock: 400 },
  { _id: '17', name: 'Oreo Cookies', description: '', price: 30, mrp: 35, category: 'Biscuits', images: [], stock: 150 },
  { _id: '18', name: 'Good Day', description: '', price: 30, mrp: 35, category: 'Biscuits', images: [], stock: 150 },
  { _id: '19', name: 'Hide and Seek', description: '', price: 30, mrp: 35, category: 'Biscuits', images: [], stock: 150 },
  { _id: '20', name: 'Surf Excel 1kg', description: '', price: 150, mrp: 170, category: 'Cleaning', images: [], stock: 100 },
];

// ─── Test Case Generator ─────────────────────────────────────────

interface TestCase {
  input: string;
  expected: string;
  type: string;
}

function generateTestCases(count: number): TestCase[] {
  const cases: TestCase[] = [];
  
  const templates = [
    // Misspellings
    { input: 'greenlense', expected: 'green lays', type: 'misspelling' },
    { input: 'dary milk', expected: 'dairy milk', type: 'misspelling' },
    { input: 'cok', expected: 'coke', type: 'misspelling' },
    { input: 'surff exel', expected: 'surf excel', type: 'misspelling' },
    { input: 'magi', expected: 'maggi', type: 'misspelling' },

    { input: 'aml milk', expected: 'amul milk', type: 'misspelling' },
    { input: 'pepsy', expected: 'pepsi', type: 'misspelling' },
    { input: 'sprit', expected: 'sprite', type: 'misspelling' },
    { input: 'kurkur', expected: 'kurkure', type: 'misspelling' },
    { input: 'parleg', expected: 'parle g', type: 'misspelling' },
    
    // Phonetic
    { input: 'lase', expected: 'lays', type: 'phonetic' },
    { input: 'koke', expected: 'coke', type: 'phonetic' },
    { input: 'dairi milk', expected: 'dairy milk', type: 'phonetic' },
    { input: 'amool', expected: 'amul', type: 'phonetic' },
    { input: 'pepci', expected: 'pepsi', type: 'phonetic' },
    
    // Noise
    { input: 'grn lays', expected: 'green lays', type: 'noise' },
    { input: 'mlk', expected: 'milk', type: 'noise' },
    { input: 'ck', expected: 'coke', type: 'noise' },
    { input: 'mgg', expected: 'maggi', type: 'noise' },
    
    // Correct
    { input: 'green lays', expected: 'green lays', type: 'correct' },
    { input: 'dairy milk', expected: 'dairy milk', type: 'correct' },
    { input: 'coke', expected: 'coke', type: 'correct' },
    { input: 'maggi', expected: 'maggi', type: 'correct' },
    { input: 'amul milk', expected: 'amul milk', type: 'correct' },
  ];
  
  // Repeat templates to reach desired count
  while (cases.length < count) {
    cases.push(...templates);
  }
  
  return cases.slice(0, count);
}

// ─── Accuracy Checker ────────────────────────────────────────────

function isCorrect(expected: string, output: string): boolean {
  const normExpected = normalize(expected);
  const normOutput = normalize(output);
  
  if (normExpected === normOutput) return true;
  if (normOutput.includes(normExpected)) return true;
  
  const expectedWords = normExpected.split(/\s+/);
  const outputWords = normOutput.split(/\s+/);
  
  return expectedWords.every(word => 
    outputWords.some(outWord => outWord.includes(word) || word.includes(outWord))
  );
}

// ─── Main Test Runner ────────────────────────────────────────────

async function runStressTest() {
  console.log('🚀 Voice Correction Stress Test\n');
  console.log('='.repeat(60));
  
  // Step 1: Build dictionary
  console.log('📚 Building dictionary from', mockProducts.length, 'products...');
  correctionEngine.buildDictionary(mockProducts);
  const dictSize = correctionEngine.getDictionary().length;
  console.log(`✅ Dictionary built: ${dictSize} entries\n`);
  
  // Step 2: Generate test cases
  const testCount = 10000;
  console.log(`🔄 Generating ${testCount.toLocaleString()} test cases...`);
  const testCases = generateTestCases(testCount);
  console.log(`✅ Generated ${testCases.length.toLocaleString()} test cases\n`);
  
  // Step 3: Run tests
  console.log('⚡ Running stress test...\n');
  const results: any[] = [];
  const startTime = Date.now();
  
  for (const testCase of testCases) {
    const execStart = Date.now();
    const result = correctVoiceQuery(testCase.input, 0.6);
    const execTime = Date.now() - execStart;
    
    const success = isCorrect(testCase.expected, result.corrected);
    
    results.push({
      input: testCase.input,
      expected: testCase.expected,
      output: result.corrected,
      confidence: result.confidence,
      success,
      type: testCase.type,
      executionTime: execTime,
    });
  }
  
  const totalTime = Date.now() - startTime;

  // Step 4: Calculate metrics
  console.log('='.repeat(60));
  console.log('📊 RESULTS\n');
  
  const successCount = results.filter(r => r.success).length;
  const accuracy = (successCount / results.length) * 100;
  
  const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
  const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
  
  const correctInputs = results.filter(r => r.type === 'correct');
  const falseCorrections = correctInputs.filter(r => !r.success);
  const falseRate = (falseCorrections.length / correctInputs.length) * 100;
  
  // By type
  const byType: Record<string, { total: number; success: number }> = {};
  for (const r of results) {
    if (!byType[r.type]) byType[r.type] = { total: 0, success: 0 };
    byType[r.type].total++;
    if (r.success) byType[r.type].success++;
  }
  
  console.log('🎯 OVERALL METRICS:');
  console.log(`   Total inputs:      ${results.length.toLocaleString()}`);
  console.log(`   Successful:        ${successCount.toLocaleString()}`);
  console.log(`   Accuracy:          ${accuracy.toFixed(2)}% ${accuracy > 85 ? '✅' : '❌'}`);
  console.log(`   False corrections: ${falseCorrections.length} (${falseRate.toFixed(2)}%) ${falseRate < 5 ? '✅' : '❌'}`);
  
  console.log('\n📈 CONFIDENCE:');
  console.log(`   Average: ${avgConfidence.toFixed(3)} ${avgConfidence > 0.7 ? '✅' : '❌'}`);
  
  console.log('\n⚡ PERFORMANCE:');
  console.log(`   Total time:  ${totalTime.toLocaleString()}ms`);
  console.log(`   Avg time:    ${avgTime.toFixed(2)}ms ${avgTime < 20 ? '✅' : '❌'}`);
  
  console.log('\n📋 BY TYPE:');
  for (const [type, stats] of Object.entries(byType)) {
    const typeAccuracy = (stats.success / stats.total) * 100;
    console.log(`   ${type.padEnd(15)} ${stats.success}/${stats.total} (${typeAccuracy.toFixed(1)}%)`);
  }
  
  // Step 5: Print failures
  const failures = results.filter(r => !r.success).sort((a, b) => a.confidence - b.confidence);
  
  if (failures.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log(`❌ TOP 50 FAILURES (lowest confidence first):\n`);
    
    failures.slice(0, 50).forEach((f, i) => {
      console.log(`${(i + 1).toString().padStart(3)}. "${f.input}" → "${f.output}" (expected: "${f.expected}") [${f.confidence.toFixed(3)}]`);
    });
  }
  
  // Step 6: Print successes
  const successes = results.filter(r => r.success && r.type !== 'correct').sort((a, b) => b.confidence - a.confidence);
  
  if (successes.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log(`✅ TOP 20 SUCCESSFUL CORRECTIONS (highest confidence):\n`);
    
    successes.slice(0, 20).forEach((s, i) => {
      console.log(`${(i + 1).toString().padStart(3)}. "${s.input}" → "${s.output}" [${s.confidence.toFixed(3)}]`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✨ Stress test complete!\n');
  
  // Exit with appropriate code
  process.exit(accuracy > 85 && falseRate < 5 && avgTime < 20 ? 0 : 1);
}

// Run the test
runStressTest().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
