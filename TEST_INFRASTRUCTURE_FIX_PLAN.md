# Test Infrastructure Fix Plan

## Executive Summary

**Current State**: 24 failed tests, 860 passed (97.3% pass rate)  
**Target State**: 0 failed tests, 884 passed (100% pass rate)  
**Root Cause**: Test infrastructure issues, NOT migration logic  
**Deployment Status**: ❌ BLOCKED until tests pass

---

## Critical Issues Identified

### 1. Redis Mock Timing Issue (HIGH PRIORITY)
**Impact**: 3 test failures + timeouts  
**Root Cause**: Redis mock initialization race condition

**Problem**:
- `jest.mock("redis")` is defined in `tests/setup.ts`
- But `src/config/redis.ts` imports `createClient` before mock is ready
- Tests that use rate limiting hit undefined `__redisExpiries`

**Error**:
```
TypeError: Cannot read properties of undefined (reading 'get')
  at isExpired (tests/setup.ts:34:35)
  at checkRiderRateLimit (src/domains/tracking/services/trackingRateLimit.ts:17:35)
```

**Affected Tests**:
- `tests/unit/trackingPhase0.test.ts` - POST /internal/tracking/location (INGEST_ONLY)
- `tests/integration/trackingPhase1.test.ts` - ingestion -> stream -> projection
- `tests/integration/trackingPhase3.test.ts` - (similar)

**Fix Strategy**:
1. Move Redis mock to a separate file that runs FIRST
2. Ensure `globalThis.__redisKv` and `globalThis.__redisExpiries` are initialized BEFORE any imports
3. Add explicit initialization check in rate limit service

---

### 2. createTestApp Not Found (CRITICAL)
**Impact**: Unknown number of failures (need full test output)  
**Root Cause**: Missing or incorrectly exported test helper

**Error**:
```
TypeError: createTestApp is not a function
```

**Affected Tests**:
- Payment tests
- Address tests  
- Backend polling tests

**Fix Strategy**:
1. Check if `tests/helpers/testApp.ts` exists
2. Verify export: `export function createTestApp() { ... }`
3. Ensure proper import in failing tests
4. If missing, create the helper function

---

### 3. API Routes Returning 404 (CRITICAL)
**Impact**: Multiple test failures  
**Root Cause**: Routes not registered in test app OR middleware blocking

**Error**:
```
Expected: 200 / 403 / 409
Received: 404
```

**Affected Routes**:
- `/api/payments/*`
- `/api/address/*`
- `/internal/*`

**Fix Strategy**:
1. Verify route registration in `createTestApp()`
2. Check middleware order (auth, error handlers)
3. Ensure feature flags don't block test routes
4. Add route debugging in test mode

---

### 4. Jest Open Handles Warning (MEDIUM)
**Impact**: Test suite doesn't exit cleanly  
**Root Cause**: Async resources not closed

**Warning**:
```
Jest did not exit one second after the test run has completed.
```

**Causes**:
- Redis connections not closed
- MongoDB connections not closed
- setInterval/setTimeout not cleared
- Background jobs still running

**Fix Strategy**:
1. Add `afterAll` cleanup in `setup-globals.ts`
2. Close Redis: `await redis.quit()`
3. Close Mongoose: `await mongoose.disconnect()`
4. Clear all intervals: `clearInterval(id)`
5. Run `npm test -- --detectOpenHandles` to find leaks

---

### 5. Mongoose Duplicate Index Warning (LOW)
**Impact**: None (just warnings)  
**Root Cause**: Index defined twice

**Warning**:
```
Duplicate schema index on {"phone":1} found
```

**Fix Strategy**:
1. Remove `index: true` from schema field definition
2. OR remove `schema.index({ phone: 1 })`
3. Keep only one index definition method

---

## Fix Execution Order

### Phase 1: Fix Redis Mock (TOP PRIORITY)

**File**: `backend/tests/setup-redis-mock.ts` (NEW)
```typescript
// This file MUST be imported FIRST before any other code
const g = globalThis as any;

// Initialize Redis mock stores IMMEDIATELY
if (!g.__redisKv) g.__redisKv = new Map<string, string>();
if (!g.__redisExpiries) g.__redisExpiries = new Map<string, number>();

g.__resetRedisMockStore = () => {
  g.__redisKv.clear();
  g.__redisExpiries.clear();
};

// Export for use in tests
export const __redisKv = g.__redisKv;
export const __redisExpiries = g.__redisExpiries;
```

**File**: `backend/jest.config.js` (UPDATE)
```javascript
module.exports = {
  // ... existing config
  setupFiles: [
    '<rootDir>/tests/setup-redis-mock.ts',  // ← ADD THIS FIRST
    '<rootDir>/tests/setup.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup-globals.ts'],
};
```

**File**: `backend/tests/setup.ts` (UPDATE)
```typescript
// Import the pre-initialized stores
import { __redisKv, __redisExpiries } from './setup-redis-mock';

// Now jest.mock("redis") can safely use them
jest.mock("redis", () => ({
  createClient: jest.fn(() => {
    const isExpired = (key: string): boolean => {
      const exp = __redisExpiries.get(key);  // ← Now guaranteed to exist
      if (!exp) return false;
      if (Date.now() <= exp) return false;
      __redisKv.delete(key);
      __redisExpiries.delete(key);
      return true;
    };
    
    // ... rest of mock implementation
  }),
}));
```

---

### Phase 2: Fix createTestApp

**Check if file exists**:
```bash
ls -la backend/tests/helpers/testApp.ts
```

**If missing, create**: `backend/tests/helpers/testApp.ts`
```typescript
import { createApp } from '../../src/createApp';

export function createTestApp(options: any = {}) {
  return createApp({
    disableRedis: false,  // Use mocked Redis
    disableQueues: true,
    disableExternalApis: true,
    ...options,
  });
}
```

**Update failing tests**:
```typescript
import { createTestApp } from '../helpers/testApp';

const app = createTestApp();
```

---

### Phase 3: Fix 404 Routes

**File**: `backend/tests/helpers/testApp.ts` (UPDATE)
```typescript
export function createTestApp(options: any = {}) {
  const app = createApp({
    disableRedis: false,
    disableQueues: true,
    disableExternalApis: true,
    ...options,
  });
  
  // Ensure all routes are registered
  // (This should happen in createApp, but verify)
  
  // Debug middleware (test mode only)
  if (process.env.NODE_ENV === 'test') {
    app.use((req, res, next) => {
      console.log(`[TEST] ${req.method} ${req.path}`);
      next();
    });
  }
  
  return app;
}
```

**Verify route registration in**: `backend/src/createApp.ts`
```typescript
// Ensure these are present:
app.use('/api/payments', paymentRoutes);
app.use('/api/address', addressRoutes);
app.use('/api/internal', internalRoutes);
```

---

### Phase 4: Fix Jest Open Handles

**File**: `backend/tests/setup-globals.ts` (UPDATE)
```typescript
afterAll(async () => {
  const g = globalThis as GlobalWithMongo;

  // Close MongoDB
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase().catch(() => undefined);
    await mongoose.connection.close().catch(() => undefined);
    await mongoose.disconnect().catch(() => undefined);
  }

  // Close Redis (NEW)
  try {
    const { redis } = require("../src/config/redis");
    if (redis && typeof redis.quit === "function") {
      await redis.quit().catch(() => undefined);
    }
  } catch {
    // ignore
  }

  // Clear all intervals (NEW)
  if (g.__jestIntervalIds?.length) {
    for (const id of g.__jestIntervalIds) {
      try {
        clearInterval(id);
      } catch {
        // ignore
      }
    }
  }

  // Clear all timeouts (NEW)
  if (g.__jestTimeoutIds?.length) {
    for (const id of g.__jestTimeoutIds) {
      try {
        clearTimeout(id);
      } catch {
        // ignore
      }
    }
  }

  // Restore original functions
  if (g.__jestOriginalSetInterval) {
    (globalThis as any).setInterval = g.__jestOriginalSetInterval;
  }
  if (g.__jestOriginalSetTimeout) {
    (globalThis as any).setTimeout = g.__jestOriginalSetTimeout;
  }

  delete g.__jestOriginalSetInterval;
  delete g.__jestOriginalSetTimeout;
  delete g.__jestIntervalIds;
  delete g.__jestTimeoutIds;
});
```

---

### Phase 5: Fix Duplicate Index Warnings

**Find duplicate indexes**:
```bash
grep -r "phone.*index.*true" backend/src/models/
grep -r "schema.index.*phone" backend/src/models/
```

**Fix**: Choose ONE method per field
```typescript
// Option 1: Field-level index
phone: { type: String, required: true, unique: true, index: true }

// Option 2: Schema-level index
phone: { type: String, required: true, unique: true }
schema.index({ phone: 1 }, { unique: true });

// ❌ DON'T DO BOTH
```

---

## Verification Steps

After each phase, run:
```bash
cd backend && npm test
```

**Expected Progress**:
- Phase 1: 21 failed → 18 failed (Redis tests pass)
- Phase 2: 18 failed → 15 failed (createTestApp tests pass)
- Phase 3: 15 failed → 0 failed (404 tests pass)
- Phase 4: 0 failed, Jest exits cleanly
- Phase 5: 0 failed, no warnings

---

## Success Criteria

✅ **Test Suites**: 94 passed, 0 failed  
✅ **Tests**: 884 passed, 0 failed  
✅ **Jest**: Exits cleanly (no open handles)  
✅ **Warnings**: No duplicate index warnings  
✅ **Deployment**: READY

---

## Rollback Plan

If fixes break more tests:

1. **Revert changes**:
   ```bash
   git checkout backend/tests/
   ```

2. **Restore original state**:
   ```bash
   git stash
   ```

3. **Re-run tests**:
   ```bash
   npm test
   ```

4. **Report issues** with full test output

---

## Timeline Estimate

- Phase 1 (Redis Mock): 30 minutes
- Phase 2 (createTestApp): 15 minutes
- Phase 3 (404 Routes): 30 minutes
- Phase 4 (Open Handles): 20 minutes
- Phase 5 (Duplicate Index): 10 minutes

**Total**: ~2 hours

---

## Next Steps

1. Execute Phase 1 (Redis Mock fix)
2. Run tests and verify 3 failures resolved
3. Execute Phase 2 (createTestApp fix)
4. Continue through phases sequentially
5. Document any unexpected issues
6. Final verification with full test suite

---

**Generated**: April 5, 2026  
**Status**: Ready for execution  
**Priority**: CRITICAL (deployment blocker)
