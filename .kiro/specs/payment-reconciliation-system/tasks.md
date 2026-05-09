# Implementation Plan: Payment Reconciliation System

## Overview

Implement a production-grade financial correctness engine that runs alongside the existing payment infrastructure. The system adds 4-way consistency checking, zombie recovery with retry caps, idempotency auditing, tiered alerting, and crash-safe replay on top of the existing `paymentReconciliationService.ts` and `stuckPaymentScanner.ts` patterns.

All code is TypeScript. Files live under `backend/src/domains/payments/`.

**Production hardening incorporated:** Razorpay truth cache (Issue 1), ledger write idempotency (Issue 2), audit-log-first invariant (Issue 3), global concurrency limiter (Issue 4), dead-letter handling (Issue 5). See design.md §15 for full details.

## Tasks

- [x] 1. Create MongoDB schemas for reconciliation models
  - [x] 1.1 Create `ReconciliationRun` model
    - Create `backend/src/domains/payments/models/ReconciliationRun.ts`
    - Define `IReconciliationRun` interface with fields: `runId`, `subService`, `status`, `startedAt`, `completedAt`, `failedAt`, `abandonedAt`, `error`, `processedCount`, `anomalyCount`, `autoFixedCount`
    - Export `ReconciliationRunStatus` and `SubServiceName` union types
    - Add compound index `{ subService: 1, status: 1, startedAt: -1 }` and unique index `{ runId: 1 }`
    - _Requirements: 5.4, 5.5, 5.6, 6.1_

  - [x] 1.2 Create `ReconciliationAuditLog` model
    - Create `backend/src/domains/payments/models/ReconciliationAuditLog.ts`
    - Define `IReconciliationAuditLog` interface with all required fields including `dedupeKey`, `category`, `action`, `alertSeverity`, `beforeState`, `afterState`
    - Export `AnomalyType`, `FixAction`, and `AlertSeverity` union types
    - Add unique index on `dedupeKey`, compound indexes on `{ orderId, recordedAt }`, `{ runId, recordedAt }`, `{ category, recordedAt }`
    - _Requirements: 6.1, 6.2, 6.3, 3.12_

  - [x] 1.3 Create `ReconciliationReport` model
    - Create `backend/src/domains/payments/models/ReconciliationReport.ts`
    - Define `IReconciliationReport` interface with all anomaly count fields, `mismatchCount`, `mismatchRate`, `autoFixedCount`, `manualReviewCount`, `criticalAnomalyCount`, `errorCount`
    - Add unique index on `runId`, indexes on `{ generatedAt: -1 }` and `{ subService: 1, generatedAt: -1 }`
    - _Requirements: 3.1, 3.9_

  - [x] 1.4 Create `DailyReconciliationSummary` model
    - Create `backend/src/domains/payments/models/DailyReconciliationSummary.ts`
    - Define `IDailyReconciliationSummary` interface with `date` (YYYY-MM-DD, unique), `totalRuns`, `totalScanned`, `totalMismatches`, `totalAutoFixed`, `totalManualReview`, `peakMismatchRate`, `criticalAnomalyCount`
    - Add unique index on `date`
    - _Requirements: 3.9_

  - [x] 1.5 Extend existing `PaymentIntent` and `Order` models
    - Add `zombieRecoveryAttempts: number` (default 0) to `PaymentIntent` schema
    - Add partial index on `{ zombieRecoveryAttempts: 1 }` where `gatewayOrderId` is missing
    - Add `lastReconciledAt?: Date`, `reconciliationFlag?: string`, and `reconciliationErrorCount: number` (default 0) to `Order` schema
    - Add `reconciliationErrorCount: number` (default 0) to `PaymentIntent` schema
    - Add partial unique index `{ paymentIntentId: 1, eventType: 1 }` where `eventType = 'CAPTURE'` to `LedgerEntry` schema (belt-and-suspenders against duplicate CAPTURE entries)
    - _Requirements: 2.2, 1.3, 1.4; Design §15.2, §15.5_

- [x] 2. Implement the Fix Engine and Production Hardening Utilities
  - [x] 2.1 Create `concurrencyLimiter.ts` with global rate limiters (Issue 4)
    - Create `backend/src/domains/payments/services/reconciliation/concurrencyLimiter.ts`
    - Implement `ConcurrencyLimiter` class with `run<T>(fn): Promise<T>` method using a semaphore queue
    - Export `razorpayLimiter` (default max 5) and `dbWriteLimiter` (default max 10) singleton instances
    - Accept `maxConcurrentRazorpayCalls` and `maxConcurrentDbWrites` from `ReconciliationConfig`
    - _Design: §15.4_

  - [x] 2.2 Create `razorpayStatusCache.ts` with in-process truth cache (Issue 1)
    - Create `backend/src/domains/payments/services/reconciliation/razorpayStatusCache.ts`
    - Implement `RazorpayStatusCache` class with `get(gatewayOrderId)`, `set(gatewayOrderId, data)`, and `clear()` methods
    - Default TTL: 5 minutes (configurable via `razorpayCacheTtlMs` in `ReconciliationConfig`)
    - One cache instance per run — cleared at run end to prevent stale data across runs
    - _Design: §15.1_

  - [x] 2.3 Create `fixEngine.ts` with idempotent `applyFix` function (Issue 3)
    - Create `backend/src/domains/payments/services/reconciliation/fixEngine.ts`
    - Implement `applyFix(args: FixArgs): Promise<{ applied: boolean }>` that writes the audit log entry FIRST, then executes the optional `fix` callback
    - Handle E11000 duplicate key errors on `dedupeKey` as a no-op returning `{ applied: false }`
    - Export `ANOMALY_SEVERITY` map assigning `AlertSeverity` to each `AnomalyType`
    - Wrap all `fix` callback executions with `dbWriteLimiter.run(...)` from `concurrencyLimiter.ts`
    - Add `dryRun?: boolean` parameter: when true, write audit log with `action = 'NO_OP'` and skip the `fix` callback
    - _Requirements: 1.10, 2.8, 6.1, 6.4, 6.7; Design: §15.3_

  - [x] 2.4 Write unit tests for `applyFix` and `ConcurrencyLimiter`
    - Test that audit log is written before fix callback executes
    - Test that duplicate `dedupeKey` returns `{ applied: false }` without throwing
    - Test that a DB error other than E11000 is re-thrown
    - Test `dryRun = true`: audit log written with NO_OP, fix callback NOT called
    - Test `ConcurrencyLimiter`: max concurrent executions never exceeds configured limit
    - _Requirements: 6.4; Design: §15.3, §15.4_

- [x] 3. Implement the Alerting Service
  - [x] 3.1 Create `reconciliationAlertService.ts` with `AlertChannel` interface and `LogAlertChannel`
    - Create `backend/src/domains/payments/services/reconciliation/reconciliationAlertService.ts`
    - Define `AlertChannel` interface with `sendAlert(report, severity): Promise<void>`
    - Implement `LogAlertChannel` that writes structured JSON at `error`/`warn`/`info` level with label `[RECONCILIATION_ALERT]`
    - _Requirements: 3.2, 3.3, 3.6, 3.7_

  - [x] 3.2 Write unit tests for `LogAlertChannel`
    - Test that CRITICAL severity logs at `error` level
    - Test that WARNING severity logs at `warn` level
    - Test that INFO severity logs at `info` level
    - Test that log output contains `[RECONCILIATION_ALERT]` label and full report fields
    - _Requirements: 3.7_

- [x] 4. Implement the Report Service
  - [x] 4.1 Create `reconciliationReportService.ts`
    - Create `backend/src/domains/payments/services/reconciliation/reconciliationReportService.ts`
    - Implement `persistReport(runId, subService, counts): Promise<IReconciliationReport>` that saves a `ReconciliationReport` document
    - Implement `generateDailySummary(dateUtc: string): Promise<IDailyReconciliationSummary>` that aggregates all reports for the given UTC date and upserts a `DailyReconciliationSummary`; catch and log errors with `[RECONCILIATION_DAILY_SUMMARY_FAILED]` without crashing
    - Implement `getReconciliationReports(query)` with cursor-based pagination (default limit 50, max 200) returning results in reverse-chronological order
    - _Requirements: 3.1, 3.8, 3.9, 3.10_

  - [x] 4.2 Write unit tests for `reconciliationReportService`
    - Test `persistReport` saves correct field values
    - Test `generateDailySummary` aggregates counts correctly across multiple reports
    - Test `generateDailySummary` does not throw when no reports exist for the date
    - Test `getReconciliationReports` returns results in reverse-chronological order and respects limit/cursor
    - _Requirements: 3.8, 3.9, 3.10_

- [x] 5. Implement the Ledger Consistency Scanner
  - [x] 5.1 Implement core `evaluateConsistency` function
    - Create `backend/src/domains/payments/services/reconciliation/ledgerConsistencyScanner.ts`
    - Implement `evaluateConsistency(order, paymentIntent, ledgerEntry, razorpay): ConsistencyResult` covering all six anomaly branches: `FALSE_PAID`, `PARTIAL_CAPTURE`, `MISSING_LEDGER`, `AMOUNT_MISMATCH`, `PI_STATUS_MISMATCH`, and the clean path
    - Use 1-paise tolerance for amount comparison
    - _Requirements: 1.2, 1.4, 1.5, 1.6, 1.7, 1.9_

  - [x] 5.2 Write property test for `evaluateConsistency`
    - **Property: Completeness** — for any combination of (order, pi, ledger, razorpay) inputs, `evaluateConsistency` always returns either `{ ok: true }` or `{ ok: false, anomaly, details }` and never throws
    - **Property: FALSE_PAID priority** — when `razorpay.captured = false` and `razorpay.authorized = false`, result is always `FALSE_PAID` regardless of other fields
    - **Validates: Requirements 1.2, 1.4**

  - [x] 5.3 Implement the forward scan (PAID orders → 4-way check)
    - Implement cursor-paginated scan of PAID orders within lookback window (default 48h), batch size 200
    - Exclude orders with `reconciliationFlag = 'DEAD_LETTER'` from the scan query
    - For each order: fetch PaymentIntent, fetch LedgerEntry (CAPTURE), fetch Razorpay status via `razorpayLimiter.run(...)` with cache lookup first (Issue 1)
    - Use `fetchWithRetry` with exponential backoff (500ms, 1000ms, 2000ms) for Razorpay calls
    - Call `evaluateConsistency`; on anomaly call `applyFix` via `dbWriteLimiter.run(...)` (Issue 4)
    - For MISSING_LEDGER auto-fix: call `appendLedgerEntry` with `dedupeKey = "ledger_backfill:{gatewayEventId}"` inside the `fix` callback — never call `LedgerEntry.create` directly (Issue 2)
    - On CRITICAL anomaly (FALSE_PAID, AMOUNT_MISMATCH): also call `alertChannel.sendAlert(CRITICAL)` immediately
    - On Razorpay API error: increment `order.reconciliationErrorCount` via `$inc`; if count reaches 5, apply dead-letter fix (Issue 5)
    - On clean result: update `order.lastReconciledAt`
    - Sleep 50ms between items
    - _Requirements: 1.1–1.13, 5.10; Design: §15.1, §15.2, §15.3, §15.4, §15.5_

  - [x] 5.4 Implement the reverse scan (ORPHAN_LEDGER detection)
    - Implement aggregation-based scan of CAPTURE LedgerEntries joined to their Orders
    - Flag entries where the associated Order does not have `paymentStatus = PAID` as `ORPHAN_LEDGER`
    - Call `applyFix` with `action = FLAGGED_FOR_REVIEW`; accumulate for end-of-run WARNING alert
    - _Requirements: 1.8_

  - [x] 5.5 Wire scanner into a single exported `runLedgerConsistencyScanner(runId, config, alertChannel)` function
    - Run forward scan then reverse scan
    - Collect all counts and return a `RunCounts` object for report persistence
    - _Requirements: 1.1, 1.8_

  - [x] 5.6 Write unit tests for the Ledger Consistency Scanner
    - Test FALSE_PAID path: `applyFix` called with FLAGGED_FOR_REVIEW and CRITICAL alert fired immediately
    - Test MISSING_LEDGER path: `appendLedgerEntry` called and `applyFix` called with AUTO_FIXED
    - Test AMOUNT_MISMATCH path: CRITICAL alert fired immediately
    - Test PI_STATUS_MISMATCH path: PaymentIntent updated via compare-and-set
    - Test ORPHAN_LEDGER path: flagged, no DB change to Order
    - Test Razorpay error: item skipped, `errorCount` incremented, scan continues
    - Test idempotency: running twice over same window produces same final state
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 1.11, 1.13_

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement the Zombie Recovery Scanner
  - [x] 7.1 Implement atomic claim and hard-limit check
    - Create `backend/src/domains/payments/services/reconciliation/zombieRecoveryScanner.ts`
    - Implement scan query: `gatewayCreateAttemptedAt` set, `gatewayOrderId` absent, `zombieRecoveryAttempts < 3`, status not terminal, `isLocked != true`, batch 100, sorted by `lastScannedAt` ascending
    - Implement atomic `$inc` of `zombieRecoveryAttempts` with optimistic concurrency check (`modifiedCount === 0` → skip)
    - Implement hard-limit check: `zombieRecoveryAttempts >= 3` OR age > 30 minutes → permanent failure path
    - _Requirements: 2.1, 2.2, 2.7_

  - [x] 7.2 Implement the three recovery paths (link, recoverable, skip)
    - **Link path**: Razorpay order found → atomic compare-and-set `gatewayOrderId` with `{ $exists: false }` guard; transition status to `GATEWAY_ORDER_CREATED`; call `applyFix`
    - **Recoverable path**: No Razorpay order AND age > 10 min → call `paymentIntentStateMachine.assertAllowedTransition` then transition to `PAYMENT_RECOVERABLE`; call `applyFix`
    - **Skip path**: No Razorpay order AND age ≤ 10 min → advance `lastScannedAt` only
    - Sleep 50ms between items; log and skip on Razorpay API error
    - _Requirements: 2.3, 2.4, 2.5, 2.6, 2.9, 2.10_

  - [x] 7.3 Implement permanent failure path (audit-log-first)
    - All writes to `PaymentIntent` and `Order` must happen inside the `fix` callback of `applyFix` — never before it (Issue 3)
    - Inside `fix` callback: mark PaymentIntent `FAILED` with `lockReason = "ZOMBIE_MAX_RETRIES"` and `isLocked = true` using versioned update; mark associated Order `paymentStatus = FAILED` only if still `PENDING`
    - Call `applyFix` with `category = ZOMBIE_GATEWAY_RECOVERY`, `action = AUTO_FIXED`, wrapped in `dbWriteLimiter.run(...)`
    - _Requirements: 2.7, 2.8; Design: §15.3_

  - [x] 7.4 Wire into exported `runZombieRecoveryScanner(runId, config, alertChannel)` function
    - Return `RunCounts` for report persistence
    - _Requirements: 2.1_

  - [x] 7.5 Write unit tests for the Zombie Recovery Scanner
    - Test atomic claim: `modifiedCount === 0` causes skip
    - Test link path: `gatewayOrderId` set atomically, status → `GATEWAY_ORDER_CREATED`, `applyFix` called
    - Test recoverable path: `assertAllowedTransition` called, status → `PAYMENT_RECOVERABLE`
    - Test skip path: only `lastScannedAt` updated when age ≤ 10 min
    - Test permanent failure: PI marked FAILED, Order marked FAILED only if PENDING
    - Test idempotency: second run with same intents produces no additional audit entries
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.10_

- [x] 8. Implement the Idempotency Auditor
  - [x] 8.1 Implement missing/malformed key scan
    - Create `backend/src/domains/payments/services/reconciliation/idempotencyAuditor.ts`
    - Scan Orders within lookback window (default 24h) for missing, null, empty, or non-UUID-v4 `idempotencyKey`
    - For each violation call `applyFix` with `dedupeKey = "IDEMPOTENCY_VIOLATION:{orderId}:FLAGGED_FOR_REVIEW"` and `action = FLAGGED_FOR_REVIEW`
    - Never modify Order documents
    - _Requirements: 4.1, 4.2, 4.3, 4.8_

  - [x] 8.2 Implement duplicate idempotency key detection
    - Run aggregation `$group` on `{ userId, idempotencyKey }` with `$sum: 1`, filter count > 1
    - For each duplicate group call `applyFix` with `dedupeKey = "IDEMPOTENCY_VIOLATION:dup_key:{userId}:{idempotencyKey}:FLAGGED_FOR_REVIEW"`
    - _Requirements: 4.4, 4.5_

  - [x] 8.3 Implement cart-hash duplicate detection
    - Run aggregation `$group` on `{ userId, cartHash }` with `$push: { _id, createdAt }`, filter count > 1
    - Post-filter: only flag pairs where `createdAt` delta < 300 seconds
    - For each violation call `applyFix` with `dedupeKey = "IDEMPOTENCY_VIOLATION:dup_cart:{userId}:{cartHash}:FLAGGED_FOR_REVIEW"`, include time delta in `afterState`
    - _Requirements: 4.6, 4.7_

  - [x] 8.4 Wire into exported `runIdempotencyAuditor(runId, config)` function
    - Return `RunCounts` for report persistence
    - _Requirements: 4.1, 4.9_

  - [x] 8.5 Write unit tests for the Idempotency Auditor
    - Test missing key: audit entry created, Order not modified
    - Test malformed key (non-UUID-v4): audit entry created
    - Test duplicate idempotency key: one audit entry per duplicate group
    - Test cart-hash duplicate within 5 min: audit entry created with correct delta
    - Test cart-hash duplicate beyond 5 min: NOT flagged
    - Test idempotency: second run produces same set of audit entries (dedupeKey prevents duplicates)
    - _Requirements: 4.3, 4.5, 4.7, 4.8, 4.9_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement the Reconciliation Orchestrator
  - [x] 10.1 Implement `acquireRunLock` and `recoverAbandonedRuns`
    - Create `backend/src/domains/payments/services/reconciliation/reconciliationOrchestrator.ts`
    - Implement `acquireRunLock(subService, intervalMs)`: query for existing RUNNING run within 2× interval window; if found log `[RECONCILIATION_OVERLAP_SKIPPED]` and return null; otherwise create and return new `ReconciliationRun` document
    - Implement `recoverAbandonedRuns()`: for each sub-service, `updateMany` RUNNING runs older than 2× interval to ABANDONED; log `[RECONCILIATION_RUNS_ABANDONED]` if any updated
    - _Requirements: 5.4, 5.7_

  - [x] 10.2 Implement consecutive failure guard and sub-service runner
    - Implement `runWithFailureGuard(subService, fn, maxFailures)`: call `fn()`, reset counter on success; on error increment counter, log at ERROR; if counter reaches 10 log `[RECONCILIATION_FATAL]` and call `process.exit(1)`
    - Implement internal `runSubService(subService, config)` that: acquires lock → runs scanner → persists report → sends end-of-run alerts → updates ReconciliationRun to COMPLETED/FAILED
    - _Requirements: 5.5, 5.6, 5.8, 5.9_

  - [x] 10.3 Implement `startReconciliationSystem` with scheduling
    - Guard against double-start: if already started, log warning and return
    - Schedule Ledger_Checker every 60 min (configurable), Zombie_Recoverer every 15 min (configurable), Idempotency_Auditor every 60 min (configurable)
    - Schedule daily summary at 01:00 UTC (configurable `dailySummaryHourUtc`)
    - Call `recoverAbandonedRuns()` on startup before first scheduled run
    - Initialize `razorpayLimiter` and `dbWriteLimiter` from config values `maxConcurrentRazorpayCalls` and `maxConcurrentDbWrites`
    - Pass `dryRun` flag from config through to all sub-services
    - _Requirements: 5.1, 5.2, 5.3; Design: §15.4_

  - [x] 10.4 Implement `runReconciliationOnce` for tests and admin use
    - Accept optional `subService` parameter; if omitted run all four sub-services sequentially
    - Bypass overlap check (do not call `acquireRunLock`)
    - Return combined `ReconciliationRunResult` with counts per sub-service
    - _Requirements: 5.11_

  - [x] 10.5 Write unit tests for the orchestrator
    - Test `acquireRunLock` returns null when RUNNING run exists within overlap window
    - Test `acquireRunLock` creates new run when no overlap
    - Test `recoverAbandonedRuns` marks stale RUNNING runs as ABANDONED
    - Test double-start guard: second call to `startReconciliationSystem` logs warning and does not create duplicate timers
    - Test consecutive failure counter resets on success
    - Test `process.exit(1)` called after 10 consecutive failures
    - _Requirements: 5.2, 5.4, 5.7, 5.8, 5.9_

- [x] 11. Create the reconciliation module index and wire into app startup
  - [x] 11.1 Create `index.ts` re-exporting public API
    - Create `backend/src/domains/payments/services/reconciliation/index.ts`
    - Re-export `startReconciliationSystem`, `runReconciliationOnce`, `recoverAbandonedRuns`
    - Re-export type aliases: `SubServiceName`, `AnomalyType`, `FixAction`, `AlertSeverity`, `ReconciliationConfig`
    - _Requirements: 5.1, 5.11_

  - [x] 11.2 Wire `startReconciliationSystem` into the application bootstrap
    - Find the existing app startup file (e.g., `server.ts` or `app.ts`) and call `startReconciliationSystem()` after the MongoDB connection is established
    - Ensure `recoverAbandonedRuns()` is called before the first scheduled run (already handled inside `startReconciliationSystem`)
    - _Requirements: 5.1, 5.7_

  - [x] 11.3 Write integration tests for end-to-end reconciliation flow
    - Seed a FALSE_PAID order (PAID in DB, not captured in Razorpay mock) and verify CRITICAL alert fires and audit entry is created
    - Seed a MISSING_LEDGER order and verify `appendLedgerEntry` is called and audit entry has `AUTO_FIXED`
    - Seed a zombie PaymentIntent and verify it transitions to `PAYMENT_RECOVERABLE` after 10 min age
    - Seed a zombie with 3 attempts and verify it is permanently marked FAILED
    - Seed an order with missing `idempotencyKey` and verify audit entry is created without Order modification
    - Run the same scenario twice and verify no duplicate audit entries (dedupeKey idempotency)
    - _Requirements: 1.11, 2.10, 4.9, 6.4, 6.7_

- [x] 12. Add `getAuditLogsForOrder` query function
  - Implement `getAuditLogsForOrder(orderId: string, limit?: number): Promise<IReconciliationAuditLog[]>` in `reconciliationReportService.ts` (or a dedicated `reconciliationQueryService.ts`)
  - Return entries in reverse-chronological order; return empty array for invalid ObjectId without throwing
  - _Requirements: 6.5, 6.6_

  - [x] 12.1 Write unit tests for `getAuditLogsForOrder`
    - Test returns entries in reverse-chronological order
    - Test returns empty array for invalid ObjectId string
    - Test respects `limit` parameter
    - _Requirements: 6.5, 6.6_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- The Fix Engine (`fixEngine.ts`) is the single write path for all corrective actions — never bypass it
- The audit log is append-only; no update or delete operations should ever target `ReconciliationAuditLog`
- All Razorpay calls must go through `fetchWithRetry` (exponential backoff: 500ms, 1000ms, 2000ms)
- 50ms inter-item sleep is mandatory in all batch loops to prevent DB and API saturation
- The design document's `evaluateConsistency` function and all scanner algorithms should be followed precisely
