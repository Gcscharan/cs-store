import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Calendar,
  Download,
} from "lucide-react";

const AdminAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, tokens } = useSelector(
    (state: RootState) => state.auth
  );
  const [analytics, setAnalytics] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalUsers: 0,
    totalProducts: 0,
    monthlyRevenue: [] as { month: string; revenue: number }[],
    topProducts: [] as { name: string; sales: number; revenue: number }[],
    recentOrders: [] as {
      id: string;
      customer: string;
      amount: number;
      status: string;
    }[],
  });
  const [isLoading, setIsLoading] = useState(true);

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated || !user?.isAdmin) {
      navigate("/login");
      return;
    }
    fetchAnalytics();
  }, [isAuthenticated, user, navigate]);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);

      const response = await fetch("/api/admin/analytics", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const data = await response.json();
      
      setAnalytics({
        totalRevenue: data.totalRevenue || 0,
        totalOrders: data.totalOrders || 0,
        totalUsers: data.totalUsers || 0,
        totalProducts: data.totalProducts || 0,
        monthlyRevenue: data.monthlyRevenue || [],
        topProducts: data.topProducts || [],
        recentOrders: data.recentOrders || [],
      });
    } catch (err) {
      console.error("Error fetching analytics:", err);
      toast.error("Failed to load analytics data");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analytics...</p>
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
                  Sales Analytics
                </h1>
                <p className="text-gray-600">
                  View sales reports and performance metrics
                </p>
              </div>
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{analytics.totalRevenue.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  0% from last month
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Total Orders
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.totalOrders}
                </p>
                <p className="text-sm text-gray-500 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  0% from last month
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.totalUsers}
                </p>
                <p className="text-sm text-gray-500 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  0% from last month
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Package className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Total Products
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.totalProducts}
                </p>
                <p className="text-sm text-gray-500 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />0 new this month
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts and Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 mb-8">
          {/* Revenue Chart */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
              Monthly Revenue
            </h3>
            <div className="space-y-3 sm:space-y-4">
              {analytics.monthlyRevenue.length > 0 ? (
                analytics.monthlyRevenue.map((item) => {
                  const maxRevenue = Math.max(...analytics.monthlyRevenue.map(m => m.revenue), 1);
                  const percentage = (item.revenue / maxRevenue) * 100;
                  return (
                    <div
                      key={item.month}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                    >
                      <span className="text-xs sm:text-sm text-gray-600 min-w-[60px]">{item.month}</span>
                      <div className="flex items-center space-x-2 flex-1">
                        <div className="flex-1 sm:w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-xs sm:text-sm font-medium text-gray-900 min-w-[80px] text-right">
                          ₹{item.revenue.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No revenue data available</p>
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
              Top Selling Products
            </h3>
            <div className="space-y-3 sm:space-y-4">
              {analytics.topProducts.length > 0 ? (
                analytics.topProducts.map((product, index) => (
                  <div
                    key={product.name}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                      <span className="text-xs sm:text-sm font-medium text-gray-900 flex-shrink-0">
                        #{index + 1}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-600 truncate">
                        {product.name}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {product.sales} sales
                      </div>
                      <div className="text-xs sm:text-sm text-gray-500">
                        ₹{product.revenue.toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No product data available</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
              Recent Orders
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analytics.recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.customer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ₹{order.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          order.status === "Delivered"
                            ? "bg-green-100 text-green-800"
                            : order.status === "Processing"
                            ? "bg-blue-100 text-blue-800"
                            : order.status === "Shipped"
                            ? "bg-purple-100 text-purple-800"
                            : order.status === "No data"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Average Order Value
                </p>
                <p className="text-2xl font-bold text-gray-900">₹0</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Orders This Month
                </p>
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Growth Rate</p>
                <p className="text-2xl font-bold text-gray-900">0%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalyticsPage;
