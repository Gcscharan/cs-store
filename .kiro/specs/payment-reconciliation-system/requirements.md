# Requirements Document

## Introduction

The Payment Reconciliation System is a production-grade safety net that runs alongside the existing payment infrastructure to detect and correct state mismatches that slip through the atomic operations layer. The existing system handles "payment captured at Razorpay but not marked PAID in DB" via `paymentReconciliationService.ts`, but several critical gaps remain: (1) no 4-way consistency check across Razorpay ↔ PaymentIntent ↔ Order ↔ LedgerEntry, (2) no detection of reverse mismatches (FALSE_PAID, ORPHAN_LEDGER, PARTIAL_CAPTURE), (3) no zombie recovery retry cap, (4) no run-level overlap protection, (5) no replay safety on crash, (6) no tiered alerting, and (7) no idempotency key integrity audit. This feature fills all gaps.

The system operates on top of the existing `PaymentIntent`, `Order`, `LedgerEntry`, and `PaymentRecoveryAudit` MongoDB collections and integrates with the Razorpay API. All new scanners follow the same batch-limited, cursor-paginated, lock-aware patterns already established in `stuckPaymentScanner.ts` and `paymentReconciliationService.ts`.

## Glossary

- **Reconciliation_System**: The aggregate of all new services introduced by this feature.
- **Ledger_Checker**: The sub-service responsible for 4-way consistency verification (Requirement 1).
- **Zombie_Recoverer**: The sub-service responsible for recovering zombie gateway orders (Requirement 2).
- **Report_Service**: The sub-service responsible for generating reconciliation reports and emitting tiered alerts (Requirement 3).
- **Idempotency_Auditor**: The sub-service responsible for auditing idempotency key integrity (Requirement 4).
- **ReconciliationReport**: A structured document summarising one reconciliation run: total scanned, mismatches found by category, auto-fixed count, and manual-review-needed count.
- **ReconciliationAuditLog**: An immutable, append-only MongoDB collection recording every action taken by the Reconciliation_System with runId, actor, timestamp, before-state, and after-state.
- **ReconciliationRun**: A MongoDB document tracking the lifecycle of a single reconciliation run (PENDING → RUNNING → COMPLETED / FAILED), used to prevent overlapping runs.
- **Phantom_PAID**: An Order whose `paymentStatus` is `PAID` but for which no `CAPTURE` LedgerEntry exists and no captured payment exists in Razorpay.
- **FALSE_PAID**: An Order whose `paymentStatus` is `PAID` but Razorpay shows no capture for the associated `gatewayOrderId`. This is a financial fraud / data corruption risk and requires CRITICAL alerting.
- **Missing_Ledger**: A PaymentIntent in `CAPTURED` status for which no `CAPTURE` LedgerEntry with a matching `dedupeKey` exists in the LedgerEntry collection.
- **ORPHAN_LEDGER**: A LedgerEntry with `eventType = CAPTURE` for which the associated Order does NOT have `paymentStatus = PAID`. Indicates a ledger write succeeded but the order state update failed.
- **Amount_Mismatch**: A condition where the `amount` field of a `CAPTURE` LedgerEntry differs from `order.totalAmount * 100` (paise) by more than 1 paise (to tolerate floating-point rounding). Requires CRITICAL alerting.
- **PARTIAL_CAPTURE**: A condition where Razorpay reports a payment in `authorized` status (captured partially or not yet fully settled). Requires special handling — neither auto-fix nor ignore.
- **Zombie_Gateway_Order**: A PaymentIntent where `gatewayCreateAttemptedAt` is set but `gatewayOrderId` is null or absent, indicating the process crashed between claiming the gateway creation slot and saving the result.
- **Mismatch_Rate**: The ratio of mismatches detected to total orders scanned in a reconciliation run, expressed as a percentage.
- **Idempotency_Key**: A UUID v4 string stored on an Order in the `idempotencyKey` field, required since Phase 5 enforcement.
- **Cart_Hash**: A SHA-256 hex string stored on an Order in the `cartHash` field, representing the deterministic hash of cart contents for content-based deduplication.
- **Duplicate_Order**: Two or more Orders sharing the same `userId` + `idempotencyKey`, or sharing the same `userId` + `cartHash` with `createdAt` timestamps within 5 minutes of each other.
- **4-Way Consistency**: The invariant that for any completed payment: `Razorpay.status = captured` AND `PaymentIntent.status = CAPTURED` AND `Order.paymentStatus = PAID` AND `LedgerEntry[CAPTURE]` exists. Any deviation is an anomaly.
- **Fix_DedupeKey**: A string of the form `{anomalyType}:{orderId}:{action}` stored on ReconciliationAuditLog entries to prevent duplicate fix actions across runs.
- **Alert_Severity**: One of `CRITICAL`, `WARNING`, or `INFO`, assigned to each anomaly type and used to route alerts to the appropriate channel.

---

## Requirements

### Requirement 1: 4-Way Ledger Consistency Check

**User Story:** As a finance operator, I want the system to verify 4-way consistency across Razorpay, PaymentIntent, Order, and LedgerEntry for every completed payment, so that I can detect all categories of financial mismatch — including reverse mismatches where the DB shows PAID but Razorpay does not.

#### Acceptance Criteria

1. WHEN the Ledger_Checker runs, THE Ledger_Checker SHALL scan all Orders with `paymentStatus = PAID` created within a configurable lookback window (default: 48 hours) in batches of at most 200 documents per run.

2. FOR EACH scanned PAID Order, THE Ledger_Checker SHALL perform a 4-way consistency check verifying ALL of the following simultaneously:
   - Razorpay shows `status = captured` for the associated `gatewayOrderId`
   - The associated PaymentIntent has `status = CAPTURED`
   - The Order has `paymentStatus = PAID`
   - A `CAPTURE` LedgerEntry exists with a matching `orderId` and non-empty `dedupeKey`

3. IF ALL four conditions are satisfied, THE Ledger_Checker SHALL record no anomaly and advance the Order's `lastReconciledAt` timestamp.

4. IF Razorpay shows no capture AND the Order has `paymentStatus = PAID`, THEN THE Ledger_Checker SHALL classify the Order as FALSE_PAID, record a ReconciliationAuditLog entry with `category = FALSE_PAID` and `action = FLAGGED_FOR_REVIEW`, and emit a CRITICAL alert immediately without waiting for the run to complete.

5. IF Razorpay shows `status = captured` AND the Order has `paymentStatus = PAID` BUT no `CAPTURE` LedgerEntry exists, THEN THE Ledger_Checker SHALL classify the Order as Missing_Ledger, append the missing LedgerEntry using `appendLedgerEntry` with `dedupeKey = "ledger_backfill:{gatewayEventId}"`, and record the auto-fix in the ReconciliationAuditLog with `action = AUTO_FIXED`.

6. IF Razorpay shows `status = captured` AND the Order has `paymentStatus = PAID` AND a `CAPTURE` LedgerEntry exists BUT the LedgerEntry `amount` differs from `order.totalAmount * 100` by more than 1 paise, THEN THE Ledger_Checker SHALL classify the discrepancy as Amount_Mismatch, record a ReconciliationAuditLog entry with `category = AMOUNT_MISMATCH` and `action = FLAGGED_FOR_REVIEW`, and emit a CRITICAL alert immediately.

7. IF the associated PaymentIntent does NOT have `status = CAPTURED` but the Order has `paymentStatus = PAID` and Razorpay confirms capture, THEN THE Ledger_Checker SHALL transition the PaymentIntent to `CAPTURED` status using a versioned compare-and-set update and record the auto-fix in the ReconciliationAuditLog.

8. WHEN the Ledger_Checker scans LedgerEntries with `eventType = CAPTURE`, THE Ledger_Checker SHALL verify that the associated Order has `paymentStatus = PAID`. IF the Order does NOT have `paymentStatus = PAID`, THEN THE Ledger_Checker SHALL classify the entry as ORPHAN_LEDGER and record a ReconciliationAuditLog entry with `category = ORPHAN_LEDGER` and `action = FLAGGED_FOR_REVIEW`.

9. IF Razorpay returns `status = authorized` (partially captured or not yet settled) for an Order with `paymentStatus = PAID`, THEN THE Ledger_Checker SHALL classify the condition as PARTIAL_CAPTURE, record a ReconciliationAuditLog entry with `category = PARTIAL_CAPTURE` and `action = FLAGGED_FOR_REVIEW`, and emit a WARNING alert. THE Ledger_Checker SHALL NOT auto-fix PARTIAL_CAPTURE conditions.

10. EVERY corrective action written by the Ledger_Checker SHALL use a Fix_DedupeKey of the form `{anomalyType}:{orderId}:{action}` stored on the ReconciliationAuditLog entry. IF a write fails due to a duplicate key error on Fix_DedupeKey, THE Ledger_Checker SHALL treat the write as a no-op and continue.

11. THE Ledger_Checker SHALL be idempotent: running it multiple times over the same time window SHALL produce the same final state and SHALL NOT create duplicate LedgerEntries (relying on the existing `dedupeKey` unique index on LedgerEntry).

12. WHILE the Ledger_Checker is processing a batch, THE Ledger_Checker SHALL acquire a per-Order advisory lock (using the existing `isLocked` field on PaymentIntent) before writing any corrective action, and SHALL release the lock after the action completes or fails.

13. IF the Ledger_Checker encounters a Razorpay API error for a specific Order, THEN THE Ledger_Checker SHALL log the error, skip that Order, increment an `errors` counter, and continue processing the remaining batch.

---

### Requirement 2: Zombie Gateway Order Recovery with Retry Cap

**User Story:** As a payments engineer, I want the system to detect and recover PaymentIntents where the process crashed between claiming the Razorpay order creation slot and saving the `gatewayOrderId`, with a hard retry cap and aging TTL so that zombie intents are permanently resolved rather than retried indefinitely.

#### Acceptance Criteria

1. WHEN the Zombie_Recoverer runs, THE Zombie_Recoverer SHALL scan all PaymentIntents where `gatewayCreateAttemptedAt` is set, `gatewayOrderId` is null or absent, `status` is not in `{CAPTURED, FAILED, CANCELLED, EXPIRED}`, `isLocked` is not `true`, and `zombieRecoveryAttempts` is less than 3, in batches of at most 100 documents per run.

2. FOR EACH candidate PaymentIntent, THE Zombie_Recoverer SHALL atomically increment `zombieRecoveryAttempts` using `$inc` before querying Razorpay, to prevent concurrent runs from processing the same intent simultaneously.

3. FOR EACH candidate PaymentIntent, THE Zombie_Recoverer SHALL query the Razorpay API using the PaymentIntent's `idempotencyKey` as the Razorpay idempotency key to check whether a Razorpay order was created.

4. IF Razorpay returns an existing order for the idempotency key, THEN THE Zombie_Recoverer SHALL atomically set `gatewayOrderId` on the PaymentIntent using a compare-and-set update (`gatewayOrderId: { $exists: false }` as the filter condition) and transition the status to `GATEWAY_ORDER_CREATED`.

5. IF Razorpay returns no existing order for the idempotency key AND the PaymentIntent `gatewayCreateAttemptedAt` age exceeds 10 minutes, THEN THE Zombie_Recoverer SHALL transition the PaymentIntent to `PAYMENT_RECOVERABLE` status using the existing `paymentIntentStateMachine.assertAllowedTransition` guard.

6. IF Razorpay returns no existing order AND the `gatewayCreateAttemptedAt` age is less than 10 minutes, THEN THE Zombie_Recoverer SHALL skip the PaymentIntent and advance its `lastScannedAt` timestamp to prevent it from appearing at the top of the scan queue on the next run.

7. IF a PaymentIntent has `zombieRecoveryAttempts >= 3` OR `gatewayCreateAttemptedAt` age exceeds 30 minutes with no `gatewayOrderId`, THEN THE Zombie_Recoverer SHALL permanently mark the PaymentIntent as `FAILED` with `lockReason = "ZOMBIE_MAX_RETRIES"`, mark the associated Order `paymentStatus = FAILED` (only if still `PENDING`), and record the action in the ReconciliationAuditLog with `category = ZOMBIE_GATEWAY_RECOVERY` and `action = AUTO_FIXED`.

8. THE Zombie_Recoverer SHALL record every recovery action (link, transition, or permanent failure) in the ReconciliationAuditLog using Fix_DedupeKey `zombie:{paymentIntentId}:{action}`.

9. IF the Zombie_Recoverer encounters a Razorpay API error for a specific PaymentIntent, THEN THE Zombie_Recoverer SHALL log the error, skip that PaymentIntent, and continue processing the remaining batch.

10. THE Zombie_Recoverer SHALL be idempotent: if `gatewayOrderId` is already set when the compare-and-set update is attempted, THE Zombie_Recoverer SHALL skip the write and log a no-op.

---

### Requirement 3: Reconciliation Reporting and Tiered Alerting

**User Story:** As an operations manager, I want tiered alerts (CRITICAL / WARNING / INFO) and a daily reconciliation summary, so that I can immediately act on financial integrity violations while not being overwhelmed by expected operational noise.

#### Acceptance Criteria

1. WHEN a reconciliation run completes, THE Report_Service SHALL persist a ReconciliationReport document to MongoDB containing: `runId` (UUID), `runStartedAt`, `runCompletedAt`, `totalScanned`, `falsePaidCount`, `phantomPaidCount`, `orphanLedgerCount`, `missingLedgerCount`, `amountMismatchCount`, `partialCaptureCount`, `zombieRecoveredCount`, `idempotencyViolationCount`, `autoFixedCount`, `manualReviewCount`, and `errorCount`.

2. THE Report_Service SHALL assign Alert_Severity to anomaly types as follows:
   - CRITICAL: `FALSE_PAID` (any count > 0), `AMOUNT_MISMATCH` (any count > 0)
   - WARNING: `ORPHAN_LEDGER`, `PARTIAL_CAPTURE`, Mismatch_Rate > 1%
   - INFO: `ZOMBIE_GATEWAY_RECOVERY`, `MISSING_LEDGER` auto-fixed, `IDEMPOTENCY_VIOLATION`

3. WHEN a CRITICAL anomaly is detected during a run, THE Report_Service SHALL emit a CRITICAL alert immediately (not deferred to run completion) by calling the injected `AlertChannel` with `severity = CRITICAL`.

4. WHEN a run completes with WARNING-level anomalies but no CRITICAL anomalies, THE Report_Service SHALL emit a WARNING alert at run completion.

5. WHEN a run completes with only INFO-level findings, THE Report_Service SHALL emit an INFO alert at run completion.

6. THE AlertChannel interface SHALL define a single method `sendAlert(report: ReconciliationReport, severity: AlertSeverity): Promise<void>` so that concrete implementations (log-based, webhook, email, PagerDuty) can be injected without modifying the Report_Service.

7. WHERE a log-based AlertChannel is configured, THE AlertChannel SHALL write a structured JSON log entry at the corresponding log level (`ERROR` for CRITICAL, `WARN` for WARNING, `INFO` for INFO) containing the full ReconciliationReport fields and the label `[RECONCILIATION_ALERT]`.

8. THE Report_Service SHALL expose a query function `getReconciliationReports(query: { startDate, endDate, limit, cursor })` that returns ReconciliationReport documents in reverse-chronological order with cursor-based pagination (default limit: 50, max: 200).

9. THE Report_Service SHALL generate a daily summary by aggregating all ReconciliationReport documents for the previous calendar day (UTC) and persisting a `DailyReconciliationSummary` document containing: `date` (YYYY-MM-DD), `totalRuns`, `totalScanned`, `totalMismatches`, `totalAutoFixed`, `totalManualReview`, `peakMismatchRate`, and `criticalAnomalyCount`.

10. WHEN the daily summary generation fails, THE Report_Service SHALL log the error at `ERROR` level with label `[RECONCILIATION_DAILY_SUMMARY_FAILED]` and SHALL NOT crash the process.

11. THE ReconciliationAuditLog collection SHALL be append-only: THE Reconciliation_System SHALL never update or delete existing ReconciliationAuditLog documents.

12. WHEN a ReconciliationAuditLog entry is created, THE Reconciliation_System SHALL include: `runId`, `category` (one of `FALSE_PAID`, `PHANTOM_PAID`, `ORPHAN_LEDGER`, `MISSING_LEDGER`, `AMOUNT_MISMATCH`, `PARTIAL_CAPTURE`, `ZOMBIE_GATEWAY_RECOVERY`, `IDEMPOTENCY_VIOLATION`), `orderId` or `paymentIntentId`, `action` (one of `AUTO_FIXED`, `FLAGGED_FOR_REVIEW`, `NO_OP`), `beforeState`, `afterState`, `dedupeKey`, and `recordedAt`.

---

### Requirement 4: Idempotency Key Audit

**User Story:** As a payments engineer, I want the system to verify that all orders have valid idempotency keys and that no duplicate orders exist, so that I can confirm the Phase 5 enforcement is working correctly and detect any violations that slipped through.

#### Acceptance Criteria

1. WHEN the Idempotency_Auditor runs, THE Idempotency_Auditor SHALL scan all Orders created within a configurable lookback window (default: 24 hours) in batches of at most 200 documents per run.

2. FOR EACH scanned Order, THE Idempotency_Auditor SHALL verify that the `idempotencyKey` field is present, is a non-empty string, and matches the UUID v4 format `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`.

3. IF an Order has a missing or malformed `idempotencyKey`, THEN THE Idempotency_Auditor SHALL record a ReconciliationAuditLog entry with `category = IDEMPOTENCY_VIOLATION`, `action = FLAGGED_FOR_REVIEW`, Fix_DedupeKey `idempotency:missing:{orderId}`, and the orderId.

4. THE Idempotency_Auditor SHALL detect Duplicate_Orders by querying for pairs of Orders sharing the same `userId` + `idempotencyKey` using a MongoDB aggregation with `$group` on `{ userId, idempotencyKey }` and `$sum: 1`, filtering groups where the count exceeds 1.

5. WHEN a Duplicate_Order pair is detected by idempotency key, THE Idempotency_Auditor SHALL record a ReconciliationAuditLog entry with `category = IDEMPOTENCY_VIOLATION`, `action = FLAGGED_FOR_REVIEW`, Fix_DedupeKey `idempotency:dup_key:{userId}:{idempotencyKey}`, the duplicate orderIds, and the shared `idempotencyKey`.

6. THE Idempotency_Auditor SHALL detect cart-hash duplicates by querying for Orders sharing the same `userId` + `cartHash` with `createdAt` timestamps within 5 minutes of each other, using a MongoDB aggregation with a `$group` on `{ userId, cartHash }` and a `$push` of `{ _id, createdAt }`, then filtering groups where any two entries are within 300 seconds of each other.

7. WHEN a cart-hash duplicate is detected, THE Idempotency_Auditor SHALL record a ReconciliationAuditLog entry with `category = IDEMPOTENCY_VIOLATION`, `action = FLAGGED_FOR_REVIEW`, Fix_DedupeKey `idempotency:dup_cart:{userId}:{cartHash}`, the duplicate orderIds, the shared `cartHash`, and the time delta in seconds between the two orders.

8. THE Idempotency_Auditor SHALL NOT modify any Order document: all findings SHALL be recorded exclusively in the ReconciliationAuditLog and included in the ReconciliationReport.

9. THE Idempotency_Auditor SHALL be idempotent: running it multiple times over the same time window SHALL produce the same set of ReconciliationAuditLog entries (relying on the Fix_DedupeKey unique index on ReconciliationAuditLog).

---

### Requirement 5: Orchestration, Scheduling, and Overlap Protection

**User Story:** As a platform engineer, I want all reconciliation sub-services to run on a predictable schedule with overlap protection, backpressure controls, and crash-safe replay, so that reconciliation work does not destabilise the primary payment processing path and a mid-run crash does not corrupt state.

#### Acceptance Criteria

1. THE Reconciliation_System SHALL expose a single `startReconciliationSystem(config)` function that initialises and schedules all four sub-services (Ledger_Checker, Zombie_Recoverer, Report_Service, Idempotency_Auditor) as independent recurring jobs.

2. WHEN `startReconciliationSystem` is called more than once in the same process, THE Reconciliation_System SHALL log a warning and return without starting duplicate jobs.

3. THE Ledger_Checker SHALL run every 60 minutes by default; the Zombie_Recoverer SHALL run every 15 minutes by default; the Idempotency_Auditor SHALL run every 60 minutes by default; the daily summary generation SHALL run once per day at 01:00 UTC by default. All intervals SHALL be overridable via the `config` parameter.

4. BEFORE starting any sub-service run, THE Reconciliation_System SHALL create a ReconciliationRun document in MongoDB with `status = RUNNING`, `runId` (UUID v4), `subService`, and `startedAt`. IF a ReconciliationRun document already exists with `status = RUNNING` for the same `subService` and `startedAt` within the last 2× the sub-service interval, THE Reconciliation_System SHALL skip the run and log a WARNING with label `[RECONCILIATION_OVERLAP_SKIPPED]`.

5. WHEN a sub-service run completes successfully, THE Reconciliation_System SHALL update the ReconciliationRun document to `status = COMPLETED` with `completedAt` and the result counts.

6. WHEN a sub-service run fails, THE Reconciliation_System SHALL update the ReconciliationRun document to `status = FAILED` with `failedAt` and the error message.

7. WHEN the process restarts after a crash, THE Reconciliation_System SHALL detect any ReconciliationRun documents with `status = RUNNING` and `startedAt` older than 2× the sub-service interval, mark them `status = ABANDONED`, and allow the next scheduled run to proceed. Items already processed in the abandoned run are protected from double-processing by Fix_DedupeKey idempotency on ReconciliationAuditLog.

8. IF a sub-service run throws an unhandled error, THEN THE Reconciliation_System SHALL catch the error, log it at `ERROR` level with the sub-service name, increment a consecutive-failure counter for that sub-service, and schedule the next run normally.

9. IF a sub-service accumulates 10 consecutive failures, THEN THE Reconciliation_System SHALL log a `FATAL` level message with label `[RECONCILIATION_FATAL]` and SHALL call `process.exit(1)`.

10. WHILE any sub-service is processing a batch, THE Reconciliation_System SHALL pause at least 50 ms between individual document operations to prevent database saturation (matching the `SCAN_INTER_ITEM_SLEEP_MS` pattern in `stuckPaymentScanner.ts`).

11. THE Reconciliation_System SHALL expose a `runReconciliationOnce(subService?: SubServiceName)` function for use in tests and manual admin triggers that runs the specified sub-service (or all sub-services sequentially if none specified) exactly once and returns a combined result object. This function SHALL bypass the overlap check.

---

### Requirement 6: ReconciliationAuditLog Persistence

**User Story:** As a compliance officer, I want every action taken by the reconciliation system to be recorded in an immutable audit log with Fix_DedupeKey idempotency, so that I can reconstruct the full history of reconciliation decisions for any order and re-runs never produce duplicate entries.

#### Acceptance Criteria

1. THE Reconciliation_System SHALL persist all audit entries to a `ReconciliationAuditLog` MongoDB collection with the following required fields: `_id`, `runId`, `category`, `subService`, `orderId` (optional), `paymentIntentId` (optional), `action`, `beforeState` (JSON object), `afterState` (JSON object), `recordedAt`, and `dedupeKey`.

2. THE ReconciliationAuditLog collection SHALL have a unique index on `dedupeKey` to enforce idempotency of audit writes across runs.

3. THE ReconciliationAuditLog collection SHALL have indexes on `{ orderId, recordedAt }` and `{ runId, recordedAt }` to support efficient querying by order and by run.

4. WHEN an audit entry write fails due to a duplicate key error on `dedupeKey`, THE Reconciliation_System SHALL treat the write as a no-op and continue processing without throwing.

5. THE Reconciliation_System SHALL expose a `getAuditLogsForOrder(orderId: string, limit?: number)` query function that returns ReconciliationAuditLog entries for a given order in reverse-chronological order.

6. WHEN `getAuditLogsForOrder` is called with an invalid ObjectId, THE Reconciliation_System SHALL return an empty array rather than throwing.

7. THE `dedupeKey` for every ReconciliationAuditLog entry SHALL follow the format `{anomalyType}:{entityId}:{action}` where `entityId` is the orderId or paymentIntentId, ensuring that the same fix action for the same entity is never written twice regardless of how many times the reconciliation runs.
