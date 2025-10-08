import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { DashboardSkeleton } from "../components/SkeletonLoader";
import { AccessibleButton } from "../components/KeyboardNavigation";
import { useToast } from "../components/AccessibleToast";

interface DashboardData {
  salesData: Array<{
    _id: string;
    totalSales: number;
    orderCount: number;
    averageOrderValue: number;
  }>;
  monthlySales: Array<{
    _id: string;
    totalSales: number;
    orderCount: number;
  }>;
  ordersByStatus: Array<{
    _id: string;
    count: number;
    totalValue: number;
  }>;
  paymentStatusBreakdown: Array<{
    _id: string;
    count: number;
    totalValue: number;
  }>;
  deliveryStats: {
    totalDrivers: number;
    activeDrivers: number;
    availableDrivers: number;
    busyDrivers: number;
    totalEarnings: number;
    totalCompletedOrders: number;
    averageEarnings: number;
  };
  driverPerformance: Array<{
    _id: string;
    name: string;
    phone: string;
    vehicleType: string;
    availability: string;
    earnings: number;
    completedOrdersCount: number;
    assignedOrders: any[];
  }>;
  userStats: Array<{
    _id: string;
    count: number;
  }>;
  topProducts: Array<{
    _id: string;
    totalQuantity: number;
    totalRevenue: number;
  }>;
  recentOrders: Array<{
    _id: string;
    totalAmount: number;
    orderStatus: string;
    paymentStatus: string;
    userId: {
      name: string;
      phone: string;
    };
    deliveryBoyId?: {
      name: string;
      phone: string;
    };
    createdAt: string;
  }>;
  period: string;
  startDate: string;
  endDate: string;
}

const AdminDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState("month");
  const [dateRange, setDateRange] = useState({
    from: "",
    to: "",
  });
  const { success, error } = useToast();

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();

      if (dateRange.from && dateRange.to) {
        params.append("from", dateRange.from);
        params.append("to", dateRange.to);
      } else {
        params.append("period", selectedPeriod);
      }

      const response = await fetch(`/api/admin/stats?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      } else {
        throw new Error("Failed to fetch dashboard data");
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      error("Failed to load dashboard data", "Please try again later");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [selectedPeriod, dateRange]);

  // Export CSV
  const exportCSV = async (format: "csv" | "labels" = "csv") => {
    try {
      const params = new URLSearchParams();

      if (dateRange.from && dateRange.to) {
        params.append("from", dateRange.from);
        params.append("to", dateRange.to);
      }

      if (format === "labels") {
        params.append("format", "labels");
      }

      const response = await fetch(`/api/admin/orders/export?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download =
          format === "labels"
            ? `order-labels-${dateRange.from || "all"}-${dateRange.to || "all"}.csv`
            : `orders-${dateRange.from || "all"}-${dateRange.to || "all"}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        success(
          `${format === "labels" ? "Order labels" : "Orders"} exported successfully`
        );
      } else {
        throw new Error("Failed to export data");
      }
    } catch (err) {
      console.error("Export failed:", err);
      error("Failed to export data", "Please try again later");
    }
  };

  // Chart colors
  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-secondary-50 py-8 px-4"
      >
        <div className="container">
          <DashboardSkeleton />
        </div>
      </motion.div>
    );
  }

  if (!data) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-secondary-50 py-8 px-4"
      >
        <div className="container">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-secondary-900 mb-2">
              Failed to load dashboard
            </h3>
            <p className="text-secondary-600">Please try again later</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-secondary-50 py-8 px-4"
    >
      <div className="container">
        {/* Header */}
        <div className="card p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-secondary-900">
              Admin Dashboard
            </h1>

            <div className="flex items-center space-x-4">
              {/* Date Range Picker */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">
                  From:
                </label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, from: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">To:</label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, to: e.target.value }))
                  }
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>

              {/* Period Selector */}
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="day">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>

              {/* Export Buttons */}
              <div className="flex space-x-2">
                <AccessibleButton
                  onClick={() => exportCSV("csv")}
                  variant="primary"
                  size="sm"
                >
                  Export CSV
                </AccessibleButton>
                <AccessibleButton
                  onClick={() => exportCSV("labels")}
                  variant="secondary"
                  size="sm"
                >
                  Order Labels
                </AccessibleButton>
              </div>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">
                ₹
                {data.salesData
                  .reduce((sum, day) => sum + day.totalSales, 0)
                  .toLocaleString()}
              </div>
              <div className="text-sm text-blue-600">Total Sales</div>
            </div>

            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">
                {data.salesData.reduce((sum, day) => sum + day.orderCount, 0)}
              </div>
              <div className="text-sm text-green-600">Total Orders</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600">
                {data.deliveryStats.activeDrivers}
              </div>
              <div className="text-sm text-purple-600">Active Drivers</div>
            </div>

            <div className="bg-orange-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-orange-600">
                ₹{data.deliveryStats.totalEarnings.toLocaleString()}
              </div>
              <div className="text-sm text-orange-600">Driver Earnings</div>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Sales Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Sales Trend
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="_id" />
                <YAxis />
                <Tooltip
                  formatter={(value) => [`₹${value.toLocaleString()}`, "Sales"]}
                />
                <Area
                  type="monotone"
                  dataKey="totalSales"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Orders by Status */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Orders by Status
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.ordersByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ _id, count }) => `${_id}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {data.ordersByStatus.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Driver Performance & Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Driver Performance */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Driver Performance
            </h3>
            <div className="space-y-4">
              {data.driverPerformance.slice(0, 5).map((driver, index) => (
                <div
                  key={driver._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-sm font-semibold text-primary-600">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {driver.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {driver.vehicleType}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {driver.completedOrdersCount} orders
                    </div>
                    <div className="text-sm text-gray-600">
                      ₹{driver.earnings.toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Orders
            </h3>
            <div className="space-y-3">
              {data.recentOrders.slice(0, 5).map((order) => (
                <div
                  key={order._id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      #{order._id.slice(-6)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {order.userId.name} • ₹{order.totalAmount}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-xs px-2 py-1 rounded-full ${
                        order.orderStatus === "delivered"
                          ? "bg-green-100 text-green-800"
                          : order.orderStatus === "in_transit"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {order.orderStatus}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Products */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Top Products
            </h3>
            <div className="space-y-3">
              {data.topProducts.slice(0, 10).map((product, index) => (
                <div
                  key={product._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center text-xs font-semibold text-primary-600">
                      {index + 1}
                    </div>
                    <div className="font-medium text-gray-900">
                      {product._id}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      ₹{product.totalRevenue.toFixed(2)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {product.totalQuantity} sold
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
