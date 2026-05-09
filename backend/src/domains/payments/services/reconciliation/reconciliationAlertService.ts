import { logger } from "../../../../utils/logger";

import type { IReconciliationReport } from "../../models/ReconciliationReport";
import type { AlertSeverity } from "../../models/ReconciliationAuditLog";

/**
 * AlertChannel — pluggable interface for reconciliation alert delivery.
 * Implementations may write to logs, send to Slack, PagerDuty, etc.
 */
export interface AlertChannel {
  sendAlert(report: IReconciliationReport, severity: AlertSeverity): Promise<void>;
}

/**
 * LogAlertChannel — default implementation that writes structured JSON
 * to the application logger at the appropriate level.
 *
 * Severity → log level mapping:
 *   CRITICAL → logger.error
 *   WARNING  → logger.warn
 *   INFO     → logger.info
 *
 * All log entries carry the label `[RECONCILIATION_ALERT]` and the full
 * set of report fields required for downstream alerting and dashboards.
 */
export class LogAlertChannel implements AlertChannel {
  async sendAlert(report: IReconciliationReport, severity: AlertSeverity): Promise<void> {
    const logLevel =
      severity === "CRITICAL" ? "error" : severity === "WARNING" ? "warn" : "info";

    logger[logLevel]("[RECONCILIATION_ALERT]", {
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
