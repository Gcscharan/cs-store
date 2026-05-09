# AUTO-FIX PROMPT FOR ALL FAILING TESTS

Copy and paste this entire prompt into Kiro to automatically fix all test infrastructure issues.

---

## CONTEXT

You are fixing test infrastructure issues in a Node.js/TypeScript backend. The migration logic is correct, but tests are failing due to infrastructure problems.

**Current State**: 24 failed tests, 860 passed  
**Target State**: 0 failed tests, 884 passed  
**Root Causes**: Redis mock timing, test timeouts, missing helpers, 404 routes

---

## TASK 1: Fix Redis Mock Initialization (COMPLETED ✅)

The following files have been created/updated:
- `backend/tests/setup-redis-mock.ts` (NEW)
- `backend/jest.config.js` (UPDATED - setupFiles order)
- `backend/tests/setup.ts` (UPDATED - imports from setup-redis-mock)

**Status**: Redis mock stores are now initialized before any code runs.

---

## TASK 2: Fix Tracking Test Timeouts (HIGH PRIORITY)

**Problem**: Tests in `trackingPhase0.test.ts`, `trackingPhase1.test.ts`, and `trackingPhase3.test.ts` are timing out after 120 seconds.

**Root Cause**: The 4th test in trackingPhase0 ("POST /internal/tracking/location accepts when kill switch is INGEST_ONLY") is hanging.

**Fix**:

1. Read the full test file:
   ```
   backend/tests/unit/trackingPhase0.test.ts
   ```

2. Check if the test is missing assertions or has infinite loops

3. Add explicit timeout to the problematic test:
   ```typescript
   it("POST /internal/tracking/location accepts when kill switch is INGEST_ONLY", async () => {
     // ... test code
   }, 30000); // 30 second timeout instead of 120
   ```

4. Check if the test is waiting for async operations that never complete

5. Add debug logging to see where it hangs:
   ```typescript
   console.log('[TEST] Before request');
   const res = await request(app).post(...);
   console.log('[TEST] After request, status:', res.status);
   ```

---

## TASK 3: Fix createTestApp Issues

**Problem**: Some tests report "createTestApp is not a function"

**Fix**:

1. Check if file exists:
   ```bash
   ls -la backend/tests/helpers/testApp.ts
   ```

2. If missing, create `backend/tests/helpers/testApp.ts`:
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

3. Find all tests that import createTestApp and verify the import path:
   ```bash
   grep -r "createTestApp" backend/tests/
   ```

4. Update imports to use the correct path:
   ```typescript
   import { createTestApp } from '../helpers/testApp';
   ```

---

## TASK 4: Fix 404 Route Issues

**Problem**: Tests expecting 200/403/409 are getting 404

**Affected Routes**:
- `/api/payments/*`
- `/api/address/*`
- `/api/internal/*`

**Fix**:

1. Read `backend/src/createApp.ts` and verify all routes are registered:
   ```typescript
   app.use('/api/payments', paymentRoutes);
   app.use('/api/address', addressRoutes);
   app.use('/api/internal', internalRoutes);
   ```

2. Check if routes are conditionally registered (feature flags, env vars)

3. Ensure test environment doesn't skip route registration

4. Add debug middleware in test mode:
   ```typescript
   if (process.env.NODE_ENV === 'test') {
     app.use((req, res, next) => {
       console.log(`[ROUTE] ${req.method} ${req.path}`);
       next();
     });
   }
   ```

5. Run a single failing test with route debugging to see what's registered

---

## TASK 5: Fix Jest Open Handles

**Problem**: Jest doesn't exit cleanly after tests complete

**Fix**:

1. Update `backend/tests/setup-globals.ts` afterAll hook:
   ```typescript
   afterAll(async () => {
     const g = globalThis as GlobalWithMongo;

     // Close MongoDB
     if (mongoose.connection.readyState !== 0) {
       await mongoose.connection.dropDatabase().catch(() => undefined);
       await mongoose.connection.close().catch(() => undefined);
       await mongoose.disconnect().catch(() => undefined);
     }

     // Close Redis
     try {
       const { redis } = require("../src/config/redis");
       if (redis && typeof redis.quit === "function") {
         await redis.quit().catch(() => undefined);
       }
     } catch {
       // ignore
     }

     // Clear all intervals
     if (g.__jestIntervalIds?.length) {
       for (const id of g.__jestIntervalIds) {
         try {
           clearInterval(id);
         } catch {
           // ignore
         }
       }
     }

     // Clear all timeouts
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

2. Track setTimeout as well as setInterval:
   ```typescript
   beforeAll(async () => {
     const g = globalThis as GlobalWithMongo;

     // Track setInterval
     if (!g.__jestOriginalSetInterval) {
       g.__jestOriginalSetInterval = globalThis.setInterval;
       g.__jestIntervalIds = [];
       (globalThis as any).setInterval = (...args: any[]) => {
         const id = (g.__jestOriginalSetInterval as any)(...args);
         (g.__jestIntervalIds as any[]).push(id);
         return id;
       };
     }

     // Track setTimeout (NEW)
     if (!g.__jestOriginalSetTimeout) {
       g.__jestOriginalSetTimeout = globalThis.setTimeout;
       g.__jestTimeoutIds = [];
       (globalThis as any).setTimeout = (...args: any[]) => {
         const id = (g.__jestOriginalSetTimeout as any)(...args);
         (g.__jestTimeoutIds as any[]).push(id);
         return id;
       };
     }

     // ... rest of beforeAll
   });
   ```

3. Run tests with open handle detection:
   ```bash
   npm test -- --detectOpenHandles
   ```

4. Fix any reported open handles

---

## TASK 6: Fix Duplicate Index Warnings

**Problem**: Mongoose warns about duplicate indexes on phone, orderId, productId, name

**Fix**:

1. Find duplicate index definitions:
   ```bash
   grep -r "phone.*index.*true" backend/src/models/
   grep -r "schema.index.*phone" backend/src/models/
   ```

2. For each field with duplicates, choose ONE method:
   ```typescript
   // Option 1: Field-level index (RECOMMENDED)
   phone: { type: String, required: true, unique: true, index: true }

   // Option 2: Schema-level index
   phone: { type: String, required: true, unique: true }
   schema.index({ phone: 1 }, { unique: true });

   // ❌ DON'T DO BOTH
   ```

3. Remove the duplicate definition

4. Repeat for: orderId, productId, name

---

## TASK 7: Run Full Test Suite and Analyze

After completing tasks 2-6, run the full test suite:

```bash
cd backend && npm test 2>&1 | tee test-results.txt
```

**Expected Results**:
- All tracking tests pass (no timeouts)
- No createTestApp errors
- No 404 errors on valid routes
- Jest exits cleanly
- No duplicate index warnings

**If tests still fail**:
1. Read `test-results.txt`
2. Identify remaining failure patterns
3. Fix systematically (one pattern at a time)
4. Re-run tests after each fix

---

## SUCCESS CRITERIA

✅ Test Suites: 94 passed, 0 failed  
✅ Tests: 884 passed, 0 failed  
✅ Jest: Exits cleanly (no open handles warning)  
✅ Warnings: No duplicate index warnings  
✅ Deployment: READY

---

## EXECUTION ORDER

1. ✅ Task 1: Redis Mock (DONE)
2. ⏳ Task 2: Fix Tracking Timeouts (IN PROGRESS)
3. ⏳ Task 3: Fix createTestApp
4. ⏳ Task 4: Fix 404 Routes
5. ⏳ Task 5: Fix Open Handles
6. ⏳ Task 6: Fix Duplicate Indexes
7. ⏳ Task 7: Full Test Suite

---

## NOTES

- Work on ONE task at a time
- Run tests after EACH task to verify progress
- Don't move to next task until current one is fixed
- Document any unexpected issues
- If stuck, ask for help with specific error messages

---

**Generated**: April 5, 2026  
**Status**: Ready for execution  
**Priority**: CRITICAL (deployment blocker)
