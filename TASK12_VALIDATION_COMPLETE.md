# Task 12: A/B Testing Hardening Validation

**Status**: ✅ READY FOR EXECUTION
**Tier**: Production-Grade Experimentation Engine

---

## 🎯 What This Validates

This is NOT about adding features. This is about **proving your system is trustworthy**.

The validation suite tests 5 critical safety mechanisms:

1. **SRM Detection** - Catches biased traffic splits
2. **Sample Size Enforcement** - Prevents premature conclusions
3. **Guardrail Monitoring** - Auto-stops on metric degradation
4. **Statistical Significance** - Validates winner with p-value
5. **Auto-Winner Detection** - Deploys winner automatically when safe

---

## 🧪 Test Suite Overview

**File**: `backend/src/__tests__/experimentHardening.validation.test.ts`

**Total Tests**: 20+ comprehensive validation tests

### Test Coverage

#### 1. SRM Detection (3 tests)
- ✅ Detects 80/20 split when expecting 50/50
- ✅ Passes with balanced 50/50 traffic
- ✅ Flags SRM in experiment results

#### 2. Minimum Sample Size (3 tests)
- ✅ Blocks winner with <1000 samples
- ✅ Allows winner with >=1000 samples
- ✅ Returns "Not enough data" message

#### 3. Guardrail Monitoring (5 tests)
- ✅ Detects latency spike (>1.2x baseline)
- ✅ Detects accuracy drop (>5%)
- ✅ Detects false correction rate spike (>10%)
- ✅ Passes with normal metrics
- ✅ Auto-stops experiment on violation

#### 4. Statistical Significance (3 tests)
- ✅ Detects significant difference (p < 0.05)
- ✅ No significance with equal variants
- ✅ No significance with small samples

#### 5. Auto-Winner Detection (3 tests)
- ✅ Detects winner (2%+ improvement, 1000+ samples, p<0.05)
- ✅ No winner when criteria not met
- ✅ Auto-deploys winner

#### 6. Edge Cases (3 tests)
- ✅ Handles zero clicks gracefully
- ✅ Handles equal variants
- ✅ Prevents zero division errors

---

## 🚀 How to Run

### Run All Validation Tests
```bash
cd backend
npm test -- experimentHardening.validation.test.ts
```

### Run Specific Test Suite
```bash
# SRM Detection only
npm test -- experimentHardening.validation.test.ts -t "SRM Detection"

# Guardrail Monitoring only
npm test -- experimentHardening.validation.test.ts -t "Guardrail Monitoring"

# Auto-Winner Detection only
npm test -- experimentHardening.validation.test.ts -t "Auto-Winner Detection"
```

---

## ✅ Success Criteria

All tests must pass:

- [ ] SRM Detection: 3/3 tests passing
- [ ] Sample Size Enforcement: 3/3 tests passing
- [ ] Guardrail Monitoring: 5/5 tests passing
- [ ] Statistical Significance: 3/3 tests passing
- [ ] Auto-Winner Detection: 3/3 tests passing
- [ ] Edge Cases: 3/3 tests passing

**Total**: 20/20 tests passing

---

## 🔍 Manual Verification Checklist

After automated tests pass, verify these manually:

### 1. Same User Consistency
```bash
# Call API twice with same userId
curl -X POST http://localhost:5001/api/voice/correct \
  -H "Content-Type: application/json" \
  -d '{"query": "greenlense", "userId": "user123"}'

# Expected:
# ✔ Same variant
# ✔ Same threshold
# ✔ Same corrected result
```

### 2. Different User Variation
```bash
# User A
curl -X POST http://localhost:5001/api/voice/correct \
  -H "Content-Type: application/json" \
  -d '{"query": "greenlense", "userId": "user123"}'

# User B
curl -X POST http://localhost:5001/api/voice/correct \
  -H "Content-Type: application/json" \
  -d '{"query": "greenlense", "userId": "user456"}'

# Expected:
# ✔ Different variants possible
# ✔ Different thresholds possible
# ✔ Deterministic per user
```

### 3. Metrics Match Variant
```javascript
// Check database
const metrics = await VoiceMetrics.find({ userId: 'user123' });
const apiResponse = await fetch('/api/voice/correct', {
  body: JSON.stringify({ query: 'test', userId: 'user123' })
});

// Expected:
// ✔ metrics.variant === apiResponse.variant
```

### 4. Failover Test
```bash
# Stop backend
# Try voice search in app

# Expected:
# ✔ Frontend falls back to local correction
# ✔ No crash
# ✔ User can still search
```

---

## 🧠 What Each Test Proves

### SRM Detection
**Proves**: System catches biased traffic before drawing conclusions
**Why Critical**: Biased traffic = invalid experiment results

### Sample Size Enforcement
**Proves**: System requires statistical power before declaring winner
**Why Critical**: Small samples = unreliable conclusions

### Guardrail Monitoring
**Proves**: System auto-stops when metrics degrade
**Why Critical**: Prevents shipping worse experience to users

### Statistical Significance
**Proves**: System validates winner with proper statistics
**Why Critical**: Prevents false positives from random noise

### Auto-Winner Detection
**Proves**: System deploys winner automatically when safe
**Why Critical**: Enables continuous improvement without manual intervention

---

## 🔥 System State After Validation

Once all tests pass, your system has:

✅ **Behavior Control** - Backend decides correction logic
✅ **Experiment Integrity** - Same variant → same behavior → same metrics
✅ **Statistical Validation** - P-value, sample size, confidence checks
✅ **Safety Mechanisms** - SRM, guardrails, auto-stop
✅ **Automation Loop** - Auto-deploy winner when safe

**Tier**: Production-Grade Experimentation Engine

---

## 📊 Expected Test Output

```
PASS  backend/src/__tests__/experimentHardening.validation.test.ts
  Task 12.1: SRM Detection (Traffic Integrity)
    ✓ should detect biased traffic split (80/20 instead of 50/50)
    ✓ should NOT detect SRM with balanced traffic (50/50)
    ✓ should detect SRM in experiment results
  Task 12.2: Minimum Sample Size Enforcement
    ✓ should block winner declaration with insufficient samples (<1000)
    ✓ should allow winner declaration with sufficient samples (>=1000)
    ✓ should return "Not enough data" in experiment results
  Task 12.3: Guardrail Monitoring
    ✓ should detect latency spike (>1.2x baseline)
    ✓ should detect accuracy degradation (>5% drop)
    ✓ should detect false correction rate spike (>10% increase)
    ✓ should pass with normal metrics
    ✓ should auto-stop experiment on guardrail violation
  Task 12.4: Statistical Significance
    ✓ should detect significant difference (p < 0.05) with clear winner
    ✓ should NOT detect significance with no difference
    ✓ should NOT detect significance with small sample size
  Task 12.5: Auto-Winner Detection and Deployment
    ✓ should detect winner with clear improvement (2%+, 1000+ samples, p<0.05)
    ✓ should NOT detect winner when criteria not met
    ✓ should auto-deploy winner when detected
  Task 12.5: Edge Cases
    ✓ should handle zero clicks gracefully (accuracy undefined)
    ✓ should handle equal variants (no winner)
    ✓ should prevent zero division in guardrail checks

Test Suites: 1 passed, 1 total
Tests:       20 passed, 20 total
```

---

## 🚀 After Validation

Once all tests pass and manual verification is complete, say:

**"phase 3 fully validated"**

Then we move to:

**Phase 4: Semantic AI (Embeddings + Vector Search)**

This is the final leap from rule-based matching to semantic understanding.

---

## 💬 Final Truth

Most people build features.
Few build systems.
Almost none build systems that validate themselves.

This validation suite proves your system is in the last category.

**Status**: Ready for execution
