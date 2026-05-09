/**
 * Payment Reconciliation System — Public API
 *
 * Re-exports the public surface of the reconciliation module.
 * Import from this file rather than from individual service files.
 *
 * Requirements: 5.1, 5.11
 */

// Orchestrator — entry points
export {
  startReconciliationSystem,
  runReconciliationOnce,
  recoverAbandonedRuns,
} from './reconciliationOrchestrator';

export type {
  ReconciliationConfig,
  ReconciliationRunResult,
} from './reconciliationOrchestrator';

// Type aliases from models
export type { SubServiceName } from '../../models/ReconciliationRun';
export type { AnomalyType, FixAction, AlertSeverity } from '../../models/ReconciliationAuditLog';

// Alert channel interface (for custom implementations)
export type { AlertChannel } from './reconciliationAlertService';
export { LogAlertChannel } from './reconciliationAlertService';

// Query API
export { getAuditLogsForOrder } from './reconciliationReportService';
