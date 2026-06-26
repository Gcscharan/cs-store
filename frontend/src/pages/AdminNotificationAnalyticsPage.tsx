import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { toApiUrl } from "../config/runtime";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Bell,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  TimeRange,
  getDateRangeFromTimeRange,
  getPeriodForRange,
  computeDeliverySuccessRate,
  transformToLineChartData,
} from "../utils/notificationAnalytics";

/** Notification categories */
const CATEGORIES = ["order", "delivery", "payment", "account", "promo"] as const;

/** Priority levels */
const PRIORITIES = ["P0", "P1", "P2", "P3"] as const;

/** Colors for charts */
const PIE_COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#10b981"];

interface AnalyticsData {
  period: string;
  startDate: string;
  endDate: string;
  filters: Record<string, string>;
  metrics: {
    byTimePeriod: Array<{
      _id: Record<string, number>;
      sent: number;
      delivered: number;
      opened: number;
      failed: number;
      total: number;
    }>;
    totals: {
      sent: number;
      delivered: number;
      opened: number;
      failed: number;
    };
  };
  topNotificationTypes: Array<{
    eventType: string;
    count: number;
    category: string;
    priority: string;
  }>;
  topFailureReasons: Array<{
    reason: string;
    channel: string;
    count: number;
  }>;
  pushTokenHealth: {
    totalActiveTokens: number;
    tokensInvalidatedLast24h: number;
    percentUsersWithValidToken: number;
  };
  deliveryRateByType: Array<{
    eventType: string;
    deliveryRate: number;
    total: number;
    delivered: number;
    failed: number;
    warning: boolean;
  }>;
  warnings: Array<{
    eventType: string;
    deliveryRate: number;
    message: string;
  }>;
}

const AdminNotificationAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, tokens } = useSelector(
    (state: RootState) => state.auth
  );

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("7days");
  const [category, setCategory] = useState<string>("");
  const [priority, setPriority] = useState<string>("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Fetches analytics data from the API */
  const fetchAnalytics = useCallback(async () => {
    if (!isAuthenticated || !tokens?.accessToken) return;

    try {
      setIsLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRangeFromTimeRange(timeRange);
      const period = getPeriodForRange(timeRange);

      const params = new URLSearchParams({
        period,
        startDate,
        endDate,
      });

      if (category) params.set("category", category);
      if (priority) params.set("priority", priority);

      const response = await fetch(
        toApiUrl(`/admin/notifications/analytics?${params.toString()}`),
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`);
      }

      const data = await response.json();
      setAnalytics(data);
      setLastRefresh(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load notification analytics";
      setError(message);
      toast.error("Failed to load notification analytics");
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, tokens?.accessToken, timeRange, category, priority]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      fetchAnalytics();
    }, 60000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [fetchAnalytics]);

  /** Transforms time period data into chart-friendly format */
  const getLineChartData = () => {
    if (!analytics?.metrics?.byTimePeriod) return [];
    return transformToLineChartData(analytics.metrics.byTimePeriod, analytics.period);
  };

  /** Transforms failure data into pie chart format */
  const getFailurePieData = () => {
    if (!analytics?.topFailureReasons?.length) return [];
    return analytics.topFailureReasons.slice(0, 5).map((item) => ({
      name: `${item.reason} (${item.channel})`,
      value: item.count,
    }));
  };

  /** Computes the delivery success rate as a percentage */
  const getDeliverySuccessRate = (): number => {
    if (!analytics?.metrics?.totals) return 0;
    return computeDeliverySuccessRate(analytics.metrics.totals);
  };

  if (error && !analytics) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchAnalytics}
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
                aria-label="Back to admin dashboard"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <Bell className="h-6 w-6 text-blue-600" />
                  Notification Analytics
                </h1>
                <p className="text-gray-600 text-sm">
                  Monitor notification delivery performance and system health
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {lastRefresh && (
                <span className="text-xs text-gray-500 hidden sm:inline">
                  Last updated: {lastRefresh.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={fetchAnalytics}
                disabled={isLoading}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                aria-label="Refresh analytics"
              >
                <RefreshCw className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Time Range Selector */}
            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
              {([
                { value: "today", label: "Today" },
                { value: "7days", label: "7 Days" },
                { value: "30days", label: "30 Days" },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeRange(option.value)}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    timeRange === option.value
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* Category Filter */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Filter by priority"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Warnings Banner */}
        {analytics?.warnings && analytics.warnings.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-amber-800">Delivery Rate Warnings</h3>
                <ul className="mt-1 space-y-1">
                  {analytics.warnings.map((warning, i) => (
                    <li key={i} className="text-sm text-amber-700">
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Summary Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            icon={<Activity className="h-6 w-6 text-blue-600" />}
            label="Total Sent"
            value={analytics?.metrics?.totals?.sent ?? 0}
            bgColor="bg-blue-100"
          />
          <MetricCard
            icon={<CheckCircle className="h-6 w-6 text-green-600" />}
            label="Delivered"
            value={(analytics?.metrics?.totals?.delivered ?? 0) + (analytics?.metrics?.totals?.opened ?? 0)}
            bgColor="bg-green-100"
          />
          <MetricCard
            icon={<XCircle className="h-6 w-6 text-red-600" />}
            label="Failed"
            value={analytics?.metrics?.totals?.failed ?? 0}
            bgColor="bg-red-100"
          />
          <MetricCard
            icon={<Clock className="h-6 w-6 text-purple-600" />}
            label="Success Rate"
            value={`${getDeliverySuccessRate()}%`}
            bgColor="bg-purple-100"
            highlight={getDeliverySuccessRate() < 80}
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Line Chart - Notifications Over Time */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Notifications Over Time
            </h3>
            {getLineChartData().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={getLineChartData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="sent"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Total Sent"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="delivered"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Delivered"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Failed"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No data available for the selected period
              </div>
            )}
          </div>

          {/* Delivery Success Rate Gauge + Failure Pie */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Delivery Success Rate
            </h3>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative w-32 h-32 mb-4">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="12"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    fill="none"
                    stroke={getDeliverySuccessRate() >= 80 ? "#10b981" : "#ef4444"}
                    strokeWidth="12"
                    strokeDasharray={`${(getDeliverySuccessRate() / 100) * 327} 327`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-2xl font-bold ${getDeliverySuccessRate() >= 80 ? "text-green-600" : "text-red-600"}`}>
                    {getDeliverySuccessRate()}%
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 text-center">
                {getDeliverySuccessRate() >= 80 ? "Healthy" : "Below threshold (80%)"}
              </p>
            </div>
          </div>
        </div>

        {/* Failure Breakdown Pie Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Failure Breakdown
            </h3>
            {getFailurePieData().length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={getFailurePieData()}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name.length > 20 ? name.slice(0, 20) + "..." : name} (${(percent * 100).toFixed(0)}%)`
                    }
                    labelLine={false}
                  >
                    {getFailurePieData().map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-gray-500">
                No failures recorded
              </div>
            )}
          </div>

          {/* Push Token Health */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Push Token Health
            </h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Active Push Tokens</span>
                <span className="text-xl font-bold text-gray-900">
                  {analytics?.pushTokenHealth?.totalActiveTokens ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Invalidated (24h)</span>
                <span className="text-xl font-bold text-red-600">
                  {analytics?.pushTokenHealth?.tokensInvalidatedLast24h ?? 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Users with Valid Token</span>
                <span className="text-xl font-bold text-green-600">
                  {analytics?.pushTokenHealth?.percentUsersWithValidToken
                    ? `${(analytics.pushTokenHealth.percentUsersWithValidToken * 100).toFixed(1)}%`
                    : "0%"}
                </span>
              </div>
              <div className="pt-4 border-t border-gray-100">
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${(analytics?.pushTokenHealth?.percentUsersWithValidToken ?? 0) * 100}%`,
                    }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 mt-2">Token coverage across all users</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Top Notification Types */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Top Notification Types
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Event Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics?.topNotificationTypes?.length ? (
                    analytics.topNotificationTypes.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">
                          {item.eventType}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                            {item.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <PriorityBadge priority={item.priority} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                          {item.count.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                        No notification data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Failures */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Recent Failures
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Reason
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Channel
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {analytics?.topFailureReasons?.length ? (
                    analytics.topFailureReasons.map((item, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate" title={item.reason}>
                          {item.reason}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                            {item.channel}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-red-600 text-right font-medium">
                          {item.count.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                        No failures recorded
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Auto-refresh indicator */}
        <div className="text-center text-xs text-gray-400 pb-4">
          <RefreshCw className="h-3 w-3 inline mr-1" />
          Auto-refreshes every 60 seconds
        </div>
      </div>
    </div>
  );
};

/** Metric summary card component */
function MetricCard({
  icon,
  label,
  value,
  bgColor,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bgColor: string;
  highlight?: boolean;
}) {
  return (
    <div className={`bg-white rounded-lg shadow-sm p-6 border ${highlight ? "border-red-300" : "border-gray-200"}`}>
      <div className="flex items-center">
        <div className={`p-2 rounded-lg ${bgColor}`}>{icon}</div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`text-2xl font-bold ${highlight ? "text-red-600" : "text-gray-900"}`}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Priority badge component */
function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    P0: "bg-red-100 text-red-700",
    P1: "bg-orange-100 text-orange-700",
    P2: "bg-blue-100 text-blue-700",
    P3: "bg-gray-100 text-gray-700",
  };

  return (
    <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${styles[priority] ?? "bg-gray-100 text-gray-700"}`}>
      {priority}
    </span>
  );
}

export default AdminNotificationAnalyticsPage;
