import type { PaymentsReconciliationItem, PaymentsRecoveryRowEnrichment } from "./types";
import { formatAgeMinutes, formatIsoDate, maskId } from "./utils";

export type RecoveryTableRow = {
  item: PaymentsReconciliationItem;
  enrichment?: PaymentsRecoveryRowEnrichment;
};

export default function RecoveryTable(props: {
  rows: RecoveryTableRow[];
  selectedPaymentIntentId?: string;
  onSelect: (row: RecoveryTableRow) => void;
  loadingRowIds: Record<string, boolean>;
}): JSX.Element {
  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
            <tr className="text-left text-xs font-semibold text-gray-700">
              <th className="px-4 py-3 whitespace-nowrap">Order ID</th>
              <th className="px-4 py-3 whitespace-nowrap">Payment Intent</th>
              <th className="px-4 py-3 whitespace-nowrap">Gateway</th>
              <th className="px-4 py-3 whitespace-nowrap">Intent Status</th>
              <th className="px-4 py-3 whitespace-nowrap">Order Payment Status</th>
              <th className="px-4 py-3 whitespace-nowrap">Age</th>
              <th className="px-4 py-3 whitespace-nowrap">Locked?</th>
              <th className="px-4 py-3 whitespace-nowrap">Discrepancy</th>
              <th className="px-4 py-3 whitespace-nowrap">Suggested Action</th>
              <th className="px-4 py-3 whitespace-nowrap">Confidence</th>
              <th className="px-4 py-3 whitespace-nowrap">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {props.rows.map((r) => {
              const isSelected = r.item.paymentIntentId === props.selectedPaymentIntentId;
              const discrepancy = r.enrichment?.suggestion?.discrepancy || r.enrichment?.verification?.assessment?.discrepancy;
              const action = r.enrichment?.suggestion?.suggestion?.recommendedAction;
              const confidence = r.enrichment?.suggestion?.suggestion?.confidence;
              const isRowLoading = !!props.loadingRowIds[r.item.paymentIntentId];

              return (
                <tr
                  key={r.item.paymentIntentId}
                  className={
                    isSelected
                      ? "bg-blue-50"
                      : "hover:bg-gray-50 cursor-pointer"
                  }
                  onClick={() => props.onSelect(r)}
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-800 whitespace-nowrap">
                    {maskId(r.item.orderId)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-800 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span>{maskId(r.item.paymentIntentId)}</span>
                      {isRowLoading ? (
                        <span className="text-[11px] text-gray-500">Loading…</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{r.item.gateway}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{String(r.item.status || "")}</td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {r.item.orderPaymentStatus ? String(r.item.orderPaymentStatus) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatAgeMinutes(r.item.ageMinutes)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={
                        r.item.isLocked
                          ? "inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700"
                          : "inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700"
                      }
                    >
                      {r.item.isLocked ? "Yes" : "No"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {discrepancy ? String(discrepancy) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {action ? String(action) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {confidence ? String(confidence) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {formatIsoDate(r.item.updatedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
