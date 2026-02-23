import { useMemo, useState } from "react";

import { internalGetBlob, internalGetJson } from "../payments/recovery/internalApi";

type RevenueLedgerRow = {
  date: string;
  eventType: "sale" | "refund";
  orderId: string;
  paymentIntentId?: string;
  gateway: string;
  amount: number;
  currency: string;
};

type RefundLedgerRow = {
  refundId?: string;
  status?: string;
  completedAt: string;
  orderId: string;
  paymentIntentId?: string;
  gateway: string;
  amount: number;
  currency: string;
};

type NetRevenueTotals = {
  currency: string;
  grossRevenue: number;
  capturedRevenue: number;
  refundedAmount: number;
  netRevenue: number;
  refundRate: number;
};

type GatewayPerformanceRow = {
  gateway: string;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  captureRate: number;
};

type ActiveTab = "revenue" | "refunds" | "net" | "gateway";

function isoForDateInput(d: Date): string {
  // date input expects yyyy-mm-dd
  return d.toISOString().slice(0, 10);
}

function isoRangeStart(dateYmd: string): string {
  // Start of local day expressed in UTC; good enough for admin reporting.
  // (Backend uses exact ISO timestamps.)
  return `${dateYmd}T00:00:00.000Z`;
}

function isoRangeEndExclusive(dateYmd: string): string {
  const d = new Date(`${dateYmd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

export default function FinanceReportsPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<ActiveTab>("net");

  const today = useMemo(() => new Date(), []);
  const defaultTo = useMemo(() => isoForDateInput(today), [today]);
  const defaultFrom = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 7);
    return isoForDateInput(d);
  }, [today]);

  const [fromYmd, setFromYmd] = useState(defaultFrom);
  const [toYmd, setToYmd] = useState(defaultTo);
  const [currency, setCurrency] = useState("INR");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [revenueRows, setRevenueRows] = useState<RevenueLedgerRow[]>([]);
  const [refundRows, setRefundRows] = useState<RefundLedgerRow[]>([]);
  const [netTotals, setNetTotals] = useState<NetRevenueTotals | null>(null);
  const [gatewayRows, setGatewayRows] = useState<GatewayPerformanceRow[]>([]);

  const accessToken = useMemo(() => window.localStorage.getItem("accessToken") || null, []);

  const fromIso = useMemo(() => isoRangeStart(fromYmd), [fromYmd]);
  const toIso = useMemo(() => isoRangeEndExclusive(toYmd), [toYmd]);

  const commonParams = useMemo(() => {
    return {
      from: fromIso,
      to: toIso,
      currency,
      limit: 2000,
    };
  }, [currency, fromIso, toIso]);

  const runReport = async () => {
    setLoading(true);
    setError(null);

    try {
      if (activeTab === "revenue") {
        const res = await internalGetJson<{ rows: RevenueLedgerRow[] }>({
          pathname: "/internal/finance/revenue-ledger",
          params: commonParams,
          accessToken,
        });
        setRevenueRows(res.data.rows || []);
        return;
      }

      if (activeTab === "refunds") {
        const res = await internalGetJson<{ rows: RefundLedgerRow[] }>({
          pathname: "/internal/finance/refund-ledger",
          params: commonParams,
          accessToken,
        });
        setRefundRows(res.data.rows || []);
        return;
      }

      if (activeTab === "gateway") {
        const res = await internalGetJson<{ rows: GatewayPerformanceRow[] }>({
          pathname: "/internal/finance/gateway-performance",
          params: {
            from: fromIso,
            to: toIso,
            limit: 5000,
          },
          accessToken,
        });
        setGatewayRows(res.data.rows || []);
        return;
      }

      const res = await internalGetJson<{ totals: NetRevenueTotals }>({
        pathname: "/internal/finance/net-revenue",
        params: commonParams,
        accessToken,
      });
      setNetTotals(res.data.totals || null);
    } catch (e: any) {
      setError(String(e?.message || "Failed"));
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    setError(null);
    try {
      const baseParams = activeTab === "gateway"
        ? { from: fromIso, to: toIso, limit: 5000 }
        : commonParams;

      const pathname =
        activeTab === "revenue"
          ? "/internal/finance/revenue-ledger.csv"
          : activeTab === "refunds"
            ? "/internal/finance/refund-ledger.csv"
            : activeTab === "gateway"
              ? "/internal/finance/gateway-performance.csv"
              : "/internal/finance/net-revenue.csv";

      const { blob, filename } = await internalGetBlob({
        pathname,
        params: baseParams,
        accessToken,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "finance-report.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(String(e?.message || "Failed to export"));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xl font-bold text-gray-900">Ops: Finance Reports</div>
            <div className="mt-1 text-sm text-gray-600">
              Read-only, accounting-safe views derived from ledger/collection truth.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
              onClick={() => void runReport()}
              disabled={loading}
            >
              {loading ? "Loading…" : "Run"}
            </button>
            <button
              type="button"
              className="rounded-md bg-white px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50"
              onClick={() => void exportCsv()}
              disabled={loading}
            >
              Export CSV
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs font-medium text-gray-600">From</div>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={fromYmd}
              onChange={(e) => setFromYmd(e.target.value)}
            />
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs font-medium text-gray-600">To</div>
            <input
              type="date"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={toYmd}
              onChange={(e) => setToYmd(e.target.value)}
            />
            <div className="mt-1 text-[11px] text-gray-500">Inclusive; exported as end-exclusive.</div>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs font-medium text-gray-600">Currency</div>
            <input
              type="text"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="text-xs font-medium text-gray-600">Report</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={
                  activeTab === "net"
                    ? "rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                    : "rounded-md bg-white px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300"
                }
                onClick={() => setActiveTab("net")}
              >
                Net
              </button>
              <button
                type="button"
                className={
                  activeTab === "revenue"
                    ? "rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                    : "rounded-md bg-white px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300"
                }
                onClick={() => setActiveTab("revenue")}
              >
                Revenue
              </button>
              <button
                type="button"
                className={
                  activeTab === "refunds"
                    ? "rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                    : "rounded-md bg-white px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300"
                }
                onClick={() => setActiveTab("refunds")}
              >
                Refunds
              </button>
              <button
                type="button"
                className={
                  activeTab === "gateway"
                    ? "rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white"
                    : "rounded-md bg-white px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300"
                }
                onClick={() => setActiveTab("gateway")}
              >
                Gateway
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <div className="mt-6">
          {activeTab === "net" ? (
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-sm font-semibold text-gray-900">Net Revenue Statement</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="rounded-md bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs text-gray-600">Gross</div>
                  <div className="text-lg font-bold text-gray-900">{netTotals ? netTotals.grossRevenue : "—"}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs text-gray-600">Captured (Razorpay)</div>
                  <div className="text-lg font-bold text-gray-900">{netTotals ? netTotals.capturedRevenue : "—"}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs text-gray-600">Refunded</div>
                  <div className="text-lg font-bold text-gray-900">{netTotals ? netTotals.refundedAmount : "—"}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs text-gray-600">Net</div>
                  <div className="text-lg font-bold text-gray-900">{netTotals ? netTotals.netRevenue : "—"}</div>
                </div>
                <div className="rounded-md bg-gray-50 p-3 border border-gray-200">
                  <div className="text-xs text-gray-600">Refund rate</div>
                  <div className="text-lg font-bold text-gray-900">{netTotals ? netTotals.refundRate : "—"}</div>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-600">
                Refunds are recognized on completion date when present in the ledger.
              </div>
            </div>
          ) : null}

          {activeTab === "revenue" ? (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="text-sm font-semibold text-gray-900">Revenue Ledger</div>
                <div className="text-xs text-gray-600 mt-1">One row per SALE/REFUND event (accounting date).</div>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-700">
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 whitespace-nowrap">Type</th>
                      <th className="px-4 py-3 whitespace-nowrap">Order</th>
                      <th className="px-4 py-3 whitespace-nowrap">PaymentIntent</th>
                      <th className="px-4 py-3 whitespace-nowrap">Gateway</th>
                      <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {revenueRows.map((r, idx) => (
                      <tr key={`${r.orderId}-${r.date}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.date}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.eventType}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-800">{r.orderId}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-800">{r.paymentIntentId || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.gateway}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-semibold">{r.amount} {r.currency}</td>
                      </tr>
                    ))}
                    {revenueRows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-sm text-gray-600" colSpan={6}>No rows.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === "refunds" ? (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="text-sm font-semibold text-gray-900">Refund Ledger</div>
                <div className="text-xs text-gray-600 mt-1">Ledger-backed refunds only (eventType=REFUND).</div>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-700">
                      <th className="px-4 py-3 whitespace-nowrap">Completed</th>
                      <th className="px-4 py-3 whitespace-nowrap">Refund ID</th>
                      <th className="px-4 py-3 whitespace-nowrap">Order</th>
                      <th className="px-4 py-3 whitespace-nowrap">PaymentIntent</th>
                      <th className="px-4 py-3 whitespace-nowrap">Gateway</th>
                      <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {refundRows.map((r, idx) => (
                      <tr key={`${r.orderId}-${r.completedAt}-${idx}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.completedAt}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-800">{r.refundId || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-800">{r.orderId}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-800">{r.paymentIntentId || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.gateway}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-semibold">{r.amount} {r.currency}</td>
                      </tr>
                    ))}
                    {refundRows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-sm text-gray-600" colSpan={6}>No rows.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === "gateway" ? (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200">
                <div className="text-sm font-semibold text-gray-900">Gateway Performance</div>
                <div className="text-xs text-gray-600 mt-1">Aggregated by PaymentIntent status.</div>
              </div>
              <div className="max-h-[70vh] overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-700">
                      <th className="px-4 py-3 whitespace-nowrap">Gateway</th>
                      <th className="px-4 py-3 whitespace-nowrap">Success</th>
                      <th className="px-4 py-3 whitespace-nowrap">Failed</th>
                      <th className="px-4 py-3 whitespace-nowrap">Pending</th>
                      <th className="px-4 py-3 whitespace-nowrap">Capture rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {gatewayRows.map((r) => (
                      <tr key={r.gateway} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.gateway}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.successCount}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.failedCount}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-700">{r.pendingCount}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-900 font-semibold">{r.captureRate}</td>
                      </tr>
                    ))}
                    {gatewayRows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-sm text-gray-600" colSpan={5}>No rows.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
