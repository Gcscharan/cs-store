import { PaymentStates, type PaymentState } from "./paymentStateMachine";
import type { PaymentSession } from "./paymentSession";
import { useEffect, useMemo, useState } from "react";

type Props = {
  session: PaymentSession;
  state: PaymentState;
  onResume?: () => void;
  onHide?: () => void;
  message?: string;
  notice?: string;
  retryAvailableAtMs?: number | null;
  attemptNo?: number;
  maxAttempts?: number;
  failureReason?: "MODAL_CLOSED" | "GATEWAY_ERROR" | "POLL_TIMEOUT" | null;
  hidden?: boolean;
};

function Spinner(): JSX.Element {
  return (
    <div
      className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-gray-700 animate-spin"
      aria-label="Loading"
    />
  );
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m <= 0) return `${r}s`;
  return `${m}m ${String(r).padStart(2, "0")}s`;
}

function Step({ done, pending, label }: { done: boolean; pending: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={
          "h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold " +
          (done ? "bg-green-600 text-white" : pending ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-600")
        }
      >
        {done ? "✓" : pending ? "…" : ""}
      </div>
      <div className={"text-sm " + (done ? "text-gray-900" : "text-gray-700")}>{label}</div>
    </div>
  );
}

export default function PaymentStatusBanner(props: Props) {
  if (props.hidden) return null;

  const s = props.state;

  const orderCreatedDone =
    s !== PaymentStates.IDLE;
  const initiatedDone =
    s === PaymentStates.PAYMENT_INITIATED ||
    s === PaymentStates.PAYMENT_PROCESSING ||
    s === PaymentStates.PAYMENT_CONFIRMED ||
    s === PaymentStates.PAYMENT_FAILED ||
    s === PaymentStates.PAYMENT_RECOVERABLE;
  const processingPending =
    s === PaymentStates.PAYMENT_PROCESSING || s === PaymentStates.PAYMENT_INITIATED;
  const confirmedDone = s === PaymentStates.PAYMENT_CONFIRMED;

  const showActions =
    s === PaymentStates.PAYMENT_PROCESSING ||
    s === PaymentStates.PAYMENT_RECOVERABLE ||
    s === PaymentStates.PAYMENT_FAILED;

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [processingStartedAtMs, setProcessingStartedAtMs] = useState<number | null>(null);

  // UX-only: drive countdown text and retry cooldown without affecting payment logic.
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (s === PaymentStates.PAYMENT_PROCESSING) {
      setProcessingStartedAtMs((prev) => prev ?? Date.now());
    }
    if (s !== PaymentStates.PAYMENT_PROCESSING) {
      setProcessingStartedAtMs(null);
    }
  }, [s]);

  const processingSecondsRemaining = useMemo(() => {
    if (s !== PaymentStates.PAYMENT_PROCESSING) return null;
    const start = processingStartedAtMs ?? nowMs;
    const elapsed = nowMs - start;
    return Math.max(0, Math.ceil((120_000 - elapsed) / 1000));
  }, [nowMs, processingStartedAtMs, s]);

  const retrySecondsRemaining = useMemo(() => {
    if (s !== PaymentStates.PAYMENT_RECOVERABLE) return null;
    const until = Number(props.retryAvailableAtMs || 0);
    if (!until) return 0;
    return Math.max(0, Math.ceil((until - nowMs) / 1000));
  }, [nowMs, props.retryAvailableAtMs, s]);

  const isRetryDisabled = s === PaymentStates.PAYMENT_RECOVERABLE && (retrySecondsRemaining || 0) > 0;

  const failureSummary = useMemo(() => {
    if (!props.failureReason) return null;
    if (props.failureReason === "MODAL_CLOSED") return "You closed the payment window.";
    if (props.failureReason === "GATEWAY_ERROR") return "Payment failed at the bank.";
    if (props.failureReason === "POLL_TIMEOUT") return "We’re still checking your payment.";
    return null;
  }, [props.failureReason]);

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-900">
            {s === PaymentStates.PAYMENT_PROCESSING ? "⏳ Payment is being confirmed" : "Payment status"}
          </div>
          <div className="mt-1 text-xs text-gray-600">
            Order: <span className="font-mono">{props.session.orderId}</span>
          </div>

          {props.notice ? <div className="mt-2 text-sm text-gray-700">{props.notice}</div> : null}

          {s === PaymentStates.PAYMENT_PROCESSING ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="text-sm text-amber-950">
                We’ve received your payment request from the bank. This can take up to 2 minutes to confirm.
              </div>
              <div className="mt-2 text-sm text-amber-950">
                ⚠️ Do not retry or pay again while we check — it may cause duplicate charges.
              </div>
              <div className="mt-2 text-sm text-amber-950">
                If your amount was debited, it will either confirm here or be auto-reversed by your bank.
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-amber-900">
                <Spinner />
                <div>
                  Checking payment status…
                  {typeof processingSecondsRemaining === "number" ? (
                    <span className="ml-1">({formatSeconds(processingSecondsRemaining)} remaining)</span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {s === PaymentStates.PAYMENT_RECOVERABLE ? (
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="text-sm text-gray-900 font-medium">Payment not confirmed yet</div>
              {failureSummary ? <div className="mt-1 text-sm text-gray-700">{failureSummary}</div> : null}
              <div className="mt-2 text-sm text-gray-700">
                If you see a debit, do not retry — confirmation may be delayed.
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Attempt {Math.min(Number(props.attemptNo || 1), Number(props.maxAttempts || 3))} of {Number(props.maxAttempts || 3)}
              </div>
              <div className="mt-2 text-xs text-gray-600">If money was debited, wait before retrying.</div>
              {isRetryDisabled ? (
                <div className="mt-2 text-xs text-gray-600">Retry available in {formatSeconds(retrySecondsRemaining || 0)}</div>
              ) : null}
            </div>
          ) : null}

          {s !== PaymentStates.PAYMENT_PROCESSING && s !== PaymentStates.PAYMENT_RECOVERABLE && props.message ? (
            <div className="mt-2 text-sm text-gray-700">{props.message}</div>
          ) : null}

          <div className="mt-3 grid gap-2">
            <Step done={orderCreatedDone} pending={s === PaymentStates.ORDER_CREATED} label="Order created" />
            <Step done={initiatedDone} pending={s === PaymentStates.PAYMENT_INITIATED} label="Payment initiated" />
            <Step done={confirmedDone} pending={processingPending} label="Awaiting confirmation" />
          </div>
        </div>

        {showActions ? (
          <div className="flex flex-col gap-2">
            {props.onResume ? (
              <button
                onClick={props.onResume}
                disabled={s === PaymentStates.PAYMENT_RECOVERABLE ? isRetryDisabled : false}
                className={
                  "px-3 py-2 rounded-md text-sm " +
                  (s === PaymentStates.PAYMENT_RECOVERABLE && isRetryDisabled
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-gray-900 text-white hover:bg-gray-800")
                }
              >
                {s === PaymentStates.PAYMENT_PROCESSING
                  ? "Continue checking"
                  : s === PaymentStates.PAYMENT_RECOVERABLE
                    ? "Retry payment safely"
                    : "Resume"}
              </button>
            ) : null}
            {props.onHide ? (
              <button
                onClick={props.onHide}
                className="px-3 py-2 rounded-md bg-gray-100 text-gray-800 text-sm hover:bg-gray-200"
              >
                Hide for now
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
