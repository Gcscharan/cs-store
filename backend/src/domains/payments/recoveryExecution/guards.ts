import type { PaymentIntentStatus } from "../types";
import type { RecoveryExecuteAction } from "./types";

export function assertAllowedRecoveryExecution(args: {
  currentStatus: PaymentIntentStatus;
  isLocked: boolean;
  action: RecoveryExecuteAction;
}): { nextStatus: PaymentIntentStatus } {
  if (args.isLocked) {
    throw Object.assign(new Error("INVALID_STATE_TRANSITION"), { statusCode: 409 });
  }

  const from = String(args.currentStatus) as PaymentIntentStatus;

  if (args.action === "MARK_RECOVERABLE") {
    if (from !== "CREATED" && from !== "GATEWAY_ORDER_CREATED") {
      throw Object.assign(new Error("INVALID_STATE_TRANSITION"), { statusCode: 409 });
    }
    return { nextStatus: "PAYMENT_RECOVERABLE" };
  }

  if (args.action === "MARK_VERIFYING") {
    if (from !== "PAYMENT_PROCESSING" && from !== "PAYMENT_RECOVERABLE") {
      throw Object.assign(new Error("INVALID_STATE_TRANSITION"), { statusCode: 409 });
    }
    return { nextStatus: "VERIFYING" };
  }

  throw Object.assign(new Error("INVALID_STATE_TRANSITION"), { statusCode: 409 });
}
