import { SUGGESTION_RULES } from "./suggestionRules";
import type { RecoverySuggestion, VerificationDiscrepancy } from "./types";
import type { PaymentIntentStatus } from "../types";
import { assertAllowedRecoveryExecution } from "../recoveryExecution/guards";

export function buildRecoverySuggestion(args: {
  discrepancy: VerificationDiscrepancy;
  isLocked: boolean;
  internalStatus?: PaymentIntentStatus;
  featureEnabled?: boolean;
}): RecoverySuggestion {
  if (args.isLocked) {
    return {
      discrepancy: args.discrepancy,
      recommendedAction: "NO_ACTION",
      confidence: "HIGH",
      safe: true,
      canAutoExecute: false,
      reason: "Intent is locked; manual review required before any further changes",
      nextSteps: ["No action"],
    };
  }

  const rule = SUGGESTION_RULES[args.discrepancy];

  let canAutoExecute = false;
  const featureEnabled = !!args.featureEnabled;
  const internalStatus = args.internalStatus;

  if (featureEnabled && internalStatus) {
    const action = rule.recommendedAction;
    if (action === "MARK_VERIFYING" || action === "MARK_RECOVERABLE") {
      try {
        assertAllowedRecoveryExecution({
          currentStatus: internalStatus,
          isLocked: false,
          action,
        });
        canAutoExecute = true;
      } catch {
        canAutoExecute = false;
      }
    }
  }

  return { discrepancy: args.discrepancy, ...rule, canAutoExecute };
}
