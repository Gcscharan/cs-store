# Checkout UX Design (PHASE 1)

## Goals

- Prevent duplicate payments.
- Make pending states understandable and safe.
- Provide deterministic, human-friendly copy for each state.
- Encode explicit "DO NOT RETRY" scenarios.

## 1) State model (textual diagram)

Legend:

- **UI state** is driven by canonical backend reads.
- Gateway callbacks are treated as hints.

```text
[Checkout Entry]
  -> fetch Order + latest PaymentIntent (if any)

IF no PaymentIntent
  -> [READY_TO_PAY]
      -> user clicks Pay
      -> POST /api/payment-intents (idempotent)
      -> [AWAITING_GATEWAY]

IF PaymentIntent exists and non-terminal
  -> [RESUME_PENDING]
      -> show "Verifying" state
      -> poll backend for status

IF backend confirms capture (via Order paid / PaymentIntent captured)
  -> [PAID_SUCCESS]

IF backend confirms failed/expired/cancelled
  -> [FAILED]

IF backend flags recoverable discrepancy (internal)
  -> [RECOVERABLE]
```

## 2) Copy rules

### A) Pending (verification)

Use when:

- user returned from gateway but backend still shows non-terminal, OR
- backend has not yet observed CAPTURE.

Copy requirements:

- Must acknowledge ambiguity without blaming the user.
- Must instruct safe next actions.

Recommended copy:

- Title: "Payment verification in progress"
- Body:
  - "If your money was deducted, we’re confirming it with our payment provider. This can take a few minutes."
- Primary action:
  - "Check payment status" (re-fetch from backend)
- Secondary action:
  - "Contact support" / "Share payment receipt"

### B) Failed

Use when backend confirms:

- intent failed/expired/cancelled, and no capture ledger exists.

Copy requirements:

- Must clearly say no payment was confirmed.
- Must allow safe retry.

Recommended copy:

- Title: "Payment not completed"
- Body:
  - "We could not confirm your payment. You can try again."
- Primary action:
  - "Try again"

### C) Recoverable

Use when:

- backend indicates a discrepancy where the safest action is not an immediate retry.

Copy requirements:

- Must avoid encouraging retries.
- Must instruct verification/support path.

Recommended copy:

- Title: "We need to verify your payment"
- Body:
  - "We’re seeing a delay in confirmation. Please do not retry right now."
- Primary action:
  - "Check payment status"
- Secondary action:
  - "Contact support"

## 3) Explicit "DO NOT RETRY" scenarios

The UI must show a strong "do not retry" message and remove prominent retry actions in these cases:

- **S1: Payment is pending verification**
  - Any non-terminal intent with recent activity.

- **S2: User reports money deducted but order still pending**
  - Treat as verification state until backend confirms otherwise.

- **S3: Gateway callback received but backend not yet confirmed**
  - Callback alone is not canonical.

- **S4: Multiple attempts already exist for the same order**
  - If attempt limit is reached, do not offer retry.

## 4) Retry gating rules (high level)

Retry may be offered only when backend indicates the previous attempt is terminal and not captured:

- `FAILED` / `EXPIRED` / `CANCELLED` (and order not paid)

Retry must not be offered when:

- order is already paid
- intent is non-terminal and within the verification window
- there is evidence of capture in ledger

## 5) Required UI invariants (non-negotiable)

- A single order must not show multiple simultaneous payment CTAs.
- Refresh/resume must not create new attempts by default.
- Any retry must use stable idempotency keys per attempt.
