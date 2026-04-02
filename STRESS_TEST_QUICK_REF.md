# Stress Test Quick Reference

## 🚀 Run Tests

```bash
# Jest test suite
cd apps/customer-app
npm test voiceCorrection.stress

# Standalone script
npx ts-node scripts/stressTest.ts
```

---

## 📊 Success Criteria

| Metric | Target | Pass/Fail |
|--------|--------|-----------|
| Accuracy | >85% | ✅ / ❌ |
| False Corrections | <5% | ✅ / ❌ |
| Avg Confidence | >0.7 | ✅ / ❌ |
| Avg Time | <20ms | ✅ / ❌ |
| Stability | No crash | ✅ / ❌ |

---

## 📋 Test Dataset (10,000 cases)

- **2,000** Misspellings ("greenlense" → "green lays")
- **2,000** Phonetic errors ("lase" → "lays")
- **2,000** Random noise ("grn lays" → "green lays")
- **2,000** Correct inputs ("green lays" → "green lays")
- **2,000** Multi-word ("2 green lays" → "green lays")

---

## 🔍 Quick Debug

### Low Accuracy (<85%)
```typescript
// Check dictionary
console.log(correctionEngine.getDictionary().length);

// Lower threshold
correctVoiceQuery(text, 0.5); // was 0.6
```

### High False Corrections (>5%)
```typescript
// Raise threshold
correctVoiceQuery(text, 0.7); // was 0.6
```

### Slow Performance (>20ms)
```typescript
// Check dictionary size
console.log(correctionEngine.getDictionary().length);
// Should be <1000 for 100 products
```

---

## 📁 Files

- **Test Suite:** `src/utils/__tests__/voiceCorrection.stress.test.ts`
- **Standalone:** `scripts/stressTest.ts`
- **Metrics:** `src/utils/__tests__/stressTestMetrics.ts`
- **Core Engine:** `src/utils/voiceCorrection.ts`

---

## 📈 Expected Output

```
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
```

---

## ✅ All Systems Go

If all metrics pass:
- System is production-ready
- Deploy with confidence
- Monitor in production

If any metric fails:
- Review failure cases
- Adjust thresholds
- Expand product catalog
- Re-run tests

---

## 🎯 One-Liner

```bash
cd apps/customer-app && npx ts-node scripts/stressTest.ts
```

**Expected:** All ✅ green checkmarks = Production ready 🚀
