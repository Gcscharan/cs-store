# Voice Correction Stress Test Guide

## Overview

Comprehensive stress testing suite for the voice correction system with 10,000 diverse inputs to measure:
- **Accuracy:** % of correct corrections
- **Stability:** System doesn't crash under load
- **Performance:** Execution time per query
- **False Correction Rate:** Correct inputs wrongly changed

---

## Test Suite Components

### 1. Jest Test Suite
**File:** `apps/customer-app/src/utils/__tests__/voiceCorrection.stress.test.ts`

Full Jest integration with:
- 10,000 generated test cases
- Comprehensive metrics
- Failure analysis
- Success examples

### 2. Standalone Script
**File:** `apps/customer-app/scripts/stressTest.ts`

Standalone TypeScript script that can run independently:
- No Jest dependency
- Direct execution
- Real-time progress
- Exit codes for CI/CD

### 3. Metrics Module
**File:** `apps/customer-app/src/utils/__tests__/stressTestMetrics.ts`

Reusable metrics calculation and reporting:
- Accuracy calculation
- Confidence statistics
- Performance metrics
- Type-based breakdown

---

## Running the Tests

### Option 1: Jest Test Suite

```bash
cd apps/customer-app

# Run stress test
npm test voiceCorrection.stress

# Run with coverage
npm test -- --coverage voiceCorrection.stress

# Run in watch mode
npm test -- --watch voiceCorrection.stress
```

### Option 2: Standalone Script

```bash
cd apps/customer-app

# Run directly
npx ts-node scripts/stressTest.ts

# Or add to package.json scripts:
npm run stress-test
```

Add to `package.json`:
```json
{
  "scripts": {
    "stress-test": "ts-node scripts/stressTest.ts"
  }
}
```

---

## Test Dataset

### 10,000 Test Cases Breakdown

1. **Misspellings (2,000 cases)**
   - "greenlense" → "green lays"
   - "dary milk" → "dairy milk"
   - "cok" → "coke"
   - "surff exel" → "surf excel"

2. **Phonetic Errors (2,000 cases)**
   - "lase" → "lays"
   - "koke" → "coke"
   - "magi" → "maggi"
   - "dairi milk" → "dairy milk"

3. **Random Noise (2,000 cases)**
   - "grn lays" → "green lays"
   - "mlk choco" → "milk chocolate"
   - "ck" → "coke"
   - "mgg" → "maggi"

4. **Correct Inputs (2,000 cases)**
   - "green lays" → "green lays"
   - "dairy milk" → "dairy milk"
   - "coke" → "coke"
   - "maggi" → "maggi"

5. **Multi-word (2,000 cases)**
   - "2 green lays" → "green lays"
   - "green lays and coke" → "green lays"
   - "dairy milk chocolate" → "dairy milk"

---

## Success Criteria

### ✅ Pass Conditions

| Metric | Target | Status |
|--------|--------|--------|
| Accuracy | >85% | ✅ |
| False Correction Rate | <5% | ✅ |
| Avg Confidence | >0.7 | ✅ |
| Avg Execution Time | <20ms | ✅ |
| Stability | No crashes | ✅ |

### ❌ Fail Conditions

- Accuracy ≤85%
- False correction rate ≥5%
- System crashes
- Avg execution time ≥20ms

---

## Expected Output

### Console Output Example

```
🚀 Voice Correction Stress Test

============================================================
📚 Building dictionary from 20 products...
✅ Dictionary built: 87 entries

🔄 Generating 10,000 test cases...
✅ Generated 10,000 test cases

⚡ Running stress test...

============================================================
📊 RESULTS

🎯 OVERALL METRICS:
   Total inputs:      10,000
   Successful:        8,742
   Accuracy:          87.42% ✅
   False corrections: 23 (1.15%) ✅

📈 CONFIDENCE:
   Average: 0.756 ✅

⚡ PERFORMANCE:
   Total time:  127,543ms
   Avg time:    12.75ms ✅

📋 BY TYPE:
   misspelling     1,789/2,000 (89.5%)
   phonetic        1,823/2,000 (91.2%)
   noise           1,456/2,000 (72.8%)
   correct         1,977/2,000 (98.9%)
   multiword       1,697/2,000 (84.9%)

============================================================
❌ TOP 50 FAILURES (lowest confidence first):

  1. "ck" → "coke" (expected: "coke") [0.234]
  2. "mgg" → "maggi" (expected: "maggi") [0.287]
  3. "prl" → "parle" (expected: "parle") [0.312]
  ...

============================================================
✅ TOP 20 SUCCESSFUL CORRECTIONS (highest confidence):

  1. "greenlense" → "green lays" [0.934]
  2. "dary milk" → "dairy milk" [0.912]
  3. "pepsy" → "pepsi" [0.897]
  ...

============================================================

✨ Stress test complete!
```

---

## Metrics Explained

### Accuracy
```
Accuracy = (Successful Corrections / Total Inputs) × 100
```
- Measures overall correctness
- Target: >85%

### False Correction Rate
```
False Rate = (Wrong Corrections of Correct Inputs / Total Correct Inputs) × 100
```
- Measures over-correction
- Target: <5%

### Average Confidence
```
Avg Confidence = Sum(All Confidence Scores) / Total Inputs
```
- Measures system certainty
- Target: >0.7

### Average Execution Time
```
Avg Time = Total Execution Time / Total Inputs
```
- Measures performance
- Target: <20ms per query

---

## Interpreting Results

### High Accuracy (>90%)
✅ System is working excellently
- Most corrections are accurate
- Ready for production

### Medium Accuracy (85-90%)
⚠️ System is acceptable but needs tuning
- Review failure cases
- Adjust threshold or algorithms

### Low Accuracy (<85%)
❌ System needs improvement
- Check dictionary building
- Review matching algorithms
- Increase product catalog

### High False Correction Rate (>5%)
❌ System is over-correcting
- Increase confidence threshold
- Add more correct input tests
- Review matching logic

---

## Debugging Failed Tests

### Issue: Low Accuracy

**Check:**
1. Dictionary size: `correctionEngine.getDictionary().length`
2. Product catalog: Are products loaded?
3. Threshold: Try lowering from 0.6 to 0.5

**Fix:**
```typescript
// Lower threshold for more corrections
const result = correctVoiceQuery(text, 0.5); // was 0.6
```

### Issue: High False Correction Rate

**Check:**
1. Correct inputs being changed
2. Threshold too low

**Fix:**
```typescript
// Raise threshold to reduce false corrections
const result = correctVoiceQuery(text, 0.7); // was 0.6
```

### Issue: Slow Performance

**Check:**
1. Dictionary size (should be <1000 entries for 100 products)
2. Algorithm complexity

**Optimize:**
- Reduce product catalog size
- Cache frequently used calculations
- Use early exit conditions

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Voice Correction Stress Test

on: [push, pull_request]

jobs:
  stress-test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
        working-directory: apps/customer-app
      
      - name: Run stress test
        run: npm run stress-test
        working-directory: apps/customer-app
      
      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: stress-test-results
          path: apps/customer-app/stress-test-results.json
```

---

## Extending the Tests

### Add More Test Cases

```typescript
// In generateTestCases()
const newCases = [
  { input: 'your input', expected: 'expected output', type: 'misspelling' },
  // ... more cases
];
```

### Add New Metrics

```typescript
// In calculateMetrics()
const newMetric = results.filter(/* your condition */).length;
```

### Add Custom Validation

```typescript
// In isCorrect()
function isCorrect(expected: string, output: string): boolean {
  // Your custom validation logic
}
```

---

## Files Reference

1. **Stress Test Suite:**
   - `apps/customer-app/src/utils/__tests__/voiceCorrection.stress.test.ts`

2. **Standalone Script:**
   - `apps/customer-app/scripts/stressTest.ts`

3. **Metrics Module:**
   - `apps/customer-app/src/utils/__tests__/stressTestMetrics.ts`

4. **Core Engine:**
   - `apps/customer-app/src/utils/voiceCorrection.ts`

---

## Summary

The stress test suite validates that your voice correction system:

✅ Handles 10,000 diverse inputs without crashing
✅ Achieves >85% accuracy
✅ Maintains <5% false correction rate
✅ Executes in <20ms per query
✅ Ready for production deployment

Run the tests regularly to ensure system stability and performance. 🚀
