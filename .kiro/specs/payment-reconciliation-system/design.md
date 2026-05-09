# Payment Reconciliation System — Technical Design

## Overview

The Payment Reconciliation System is a production-grade financial correctness engine that runs alongside the existing payment infrastructure. It detects and corrects state mismatches that slip through the atomic operations layer — specifically the gaps not covered by the existing  (which only handles "captured at Razorpay but not PAID in DB").

### What This System Adds

The existing  handles one direction: Razorpay captured → DB not PAID. This system adds:

1. **Reverse mismatch detection** — DB shows PAID but Razorpay does not (FALSE_PAID, financial fraud risk)
2. **4-way consistency** — Razorpay ↔ PaymentIntent ↔ Order ↔ LedgerEntry checked simultaneously
3. **Zombie recovery with retry cap** — hard limit of 3 attempts + 30-minute TTL
4. **Run-level overlap protection** — prevents concurrent runs of the same sub-service
5. **Crash-safe replay** — abandoned runs detected on restart; already-processed items protected by dedupeKey idempotency
6. **Tiered alerting** — CRITICAL (immediate, mid-run) vs WARNING/INFO (at run completion)
7. **Idempotency key integrity audit** — validates UUID v4 format and detects duplicate orders
# Payment Reconciliation System — Technical Design

## 1. Architecture Overview

```
Scheduler (setInterval)
  ↓
Reconciliation Orchestrator
  ├── acquireRunLock(subService)   ← prevents overlap
  ├── recoverAbandonedRuns()       ← crash safety on startup
  │
  ↓ (per sub-service, independent)
┌──────────────────────────────────────────┐
│  1. Ledger Consistency Scanner  (60 min) │
│  2. Zombie Recovery Scanner     (15 min) │
│  3. Idempotency Auditor         (60 min) │
│  4. Daily Summary Generator  (01:00 UTC) │
└──────────────────────────────────────────┘
  ↓
Fix Engine (applyFix — dedupeKey idempotency)
  ↓
ReconciliationAuditLog (append-only)
ReconciliationReport   (per-run summary)
AlertChannel           (CRITICAL / WARNING / INFO)
```

Each sub-service runs independently. A crash in one does not affect others.
All corrective writes go through the Fix Engine, which uses a unique `dedupeKey`
to guarantee exactly-once application across restarts and re-runs.

## 2. New MongoDB Schemas

### 2.1 ReconciliationRun

**File:** `backend/src/domains/payments/models/ReconciliationRun.ts`

```typescript
export type ReconciliationRunStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ABANDONED';
export type SubServiceName = 'LEDGER' | 'ZOMBIE' | 'IDEMPOTENCY' | 'DAILY_SUMMARY';

export interface IReconciliationRun extends Document {
  _id: mongoose.Types.ObjectId;
  runId: string;                    // UUID v4 — stable identifier for this run
  subService: SubServiceName;
  status: ReconciliationRunStatus;
  startedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  abandonedAt?: Date;
  error?: string;
  processedCount: number;
  anomalyCount: number;
  autoFixedCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Schema indexes:
// { subService: 1, status: 1, startedAt: -1 }  — overlap detection query
// { runId: 1 } unique                           — lookup by runId
// { startedAt: 1 }                              — TTL cleanup (optional)
```

**Overlap prevention:** Before starting any sub-service run, query for an existing
`ReconciliationRun` with `{ subService, status: 'RUNNING', startedAt: { $gte: now - 2×interval } }`.
If found, skip and log `[RECONCILIATION_OVERLAP_SKIPPED]`.

**Crash recovery:** On process startup, find all `ReconciliationRun` documents with
`{ status: 'RUNNING', startedAt: { $lt: now - 2×interval } }` and mark them `ABANDONED`.
Items already processed in the abandoned run are protected by `dedupeKey` idempotency.

### 2.2 ReconciliationAuditLog

**File:** `backend/src/domains/payments/models/ReconciliationAuditLog.ts`

```typescript
export type AnomalyType =
  | 'FALSE_PAID'
  | 'PHANTOM_PAID'
  | 'ORPHAN_LEDGER'
  | 'MISSING_LEDGER'
  | 'AMOUNT_MISMATCH'
  | 'PARTIAL_CAPTURE'
  | 'PI_STATUS_MISMATCH'
  | 'ZOMBIE_GATEWAY_RECOVERY'
  | 'IDEMPOTENCY_VIOLATION';

export type FixAction = 'AUTO_FIXED' | 'FLAGGED_FOR_REVIEW' | 'NO_OP';
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface IReconciliationAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  dedupeKey: string;               // UNIQUE — "{anomalyType}:{entityId}:{action}"
  runId: string;
  category: AnomalyType;
  subService: SubServiceName;
  orderId?: mongoose.Types.ObjectId;
  paymentIntentId?: mongoose.Types.ObjectId;
  action: FixAction;
  alertSeverity: AlertSeverity;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  recordedAt: Date;
  createdAt: Date;
}

// Schema indexes:
// { dedupeKey: 1 } unique          — idempotency of audit writes
// { orderId: 1, recordedAt: -1 }   — query by order
// { runId: 1, recordedAt: -1 }     — query by run
// { category: 1, recordedAt: -1 }  — query by anomaly type
```

**Append-only invariant:** No update or delete operations are ever issued against this collection.

### 2.3 ReconciliationReport

**File:** `backend/src/domains/payments/models/ReconciliationReport.ts`

```typescript
export interface IReconciliationReport extends Document {
  _id: mongoose.Types.ObjectId;
  runId: string;
  subService: SubServiceName;
  generatedAt: Date;
  totalScanned: number;
  // Anomaly counts by type
  falsePaidCount: number;
  phantomPaidCount: number;
  orphanLedgerCount: number;
  missingLedgerCount: number;
  amountMismatchCount: number;
  partialCaptureCount: number;
  piStatusMismatchCount: number;
  zombieRecoveredCount: number;
  zombieFailedCount: number;
  idempotencyViolationCount: number;
  // Summary
  mismatchCount: number;           // sum of all anomaly counts
  mismatchRate: number;            // mismatchCount / totalScanned * 100
  autoFixedCount: number;
  manualReviewCount: number;
  criticalAnomalyCount: number;    // FALSE_PAID + AMOUNT_MISMATCH counts
  errorCount: number;
  createdAt: Date;
}

// Schema indexes:
// { runId: 1 } unique
// { generatedAt: -1 }
// { subService: 1, generatedAt: -1 }
```

### 2.4 DailyReconciliationSummary

**File:** `backend/src/domains/payments/models/DailyReconciliationSummary.ts`

```typescript
export interface IDailyReconciliationSummary extends Document {
  _id: mongoose.Types.ObjectId;
  date: string;                    // YYYY-MM-DD UTC — unique
  totalRuns: number;
  totalScanned: number;
  totalMismatches: number;
  totalAutoFixed: number;
  totalManualReview: number;
  peakMismatchRate: number;
  criticalAnomalyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Schema indexes:
// { date: 1 } unique
```

### 2.5 Schema Additions to Existing Models

**PaymentIntent** — add two fields:
```typescript
zombieRecoveryAttempts: number;   // default: 0 — incremented atomically before each Razorpay query
// Index: { zombieRecoveryAttempts: 1 } (partial, only where gatewayOrderId missing)
```

**Order** — add two fields:
```typescript
lastReconciledAt?: Date;          // set after a clean 4-way consistency check
reconciliationFlag?: string;      // e.g. 'PHANTOM_PAID_UNRESOLVED' — set when manual review needed
```

## 3. Orchestrator Design

**File:** `backend/src/domains/payments/services/reconciliation/reconciliationOrchestrator.ts`

### 3.1 Public API

```typescript
export interface ReconciliationConfig {
  ledgerIntervalMs?: number;        // default: 60 * 60_000 (60 min)
  zombieIntervalMs?: number;        // default: 15 * 60_000 (15 min)
  idempotencyIntervalMs?: number;   // default: 60 * 60_000 (60 min)
  dailySummaryHourUtc?: number;     // default: 1 (01:00 UTC)
  alertChannel?: AlertChannel;
  maxConsecutiveFailures?: number;  // default: 10
}

// Start all sub-services on their schedules. Idempotent — safe to call multiple times.
export function startReconciliationSystem(config?: ReconciliationConfig): void

// Run one or all sub-services exactly once. Bypasses overlap check. For tests + admin.
export async function runReconciliationOnce(
  subService?: SubServiceName,
  config?: ReconciliationConfig
): Promise<ReconciliationRunResult>

// Called on process startup to recover from crashes.
export async function recoverAbandonedRuns(): Promise<void>
```

### 3.2 Overlap Lock Algorithm

```typescript
async function acquireRunLock(
  subService: SubServiceName,
  intervalMs: number
): Promise<IReconciliationRun | null> {
  const overlapWindowMs = intervalMs * 2;
  const cutoff = new Date(Date.now() - overlapWindowMs);

  // Check for existing RUNNING run within overlap window
  const existing = await ReconciliationRun.findOne({
    subService,
    status: 'RUNNING',
    startedAt: { $gte: cutoff },
  });

  if (existing) {
    logger.warn('[RECONCILIATION_OVERLAP_SKIPPED]', { subService, existingRunId: existing.runId });
    return null;
  }

  // Create new run document — this is NOT a unique constraint, just a record
  const run = await ReconciliationRun.create({
    runId: uuidv4(),
    subService,
    status: 'RUNNING',
    startedAt: new Date(),
    processedCount: 0,
    anomalyCount: 0,
    autoFixedCount: 0,
  });

  return run;
}
```

### 3.3 Crash Recovery Algorithm

```typescript
export async function recoverAbandonedRuns(): Promise<void> {
  const intervals: Record<SubServiceName, number> = {
    LEDGER: 60 * 60_000,
    ZOMBIE: 15 * 60_000,
    IDEMPOTENCY: 60 * 60_000,
    DAILY_SUMMARY: 24 * 60 * 60_000,
  };

  for (const [subService, intervalMs] of Object.entries(intervals)) {
    const cutoff = new Date(Date.now() - intervalMs * 2);
    const result = await ReconciliationRun.updateMany(
      { subService, status: 'RUNNING', startedAt: { $lt: cutoff } },
      { $set: { status: 'ABANDONED', abandonedAt: new Date() } }
    );
    if (result.modifiedCount > 0) {
      logger.warn('[RECONCILIATION_RUNS_ABANDONED]', { subService, count: result.modifiedCount });
    }
  }
}
```

### 3.4 Consecutive Failure Guard

```typescript
const consecutiveFailures: Record<SubServiceName, number> = {
  LEDGER: 0, ZOMBIE: 0, IDEMPOTENCY: 0, DAILY_SUMMARY: 0,
};

async function runWithFailureGuard(
  subService: SubServiceName,
  fn: () => Promise<void>,
  maxFailures: number
): Promise<void> {
  try {
    await fn();
    consecutiveFailures[subService] = 0;
  } catch (e) {
    consecutiveFailures[subService]++;
    logger.error(`[RECONCILIATION_ERROR] subService=${subService}`, e);

    if (consecutiveFailures[subService] >= maxFailures) {
      logger.error('[RECONCILIATION_FATAL]', { subService, failures: consecutiveFailures[subService] });
      process.exit(1);
    }
  }
}
```

## 4. Fix Engine

**File:** `backend/src/domains/payments/services/reconciliation/fixEngine.ts`

The Fix Engine is the single path through which all corrective actions flow.
It guarantees exactly-once application via `dedupeKey` on `ReconciliationAuditLog`.

```typescript
export interface FixArgs {
  anomalyType: AnomalyType;
  entityId: string;              // orderId or paymentIntentId as string
  action: FixAction;
  runId: string;
  subService: SubServiceName;
  alertSeverity: AlertSeverity;
  orderId?: mongoose.Types.ObjectId;
  paymentIntentId?: mongoose.Types.ObjectId;
  beforeState: Record<string, any>;
  afterState: Record<string, any>;
  fix?: () => Promise<void>;     // optional — omit for FLAGGED_FOR_REVIEW (no DB change)
}

export async function applyFix(args: FixArgs): Promise<{ applied: boolean }> {
  const dedupeKey = `${args.anomalyType}:${args.entityId}:${args.action}`;

  // Step 1: Write audit log entry (idempotent via unique dedupeKey)
  try {
    await ReconciliationAuditLog.create({
      dedupeKey,
      runId: args.runId,
      category: args.anomalyType,
      subService: args.subService,
      orderId: args.orderId,
      paymentIntentId: args.paymentIntentId,
      action: args.action,
      alertSeverity: args.alertSeverity,
      beforeState: args.beforeState,
      afterState: args.afterState,
      recordedAt: new Date(),
    });
  } catch (e: any) {
    if (e?.code === 11000 || String(e?.message || '').includes('E11000')) {
      // Already applied in a previous run — safe no-op
      return { applied: false };
    }
    throw e;
  }

  // Step 2: Execute the fix (only if audit log write succeeded)
  if (args.fix) {
    await args.fix();
  }

  return { applied: true };
}
```

**Key invariant:** The audit log write happens BEFORE the fix. If the process crashes
between the audit write and the fix execution, the next run will see the audit entry
(dedupeKey exists → no-op) and skip re-applying. This means a fix might be skipped
once on crash, but it will NEVER be applied twice.

**Severity routing:**
```typescript
export const ANOMALY_SEVERITY: Record<AnomalyType, AlertSeverity> = {
  FALSE_PAID:              'CRITICAL',
  AMOUNT_MISMATCH:         'CRITICAL',
  ORPHAN_LEDGER:           'WARNING',
  PARTIAL_CAPTURE:         'WARNING',
  PI_STATUS_MISMATCH:      'WARNING',
  PHANTOM_PAID:            'WARNING',
  MISSING_LEDGER:          'INFO',
  ZOMBIE_GATEWAY_RECOVERY: 'INFO',
  IDEMPOTENCY_VIOLATION:   'INFO',
};
```

## 5. Ledger Consistency Scanner

**File:** `backend/src/domains/payments/services/reconciliation/ledgerConsistencyScanner.ts`

### 5.1 Scan Query

```typescript
// Scan PAID orders within lookback window, cursor-paginated
const orders = await Order.find({
  paymentStatus: 'PAID',
  createdAt: { $gte: new Date(Date.now() - lookbackMs) },
  _id: cursor ? { $gt: cursor } : { $exists: true },
})
  .select('_id userId totalAmount paymentStatus razorpayOrderId activePaymentIntentId lastReconciledAt reconciliationFlag')
  .sort({ _id: 1 })
  .limit(BATCH_SIZE)  // 200
  .lean();
```

### 5.2 4-Way Consistency Evaluation

```typescript
type ConsistencyResult =
  | { ok: true }
  | { ok: false; anomaly: AnomalyType; details: Record<string, any> };

function evaluateConsistency(
  order: IOrder,
  paymentIntent: IPaymentIntent | null,
  ledgerEntry: ILedgerEntry | null,
  razorpay: RazorpayPaymentInfo | null
): ConsistencyResult {

  // 1. FALSE_PAID: Order=PAID but Razorpay shows no capture
  //    This is the most dangerous case — potential fraud or data corruption
  if (!razorpay?.captured && !razorpay?.authorized) {
    return { ok: false, anomaly: 'FALSE_PAID', details: {
      orderPaymentStatus: order.paymentStatus,
      razorpayStatus: razorpay?.status ?? 'NOT_FOUND',
      gatewayOrderId: order.razorpayOrderId,
    }};
  }

  // 2. PARTIAL_CAPTURE: Razorpay shows authorized but not fully captured
  if (razorpay?.authorized && !razorpay?.captured) {
    return { ok: false, anomaly: 'PARTIAL_CAPTURE', details: {
      razorpayStatus: 'authorized',
      gatewayOrderId: order.razorpayOrderId,
    }};
  }

  // From here: razorpay.captured === true

  // 3. MISSING_LEDGER: Captured at Razorpay but no LedgerEntry
  if (!ledgerEntry) {
    return { ok: false, anomaly: 'MISSING_LEDGER', details: {
      gatewayOrderId: order.razorpayOrderId,
      razorpayPaymentId: razorpay.paymentId,
    }};
  }

  // 4. AMOUNT_MISMATCH: LedgerEntry amount differs from order total
  const expectedPaise = Math.round(order.totalAmount * 100);
  if (Math.abs(ledgerEntry.amount - expectedPaise) > 1) {
    return { ok: false, anomaly: 'AMOUNT_MISMATCH', details: {
      expectedPaise,
      actualPaise: ledgerEntry.amount,
      diffPaise: ledgerEntry.amount - expectedPaise,
    }};
  }

  // 5. PI_STATUS_MISMATCH: PaymentIntent not in CAPTURED state
  if (paymentIntent && paymentIntent.status !== 'CAPTURED') {
    return { ok: false, anomaly: 'PI_STATUS_MISMATCH', details: {
      piStatus: paymentIntent.status,
      expectedStatus: 'CAPTURED',
    }};
  }

  return { ok: true };
}
```

### 5.3 ORPHAN_LEDGER Reverse Scan

Run separately: scan LedgerEntries with `eventType = CAPTURE` and verify the
associated Order has `paymentStatus = PAID`.

```typescript
const orphanLedgerEntries = await LedgerEntry.aggregate([
  {
    $match: {
      eventType: 'CAPTURE',
      createdAt: { $gte: new Date(Date.now() - lookbackMs) },
    },
  },
  {
    $lookup: {
      from: 'orders',
      localField: 'orderId',
      foreignField: '_id',
      as: 'order',
      pipeline: [{ $project: { paymentStatus: 1 } }],
    },
  },
  { $unwind: { path: '$order', preserveNullAndEmptyArrays: true } },
  {
    $match: {
      $or: [
        { 'order.paymentStatus': { $ne: 'PAID' } },
        { order: null },
      ],
    },
  },
  { $limit: BATCH_SIZE },
]);
```

### 5.4 Fix Actions per Anomaly

| Anomaly | Action | Fix |
|---------|--------|-----|
| `FALSE_PAID` | `FLAGGED_FOR_REVIEW` | Set `order.reconciliationFlag = 'FALSE_PAID_UNRESOLVED'`. Emit CRITICAL alert immediately. |
| `MISSING_LEDGER` | `AUTO_FIXED` | Call `appendLedgerEntry` with `dedupeKey = "ledger_backfill:{gatewayEventId}"`. |
| `AMOUNT_MISMATCH` | `FLAGGED_FOR_REVIEW` | No DB change. Emit CRITICAL alert immediately. |
| `PARTIAL_CAPTURE` | `FLAGGED_FOR_REVIEW` | No DB change. Emit WARNING alert at run end. |
| `PI_STATUS_MISMATCH` | `AUTO_FIXED` | Transition PaymentIntent to `CAPTURED` via versioned compare-and-set. |
| `ORPHAN_LEDGER` | `FLAGGED_FOR_REVIEW` | No DB change. Emit WARNING alert at run end. |

### 5.5 Full Scanner Flow

```
for each PAID Order (cursor-paginated, batch=200):
  1. Fetch PaymentIntent (by activePaymentIntentId or orderId)
  2. Fetch LedgerEntry (by orderId, eventType=CAPTURE)
  3. Fetch Razorpay status (with exponential backoff, max 3 retries)
  4. evaluateConsistency(order, pi, ledger, razorpay)
  5. if anomaly:
       if CRITICAL (FALSE_PAID, AMOUNT_MISMATCH):
         applyFix(...)
         alertChannel.sendAlert(severity=CRITICAL) ← immediate, not deferred
       else:
         applyFix(...)
         accumulate for end-of-run alert
  6. if ok:
       Order.updateOne({ _id }, { $set: { lastReconciledAt: now } })
  7. sleep 50ms
```

## 6. Zombie Recovery Scanner

**File:** `backend/src/domains/payments/services/reconciliation/zombieRecoveryScanner.ts`

### 6.1 Scan Query

```typescript
const zombies = await PaymentIntent.find({
  gatewayCreateAttemptedAt: { $exists: true },
  gatewayOrderId: { $exists: false },
  zombieRecoveryAttempts: { $lt: 3 },
  status: { $nin: ['CAPTURED', 'FAILED', 'CANCELLED', 'EXPIRED'] },
  isLocked: { $ne: true },
})
  .select('_id orderId idempotencyKey gatewayCreateAttemptedAt zombieRecoveryAttempts status')
  .sort({ lastScannedAt: 1 })  // fairness: least-recently-scanned first
  .limit(100)
  .lean();
```

### 6.2 Per-Intent Recovery Flow

```
for each zombie PaymentIntent:

  1. ATOMIC CLAIM: increment zombieRecoveryAttempts
     result = PaymentIntent.updateOne(
       { _id, zombieRecoveryAttempts: intent.zombieRecoveryAttempts },
       { $inc: { zombieRecoveryAttempts: 1 }, $set: { lastScannedAt: now } }
     )
     if modifiedCount === 0: skip (concurrent run claimed it)

  2. CHECK HARD LIMITS:
     ageMs = now - gatewayCreateAttemptedAt
     if (zombieRecoveryAttempts + 1 >= 3) OR (ageMs > 30 minutes):
       → PERMANENT FAILURE path (see 6.3)
       continue

  3. QUERY RAZORPAY (with exponential backoff):
     razorpayOrder = fetchRazorpayOrderByIdempotencyKey(idempotencyKey)

  4a. IF razorpayOrder found:
       → LINK path (see 6.4)

  4b. IF razorpayOrder NOT found AND ageMs > 10 minutes:
       → RECOVERABLE path (see 6.5)

  4c. IF razorpayOrder NOT found AND ageMs <= 10 minutes:
       → SKIP (too recent, winner may still be in progress)
       advance lastScannedAt

  5. sleep 50ms
```

### 6.3 Permanent Failure Path

```typescript
// Mark PaymentIntent FAILED permanently
await PaymentIntent.updateOne(
  { _id: intent._id, status: { $nin: ['CAPTURED', 'FAILED', 'CANCELLED', 'EXPIRED'] } },
  {
    $set: {
      status: 'FAILED',
      isLocked: true,
      lockReason: 'ZOMBIE_MAX_RETRIES',
      lastScannedAt: new Date(),
    },
    $inc: { version: 1 },
  }
);

// Mark Order FAILED only if still PENDING (idempotent)
await Order.updateOne(
  { _id: intent.orderId, paymentStatus: 'PENDING' },
  { $set: { paymentStatus: 'FAILED' } }
);

await applyFix({
  anomalyType: 'ZOMBIE_GATEWAY_RECOVERY',
  entityId: String(intent._id),
  action: 'AUTO_FIXED',
  beforeState: { status: intent.status, zombieRecoveryAttempts: intent.zombieRecoveryAttempts },
  afterState: { status: 'FAILED', lockReason: 'ZOMBIE_MAX_RETRIES' },
  // fix already applied above — no fix callback needed
});
```

### 6.4 Link Path (Razorpay order found)

```typescript
// Atomic compare-and-set: only write if gatewayOrderId still absent
const result = await PaymentIntent.updateOne(
  {
    _id: intent._id,
    gatewayOrderId: { $exists: false },  // atomic guard
    status: { $nin: ['CAPTURED', 'FAILED', 'CANCELLED', 'EXPIRED'] },
  },
  {
    $set: {
      gatewayOrderId: razorpayOrder.id,
      status: 'GATEWAY_ORDER_CREATED',
      lastScannedAt: new Date(),
    },
    $inc: { version: 1 },
  }
);

if (result.modifiedCount === 0) {
  // Another worker already linked it — no-op
  return;
}

await applyFix({
  anomalyType: 'ZOMBIE_GATEWAY_RECOVERY',
  entityId: String(intent._id),
  action: 'AUTO_FIXED',
  beforeState: { gatewayOrderId: null, status: intent.status },
  afterState: { gatewayOrderId: razorpayOrder.id, status: 'GATEWAY_ORDER_CREATED' },
});
```

### 6.5 Recoverable Path (no Razorpay order, age > 10min)

```typescript
paymentIntentStateMachine.assertAllowedTransition(intent.status, 'PAYMENT_RECOVERABLE');

await PaymentIntent.updateOne(
  { _id: intent._id, status: intent.status },
  {
    $set: { status: 'PAYMENT_RECOVERABLE', lastScannedAt: new Date() },
    $inc: { version: 1 },
  }
);

await applyFix({
  anomalyType: 'ZOMBIE_GATEWAY_RECOVERY',
  entityId: String(intent._id),
  action: 'AUTO_FIXED',
  beforeState: { status: intent.status },
  afterState: { status: 'PAYMENT_RECOVERABLE' },
});
```

## 7. Idempotency Auditor

**File:** `backend/src/domains/payments/services/reconciliation/idempotencyAuditor.ts`

Read-only scanner. Detects violations and logs them. Never modifies Order documents.

### 7.1 Missing / Malformed Key Scan

```typescript
const orders = await Order.find({
  createdAt: { $gte: new Date(Date.now() - lookbackMs) },
  $or: [
    { idempotencyKey: { $exists: false } },
    { idempotencyKey: null },
    { idempotencyKey: '' },
  ],
})
  .select('_id userId idempotencyKey createdAt')
  .limit(200)
  .lean();

// Also check UUID v4 format for keys that exist but are malformed
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
```

### 7.2 Duplicate Key Detection (Aggregation)

```typescript
const duplicates = await Order.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - lookbackMs) },
      idempotencyKey: { $exists: true, $ne: null, $ne: '' },
    },
  },
  {
    $group: {
      _id: { userId: '$userId', idempotencyKey: '$idempotencyKey' },
      orderIds: { $push: '$_id' },
      count: { $sum: 1 },
    },
  },
  { $match: { count: { $gt: 1 } } },
  { $limit: 100 },
]);
```

### 7.3 Cart Hash Duplicate Detection (Aggregation)

```typescript
const cartDuplicates = await Order.aggregate([
  {
    $match: {
      createdAt: { $gte: new Date(Date.now() - lookbackMs) },
      cartHash: { $exists: true, $ne: null },
    },
  },
  {
    $group: {
      _id: { userId: '$userId', cartHash: '$cartHash' },
      orders: { $push: { _id: '$_id', createdAt: '$createdAt' } },
      count: { $sum: 1 },
    },
  },
  { $match: { count: { $gt: 1 } } },
  { $limit: 100 },
]);

// Post-filter: only flag pairs where createdAt delta < 5 minutes (300 seconds)
for (const group of cartDuplicates) {
  const times = group.orders.map(o => new Date(o.createdAt).getTime()).sort();
  for (let i = 1; i < times.length; i++) {
    const deltaSec = (times[i] - times[i - 1]) / 1000;
    if (deltaSec < 300) {
      // Flag as violation
    }
  }
}
```

### 7.4 Fix_DedupeKey Formats for Idempotency Auditor

| Violation | dedupeKey |
|-----------|-----------|
| Missing/malformed key | `IDEMPOTENCY_VIOLATION:{orderId}:FLAGGED_FOR_REVIEW` |
| Duplicate idempotency key | `IDEMPOTENCY_VIOLATION:dup_key:{userId}:{idempotencyKey}:FLAGGED_FOR_REVIEW` |
| Cart hash duplicate | `IDEMPOTENCY_VIOLATION:dup_cart:{userId}:{cartHash}:FLAGGED_FOR_REVIEW` |

## 8. Alerting System

**File:** `backend/src/domains/payments/services/reconciliation/reconciliationAlertService.ts`

### 8.1 AlertChannel Interface

```typescript
export interface AlertChannel {
  sendAlert(report: IReconciliationReport, severity: AlertSeverity): Promise<void>;
}
```

### 8.2 Log-Based Implementation (default)

```typescript
export class LogAlertChannel implements AlertChannel {
  async sendAlert(report: IReconciliationReport, severity: AlertSeverity): Promise<void> {
    const logLevel = severity === 'CRITICAL' ? 'error'
                   : severity === 'WARNING'  ? 'warn'
                   : 'info';

    logger[logLevel]('[RECONCILIATION_ALERT]', {
      severity,
      runId: report.runId,
      subService: report.subService,
      falsePaidCount: report.falsePaidCount,
      amountMismatchCount: report.amountMismatchCount,
      orphanLedgerCount: report.orphanLedgerCount,
      partialCaptureCount: report.partialCaptureCount,
      mismatchRate: report.mismatchRate,
      criticalAnomalyCount: report.criticalAnomalyCount,
      totalScanned: report.totalScanned,
      generatedAt: report.generatedAt,
    });
  }
}
```

### 8.3 Alert Trigger Points

```
During a run (immediate — do not wait for run completion):
  - FALSE_PAID detected → sendAlert(CRITICAL)
  - AMOUNT_MISMATCH detected → sendAlert(CRITICAL)

At run completion:
  - orphanLedgerCount > 0 OR partialCaptureCount > 0 → sendAlert(WARNING)
  - mismatchRate > 1% → sendAlert(WARNING)
  - zombieRecoveredCount > 0 OR missingLedgerCount > 0 → sendAlert(INFO)
  - idempotencyViolationCount > 0 → sendAlert(INFO)
```

### 8.4 Report Persistence and Daily Summary

**File:** `backend/src/domains/payments/services/reconciliation/reconciliationReportService.ts`

```typescript
// Persist report after each sub-service run
export async function persistReport(
  runId: string,
  subService: SubServiceName,
  counts: RunCounts
): Promise<IReconciliationReport>

// Generate daily summary (called at 01:00 UTC)
export async function generateDailySummary(dateUtc: string): Promise<IDailyReconciliationSummary> {
  const startOfDay = new Date(`${dateUtc}T00:00:00.000Z`);
  const endOfDay   = new Date(`${dateUtc}T23:59:59.999Z`);

  const reports = await ReconciliationReport.find({
    generatedAt: { $gte: startOfDay, $lte: endOfDay },
  }).lean();

  const summary = {
    date: dateUtc,
    totalRuns: reports.length,
    totalScanned: sum(reports, 'totalScanned'),
    totalMismatches: sum(reports, 'mismatchCount'),
    totalAutoFixed: sum(reports, 'autoFixedCount'),
    totalManualReview: sum(reports, 'manualReviewCount'),
    peakMismatchRate: Math.max(...reports.map(r => r.mismatchRate)),
    criticalAnomalyCount: sum(reports, 'criticalAnomalyCount'),
  };

  // Upsert — safe to re-run
  return DailyReconciliationSummary.findOneAndUpdate(
    { date: dateUtc },
    { $set: summary },
    { upsert: true, new: true }
  );
}

// Query API
export async function getReconciliationReports(query: {
  startDate?: Date;
  endDate?: Date;
  subService?: SubServiceName;
  limit?: number;
  cursor?: string;
}): Promise<{ items: IReconciliationReport[]; nextCursor?: string }>
```

## 9. Razorpay API Integration

**Pattern:** Reuse the existing `fetchRazorpayPaymentStatus` function from
`paymentReconciliationService.ts`. Wrap all Razorpay calls with exponential backoff.

```typescript
export interface RazorpayPaymentInfo {
  status: 'captured' | 'authorized' | 'created' | 'failed' | 'refunded';
  captured: boolean;
  authorized: boolean;
  paymentId?: string;
  capturedAt?: Date;
  amountPaise: number;
}

async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt === maxAttempts) {
        logger.error('[RECONCILIATION_RAZORPAY_ERROR]', { attempt, error: e });
        return null;
      }
      // Exponential backoff: 500ms, 1000ms, 2000ms
      await sleep(500 * Math.pow(2, attempt - 1));
    }
  }
  return null;
}
```

**Rate limiting:** 50ms sleep between items prevents Razorpay API rate limit hits.
Razorpay's rate limit is ~600 req/min; at 50ms/item we use ~1200 req/min max,
so batches of 100-200 items with 50ms sleep stay well within limits.

## 10. File Structure

```
backend/src/domains/payments/
  models/
    ReconciliationRun.ts              (new)
    ReconciliationAuditLog.ts         (new)
    ReconciliationReport.ts           (new)
    DailyReconciliationSummary.ts     (new)
    PaymentIntent.ts                  (modified: add zombieRecoveryAttempts, reconciliationErrorCount)
    LedgerEntry.ts                    (modified: add partial unique index on paymentIntentId+CAPTURE)
  services/
    reconciliation/
      reconciliationOrchestrator.ts   (new — entry point, scheduling, overlap lock, crash recovery)
      ledgerConsistencyScanner.ts     (new — 4-way check, FALSE_PAID, ORPHAN_LEDGER, etc.)
      zombieRecoveryScanner.ts        (new — zombie detection, retry cap, permanent failure)
      idempotencyAuditor.ts           (new — duplicate order detection, read-only)
      reconciliationReportService.ts  (new — report persistence, daily summary, query API)
      reconciliationAlertService.ts   (new — AlertChannel interface + LogAlertChannel)
      fixEngine.ts                    (new — idempotent fix application via dedupeKey)
      concurrencyLimiter.ts           (new — global rate limiter for Razorpay + DB writes)
      razorpayStatusCache.ts          (new — in-process truth cache, TTL 5 min)
      index.ts                        (new — re-exports startReconciliationSystem, runReconciliationOnce)
  models/
    Order.ts                          (modified: add lastReconciledAt, reconciliationFlag, reconciliationErrorCount)
```

## 11. Performance Design

| Sub-service | Batch size | Inter-item sleep | Razorpay calls |
|-------------|-----------|-----------------|----------------|
| Ledger Consistency | 200 | 50ms | 1 per order |
| Zombie Recovery | 100 | 50ms | 1 per intent |
| Idempotency Audit | 200 | none (aggregation) | 0 |
| Daily Summary | N/A | N/A | 0 |

**Index requirements** (all scan queries must use indexes, no collection scans):

| Query | Index used |
|-------|-----------|
| PAID orders by createdAt | `{ paymentStatus: 1, createdAt: -1 }` (existing) |
| PaymentIntent by orderId | `{ orderId: 1, createdAt: -1 }` (existing) |
| LedgerEntry by orderId + eventType | `{ orderId: 1, recordedAt: -1 }` (existing) |
| Zombie intents | `{ status: 1, lastScannedAt: 1 }` partial index (existing) |
| ReconciliationRun overlap check | `{ subService: 1, status: 1, startedAt: -1 }` (new) |
| ReconciliationAuditLog by order | `{ orderId: 1, recordedAt: -1 }` (new) |

## 12. Error Handling

| Failure | Behavior |
|---------|----------|
| Razorpay API error (single item) | Log, skip item, increment `errorCount`, continue batch |
| Razorpay API error (all retries exhausted) | Same as above — never block the full run |
| DB write error (audit log) | If E11000 → no-op. Otherwise → log + skip item |
| DB write error (fix) | Log + skip item. Audit log entry already written — next run will see dedupeKey and skip |
| Sub-service unhandled exception | Caught by orchestrator, increment consecutive failure counter |
| 10 consecutive failures | `process.exit(1)` with `[RECONCILIATION_FATAL]` log |
| Process crash mid-run | On restart: `recoverAbandonedRuns()` marks RUNNING → ABANDONED. dedupeKey prevents double-fixes |

## 13. Integration with Existing Services

- **`appendLedgerEntry`** (`ledgerService.ts`) — used by Ledger Consistency Scanner for MISSING_LEDGER auto-fix
- **`paymentIntentStateMachine.assertAllowedTransition`** — used by Zombie Recovery Scanner before any status transition
- **`fetchRazorpayPaymentStatus`** pattern from `paymentReconciliationService.ts` — reused in both Ledger and Zombie scanners
- **`stuckPaymentScanner.ts`** — continues to run independently; Zombie Recovery Scanner is complementary (different scan criteria)
- **`initializePaymentReconciliation`** from `paymentReconciliationService.ts` — continues to run independently; the new system adds the 4-way check layer on top

## 14. Correctness Properties

| Property | Guarantee |
|----------|-----------|
| No duplicate fixes | dedupeKey unique index on ReconciliationAuditLog |
| No overlapping runs | ReconciliationRun status=RUNNING check before each run |
| Crash-safe | Abandoned runs detected on startup; dedupeKey prevents re-applying fixes |
| No infinite zombie retries | zombieRecoveryAttempts < 3 scan filter + 30-minute TTL |
| Immediate CRITICAL alerts | FALSE_PAID and AMOUNT_MISMATCH fire mid-run, not deferred |
| Audit trail completeness | Every action (including NO_OP) written to ReconciliationAuditLog |
| Idempotency auditor is read-only | No Order modifications — findings only in audit log |

## 15. Production Hardening (Critical Fixes)

The following five issues must be addressed before production deployment.
They are incorporated into the implementation tasks.

---

### 15.1 Razorpay Truth Cache (Issue 1 — API Storm Prevention)

Without a cache, the Ledger Consistency Scanner makes one Razorpay API call per
PAID order. At 200 orders/batch × multiple runs/hour, this creates an API storm
that will hit rate limits and cause random reconciliation failures.

**Design:**

```typescript
// In-process cache for a single reconciliation run
// Key: gatewayOrderId, TTL: 5 minutes
// Production: replace with Redis for multi-process safety

interface CacheEntry {
  data: RazorpayPaymentInfo;
  expiresAt: number;
}

class RazorpayStatusCache {
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(ttlMs = 5 * 60_000) {
    this.ttlMs = ttlMs;
  }

  get(gatewayOrderId: string): RazorpayPaymentInfo | null {
    const entry = this.cache.get(gatewayOrderId);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(gatewayOrderId);
      return null;
    }
    return entry.data;
  }

  set(gatewayOrderId: string, data: RazorpayPaymentInfo): void {
    this.cache.set(gatewayOrderId, { data, expiresAt: Date.now() + this.ttlMs });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Usage in ledgerConsistencyScanner.ts:
// Create one cache instance per run, pass it into the scanner
// Cache is cleared at run end — no stale data across runs
```

**Config addition to `ReconciliationConfig`:**
```typescript
razorpayCacheTtlMs?: number;  // default: 5 * 60_000 (5 min)
```

**File:** Add `RazorpayStatusCache` class to `fixEngine.ts` or a new
`razorpayStatusCache.ts` utility file.

---

### 15.2 Ledger Write Idempotency (Issue 2 — Duplicate CAPTURE Prevention)

The existing `appendLedgerEntry` already uses a `dedupeKey` unique index on
`LedgerEntry`. The reconciliation system must use a deterministic, stable
`dedupeKey` for backfill writes so that re-runs never create duplicate entries.

**Required `dedupeKey` format for reconciliation-initiated ledger writes:**
```
"ledger_backfill:{gatewayEventId}"
```

Where `gatewayEventId` is the Razorpay payment ID (e.g., `pay_ABC123`).
This is stable across runs — the same payment always produces the same key.

**Additional schema constraint** (add to `LedgerEntry` model documentation):
```
Partial unique index: { paymentIntentId: 1, eventType: 1 }
where eventType = 'CAPTURE'
```
This prevents two CAPTURE entries for the same PaymentIntent even if
`dedupeKey` values differ (belt-and-suspenders).

**Enforcement in `fixEngine.ts`:** The `applyFix` callback for `MISSING_LEDGER`
must call `appendLedgerEntry` — never `LedgerEntry.create` directly — so the
existing E11000 handling in `appendLedgerEntry` applies.

---

### 15.3 Audit-Log-First Invariant (Issue 3 — Crash Safety Enforcement)

The design already specifies audit-log-first writes in the Fix Engine. This section
makes the invariant explicit and adds a lint-level enforcement mechanism.

**Rule:** No reconciliation sub-service may write to `Order`, `PaymentIntent`, or
`LedgerEntry` outside of the `applyFix` callback. All state changes must flow
through `fixEngine.applyFix`.

**Enforcement pattern:**
```typescript
// CORRECT — audit log written first, fix applied second
await applyFix({
  anomalyType: 'MISSING_LEDGER',
  entityId: String(order._id),
  action: 'AUTO_FIXED',
  fix: async () => {
    await appendLedgerEntry({ ... });
  },
});

// WRONG — direct write bypasses audit log
// await appendLedgerEntry({ ... });  ← NEVER DO THIS in reconciliation code
```

**Exception:** The zombie recovery scanner's permanent failure path currently
writes to `PaymentIntent` and `Order` before calling `applyFix`. This must be
refactored so the writes happen inside the `fix` callback:

```typescript
// CORRECTED zombie permanent failure path
await applyFix({
  anomalyType: 'ZOMBIE_GATEWAY_RECOVERY',
  entityId: String(intent._id),
  action: 'AUTO_FIXED',
  beforeState: { status: intent.status, zombieRecoveryAttempts: intent.zombieRecoveryAttempts },
  afterState: { status: 'FAILED', lockReason: 'ZOMBIE_MAX_RETRIES' },
  fix: async () => {
    await PaymentIntent.updateOne(
      { _id: intent._id, status: { $nin: ['CAPTURED', 'FAILED', 'CANCELLED', 'EXPIRED'] } },
      { $set: { status: 'FAILED', isLocked: true, lockReason: 'ZOMBIE_MAX_RETRIES' }, $inc: { version: 1 } }
    );
    await Order.updateOne(
      { _id: intent.orderId, paymentStatus: 'PENDING' },
      { $set: { paymentStatus: 'FAILED' } }
    );
  },
});
```

---

### 15.4 Global Concurrency Limiter (Issue 4 — DB + API Saturation)

Three scanners running concurrently can saturate both the DB and Razorpay API.
A global limiter caps concurrent operations across all sub-services.

**Design using a simple semaphore (no external dependency):**

```typescript
// backend/src/domains/payments/services/reconciliation/concurrencyLimiter.ts

export class ConcurrencyLimiter {
  private running = 0;
  private readonly max: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.max = max;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.running < this.max) {
      this.running++;
      return Promise.resolve();
    }
    return new Promise(resolve => this.queue.push(resolve));
  }

  private release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) {
      this.running++;
      next();
    }
  }
}

// Global limiters — shared across all sub-services in the same process
export const razorpayLimiter = new ConcurrencyLimiter(5);   // max 5 concurrent Razorpay calls
export const dbWriteLimiter  = new ConcurrencyLimiter(10);  // max 10 concurrent DB writes
```

**Usage in scanners:**
```typescript
// Wrap every Razorpay call
const razorpayStatus = await razorpayLimiter.run(() =>
  fetchWithRetry(() => fetchRazorpayPaymentStatus(razorpay, gatewayOrderId))
);

// Wrap every corrective DB write
await dbWriteLimiter.run(() => applyFix({ ... }));
```

**Config additions:**
```typescript
maxConcurrentRazorpayCalls?: number;  // default: 5
maxConcurrentDbWrites?: number;       // default: 10
```

---

### 15.5 Dead-Letter Handling (Issue 5 — Persistent Failure Isolation)

Some entities will fail repeatedly due to corrupted data, deleted PaymentIntents,
or permanent Razorpay inconsistencies. Without a dead-letter mechanism, these
entities consume scanner capacity on every run forever.

**Design:**

Add `reconciliationErrorCount` field to `Order` and `PaymentIntent`:
```typescript
reconciliationErrorCount?: number;  // incremented on each scan error for this entity
```

**Dead-letter threshold:** 5 consecutive scan errors for the same entity.

**Dead-letter action:**
```typescript
const DEAD_LETTER_THRESHOLD = 5;

// In scanner error handler:
if (errorCount >= DEAD_LETTER_THRESHOLD) {
  await applyFix({
    anomalyType: 'FALSE_PAID',  // or whichever anomaly was being processed
    entityId: String(order._id),
    action: 'FLAGGED_FOR_REVIEW',
    beforeState: { reconciliationErrorCount: errorCount },
    afterState: { reconciliationFlag: 'DEAD_LETTER', reconciliationErrorCount: errorCount },
    fix: async () => {
      await Order.updateOne(
        { _id: order._id },
        { $set: { reconciliationFlag: 'DEAD_LETTER' } }
      );
    },
  });

  // Emit CRITICAL alert — dead-letter means we've given up on auto-resolution
  await alertChannel.sendAlert(partialReport, 'CRITICAL');
}
```

**Scan exclusion:** Add `reconciliationFlag: { $ne: 'DEAD_LETTER' }` to all
scanner queries so dead-lettered entities are excluded from future runs.

**Schema additions:**
```typescript
// Order
reconciliationErrorCount?: number;  // default: 0

// PaymentIntent
reconciliationErrorCount?: number;  // default: 0
```

---

### 15.6 Additional Recommended Improvements

These are not blocking but strongly recommended for production:

**Dry Run Mode:**
```typescript
dryRun?: boolean;  // default: false
// When true: detect anomalies, write audit log with action='NO_OP', do NOT apply fixes
// Useful for: debugging, validating logic before enabling auto-fix
```

**Reconciliation Cursor (incremental scanning):**
```typescript
// Store last processed _id per sub-service in ReconciliationRun
// Next run starts from cursor instead of re-scanning full lookback window
// Full scan (no cursor) runs daily as a safety net
lastProcessedId?: string;  // stored in ReconciliationRun document
```

**Reconciliation Version:**
```typescript
reconciliationVersion?: string;  // e.g. 'v2' — stored in audit log and report
// Allows correlating anomalies with the logic version that detected them
```

**PARTIAL_CAPTURE retry window:**
```typescript
// Before flagging PARTIAL_CAPTURE, check if the authorized payment is < 15 minutes old
// Razorpay can be eventually consistent — authorized → captured within minutes
const PARTIAL_CAPTURE_GRACE_MS = 15 * 60_000;
if (razorpay.authorized && !razorpay.captured) {
  const captureAgeMs = Date.now() - (razorpay.capturedAt?.getTime() ?? Date.now());
  if (captureAgeMs < PARTIAL_CAPTURE_GRACE_MS) {
    // Skip — too recent, may still settle
    continue;
  }
  // Flag as PARTIAL_CAPTURE
}
```
