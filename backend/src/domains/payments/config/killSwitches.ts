function envBool(name: string, defaultValue: boolean): boolean {
  const raw = String(process.env[name] ?? "").trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return defaultValue;
}

export function isNewPaymentIntentCreationEnabled(args: { gateway: "RAZORPAY" }): boolean {
  if (args.gateway === "RAZORPAY") {
    return envBool("PAYMENTS_CREATE_INTENT_RAZORPAY_ENABLED", true);
  }
  return true;
}

export function isRecoveryExecutionEnabled(): boolean {
  // Existing guard remains authoritative.
  // This is an additional kill switch intended for production incident response.
  return envBool("PAYMENT_RECOVERY_EXECUTION_ENABLED", true);
}

export function isRefundExecutionEnabled(): boolean {
  // Kill switch to block admin refund execution/initiation.
  // Read-only refund history queries should remain available.
  return envBool("REFUND_EXECUTION_ENABLED", true);
}

export function isLegacyPaymentsRoutesBlocked(): boolean {
  return envBool("PAYMENTS_LEGACY_ROUTES_BLOCKED", false);
}
