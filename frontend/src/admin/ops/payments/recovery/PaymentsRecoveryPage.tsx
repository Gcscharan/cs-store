import { useMemo, useState } from "react";

import RecoveryDrawer from "./RecoveryDrawer";
import RecoveryExecuteModal from "./RecoveryExecuteModal";
import RecoveryTable, { type RecoveryTableRow } from "./RecoveryTable";
import { usePaymentsRecovery } from "./hooks";
import { internalGetBlob } from "./internalApi";
import { maskId } from "./utils";
import type { RecoveryExecuteAction } from "./types";

export default function PaymentsRecoveryPage(): JSX.Element {
  const {
    items,
    enrichmentsByIntentId,
    loadingList,
    listError,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
    loadingRowIds,
    hydrateRow,
    executeSuggestedAction,
  } = usePaymentsRecovery({ pageSize: 50 });

  const downloadCsv = async () => {
    try {
      const accessToken = window.localStorage.getItem("accessToken") || null;
      const { blob, filename } = await internalGetBlob({
        pathname: "/internal/payments/reconciliation.csv",
        params: {
          gateway: "RAZORPAY",
          limit: 200,
        },
        accessToken,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "payments-reconciliation.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      window.alert(String(e?.message || "Failed to export"));
    }
  };

  const [selectedIntentId, setSelectedIntentId] = useState<string | undefined>(undefined);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [executeSubmitting, setExecuteSubmitting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [lastAuditId, setLastAuditId] = useState<string | undefined>(undefined);

  const selected = useMemo(() => {
    if (!selectedIntentId) return undefined;
    return items.find((i) => i.paymentIntentId === selectedIntentId);
  }, [items, selectedIntentId]);

  const selectedEnrichment = selectedIntentId ? enrichmentsByIntentId[selectedIntentId] : undefined;

  const suggestedAction = selectedEnrichment?.suggestion?.suggestion?.recommendedAction as
    | RecoveryExecuteAction
    | string
    | undefined;
  const canAutoExecute = !!selectedEnrichment?.suggestion?.suggestion?.canAutoExecute;
  const canExecuteSuggestedAction =
    canAutoExecute && (suggestedAction === "MARK_VERIFYING" || suggestedAction === "MARK_RECOVERABLE");

  const rows: RecoveryTableRow[] = useMemo(
    () =>
      items.map((item) => ({
        item,
        enrichment: enrichmentsByIntentId[item.paymentIntentId],
      })),
    [items, enrichmentsByIntentId]
  );

  const onSelect = async (row: RecoveryTableRow) => {
    setSelectedIntentId(row.item.paymentIntentId);
    if (!enrichmentsByIntentId[row.item.paymentIntentId]) {
      try {
        await hydrateRow(row.item.paymentIntentId, row.item.orderId);
      } catch {
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-bold text-gray-900">Ops: Payment Recovery Suggestions</div>
            <div className="mt-1 text-sm text-gray-600">
              Read-only view of stuck/inconsistent payments with suggested manual recovery actions.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
              onClick={refresh}
              disabled={loadingList}
            >
              Refresh
            </button>
            <button
              type="button"
              className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
              onClick={() => void downloadCsv()}
              disabled={loadingList}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-6">
          {listError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {listError}
            </div>
          ) : null}

          {loadingList ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">Loading…</div>
          ) : null}

          {!loadingList && !listError && rows.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-700">
              No reconciliation results.
            </div>
          ) : null}

          {rows.length ? (
            <RecoveryTable
              rows={rows}
              selectedPaymentIntentId={selectedIntentId}
              onSelect={onSelect}
              loadingRowIds={loadingRowIds}
            />
          ) : null}

          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              {selected ? (
                <span>
                  Selected:
                  <span className="ml-2 font-mono">{maskId(selected.paymentIntentId)}</span>
                </span>
              ) : (
                ""
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasMore ? (
                <button
                  type="button"
                  className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              ) : (
                <div className="text-xs text-gray-500">No more results</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <RecoveryDrawer
        open={!!selectedIntentId}
        onClose={() => setSelectedIntentId(undefined)}
        item={selected}
        enrichment={selectedEnrichment}
        loading={selectedIntentId ? !!loadingRowIds[selectedIntentId] && !selectedEnrichment : false}
        canExecuteSuggestedAction={!!selectedIntentId && !!selectedEnrichment && canExecuteSuggestedAction}
        onExecuteSuggestedAction={() => {
          setExecuteError(null);
          setExecuteOpen(true);
        }}
        lastAuditId={lastAuditId}
      />

      {selectedIntentId && suggestedAction && (suggestedAction === "MARK_VERIFYING" || suggestedAction === "MARK_RECOVERABLE") ? (
        <RecoveryExecuteModal
          open={executeOpen}
          paymentIntentId={selectedIntentId}
          action={suggestedAction as RecoveryExecuteAction}
          isSubmitting={executeSubmitting}
          error={executeError}
          onClose={() => {
            if (!executeSubmitting) setExecuteOpen(false);
          }}
          onConfirm={async ({ reason, confirm }) => {
            if (!selectedIntentId) return;
            const orderId = selected?.orderId || "";
            if (!orderId) {
              setExecuteError("Missing order context for this intent");
              return;
            }
            setExecuteSubmitting(true);
            setExecuteError(null);
            try {
              const out = await executeSuggestedAction({
                paymentIntentId: selectedIntentId,
                orderId,
                action: suggestedAction as RecoveryExecuteAction,
                reason,
                confirm: confirm as "YES_I_UNDERSTAND_THIS_CHANGES_STATE",
              });
              setLastAuditId(out.auditId);
              try {
                await hydrateRow(selectedIntentId, orderId);
              } catch {
              }
              setExecuteOpen(false);
            } catch (e: any) {
              setExecuteError(String(e?.message || "Failed"));
            } finally {
              setExecuteSubmitting(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}
