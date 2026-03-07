import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { toApiUrl } from "../config/runtime";
import {
  ArrowLeft,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  RefreshCw,
} from "lucide-react";
import { useToast } from "../components/AccessibleToast";

// Types matching backend financeMetrics.ts
type CurrencyCode = string;
type FinanceGateway = "RAZORPAY" | "COD" | string;

interface FinanceTotals {
  currency: CurrencyCode;
  grossRevenue: number;
  capturedRevenue: number;
  refundedAmount: number;
  netRevenue: number;
  refundRate: number;
}

interface FinanceLedgerRow {
  date: string;
  eventType: "sale" | "refund";
  orderId: string;
  paymentIntentId?: string;
  gateway: FinanceGateway;
  amount: number;
  currency: CurrencyCode;
}

interface RefundLedgerRow {
  refundId?: string;
  status?: string;
  completedAt: string;
  orderId: string;
  amount: number;
  currency: CurrencyCode;
}

interface GatewayPerformance {
  gateway: FinanceGateway;
  successCount: number;
  failedCount: number;
  pendingCount: number;
  successRate: number;
}

const AdminFinancePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, tokens } = useSelector(
    (state: RootState) => state.auth
  );
  const { success, error } = useToast();

  // Date range state - default last 30 days
  const [dateRange, setDateRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return {
      from: from.toISOString().split("T")[0],
      to: to.toISOString().split("T")[0],
    };
  });

  // Data state
  const [totals, setTotals] = useState<FinanceTotals | null>(null);
  const [revenueLedger, setRevenueLedger] = useState<FinanceLedgerRow[]>([]);
  const [refundLedger, setRefundLedger] = useState<RefundLedgerRow[]>([]);
  const [gatewayPerformance, setGatewayPerformance] = useState<GatewayPerformance[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "revenue" | "refunds">("overview");

  // Fetch all finance data
  const fetchFinanceData = async () => {
    if (!isAuthenticated || !tokens?.accessToken) {
      console.log("[AdminFinancePage] Skipping fetch - not authenticated");
      return;
    }

    try {
      setIsLoading(true);
      setErrorState(null);
      console.log("[AdminFinancePage] Fetching finance data...");

      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.accessToken}`,
      };

      // Build query params
      const queryParams = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        currency: "INR",
      });

      // Fetch all endpoints in parallel
      const [totalsRes, revenueRes, refundRes, gatewayRes] = await Promise.all([
        fetch(toApiUrl(`/internal/finance/net-revenue?${queryParams}`), { headers }),
        fetch(toApiUrl(`/internal/finance/revenue-ledger?${queryParams}`), { headers }),
        fetch(toApiUrl(`/internal/finance/refund-ledger?${queryParams}`), { headers }),
        fetch(toApiUrl(`/internal/finance/gateway-performance?${queryParams}`), { headers }),
      ]);

      console.log("[AdminFinancePage] Response statuses:", {
        totals: totalsRes.status,
        revenue: revenueRes.status,
        refund: refundRes.status,
        gateway: gatewayRes.status,
      });

      if (!totalsRes.ok || !revenueRes.ok || !refundRes.ok || !gatewayRes.ok) {
        throw new Error("Failed to fetch finance data");
      }

      const totalsData = await totalsRes.json();
      const revenueData = await revenueRes.json();
      const refundData = await refundRes.json();
      const gatewayData = await gatewayRes.json();

      console.log("[AdminFinancePage] Data received:", {
        totals: totalsData,
        revenue: revenueData,
        refund: refundData,
        gateway: gatewayData,
      });

      setTotals(totalsData.totals || null);
      setRevenueLedger(revenueData.rows || []);
      setRefundLedger(refundData.rows || []);
      setGatewayPerformance(gatewayData.rows || []);
    } catch (err) {
      console.error("[AdminFinancePage] Error fetching finance data:", err);
      setErrorState("Failed to load finance data. Please try again.");
      error("Failed to load finance data");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch on mount and when date range changes
  useEffect(() => {
    console.log("[AdminFinancePage] Mounted, isAuthenticated:", isAuthenticated);
  }, []);

  useEffect(() => {
    if (isAuthenticated && tokens?.accessToken) {
      fetchFinanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, tokens?.accessToken, dateRange]);

  // CSV Export functions
  const exportRevenueCsv = async () => {
    if (!tokens?.accessToken) return;

    try {
      const queryParams = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        currency: "INR",
      });

      const response = await fetch(
        toApiUrl(`/internal/finance/revenue-ledger.csv?${queryParams}`),
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to export CSV");

      const csv = await response.text();
      downloadCsv(csv, `revenue-ledger-${dateRange.from}-to-${dateRange.to}.csv`);
      success("Revenue ledger exported");
    } catch (err) {
      console.error("[AdminFinancePage] CSV export error:", err);
      error("Failed to export CSV");
    }
  };

  const exportRefundCsv = async () => {
    if (!tokens?.accessToken) return;

    try {
      const queryParams = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        currency: "INR",
      });

      const response = await fetch(
        toApiUrl(`/internal/finance/refund-ledger.csv?${queryParams}`),
        {
          headers: {
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error("Failed to export CSV");

      const csv = await response.text();
      downloadCsv(csv, `refund-ledger-${dateRange.from}-to-${dateRange.to}.csv`);
      success("Refund ledger exported");
    } catch (err) {
      console.error("[AdminFinancePage] CSV export error:", err);
      error("Failed to export CSV");
    }
  };

  const downloadCsv = (csvContent: string, filename: string) => {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Format currency
  const formatCurrency = (amount: number, currency: string = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Calculate COD vs Online split from revenue ledger
  const getCodOnlineSplit = () => {
    let codTotal = 0;
    let onlineTotal = 0;

    for (const row of revenueLedger) {
      if (row.eventType === "sale") {
        if (row.gateway === "COD") {
          codTotal += row.amount;
        } else {
          onlineTotal += row.amount;
        }
      }
    }

    return { codTotal, onlineTotal };
  };

  const { codTotal, onlineTotal } = getCodOnlineSplit();

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading finance data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (errorState) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{errorState}</p>
          <button
            onClick={() => {
              setErrorState(null);
              fetchFinanceData();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
          <button
            onClick={() => navigate("/admin")}
            className="ml-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <button
                onClick={() => navigate("/admin")}
                className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Finance Reports
                </h1>
                <p className="text-gray-600">
                  Ledger-based revenue and refund reporting
                </p>
              </div>
            </div>
            <button
              onClick={fetchFinanceData}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>

          {/* Date Range Filter */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-4">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">From:</label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, from: e.target.value }))
                  }
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">To:</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, to: e.target.value }))
                  }
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="text-sm text-gray-500">
                ({Math.ceil((new Date(dateRange.to).getTime() - new Date(dateRange.from).getTime()) / (1000 * 60 * 60 * 24))} days)
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("overview")}
                className={`${
                  activeTab === "overview"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab("revenue")}
                className={`${
                  activeTab === "revenue"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Revenue Ledger
              </button>
              <button
                onClick={() => setActiveTab("refunds")}
                className={`${
                  activeTab === "refunds"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Refund Ledger
              </button>
            </nav>
          </div>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && totals && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Gross Revenue */}
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Gross Revenue</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(totals.grossRevenue, totals.currency)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Refund Total */}
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Refunds</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(totals.refundedAmount, totals.currency)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(totals.refundRate * 100).toFixed(1)}% refund rate
                    </p>
                  </div>
                </div>
              </div>

              {/* Net Revenue */}
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Net Revenue</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(totals.netRevenue, totals.currency)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Online vs COD */}
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <CreditCard className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">COD vs Online</p>
                    <div className="text-sm">
                      <span className="text-orange-600 font-medium">
                        COD: {formatCurrency(codTotal, totals.currency)}
                      </span>
                      <span className="text-gray-400 mx-1">|</span>
                      <span className="text-blue-600 font-medium">
                        Online: {formatCurrency(onlineTotal, totals.currency)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Gateway Performance */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Gateway Performance</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Gateway
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Success
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Failed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pending
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Success Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {gatewayPerformance.map((gw, idx) => (
                      <tr key={idx}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {gw.gateway}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                          {gw.successCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                          {gw.failedCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">
                          {gw.pendingCount}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(gw.successRate * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                    {gatewayPerformance.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                          No gateway data available
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Ledger Tab */}
        {activeTab === "revenue" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Revenue Ledger</h2>
              <button
                onClick={exportRevenueCsv}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gateway
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {revenueLedger.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className={row.eventType === "refund" ? "bg-red-50" : ""}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            row.eventType === "sale"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {row.eventType.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {row.orderId.slice(-8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row.gateway}
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                          row.eventType === "refund" ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {row.eventType === "refund" ? "-" : "+"}
                        {formatCurrency(Math.abs(row.amount), row.currency)}
                      </td>
                    </tr>
                  ))}
                  {revenueLedger.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                        No revenue ledger entries found for this date range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {revenueLedger.length > 100 && (
              <div className="p-4 border-t border-gray-200 text-sm text-gray-500 text-center">
                Showing first 100 of {revenueLedger.length} entries. Export CSV for full data.
              </div>
            )}
          </div>
        )}

        {/* Refund Ledger Tab */}
        {activeTab === "refunds" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Refund Ledger</h2>
              <button
                onClick={exportRefundCsv}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Completed At
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Refund ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {refundLedger.slice(0, 100).map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(row.completedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {row.refundId ? row.refundId.slice(-8) : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {row.orderId.slice(-8)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            row.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {row.status || "COMPLETED"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                        -{formatCurrency(row.amount, row.currency)}
                      </td>
                    </tr>
                  ))}
                  {refundLedger.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                        No refund ledger entries found for this date range
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {refundLedger.length > 100 && (
              <div className="p-4 border-t border-gray-200 text-sm text-gray-500 text-center">
                Showing first 100 of {refundLedger.length} entries. Export CSV for full data.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminFinancePage;
