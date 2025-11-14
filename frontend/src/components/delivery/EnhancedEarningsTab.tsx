import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { toast } from "react-hot-toast";
import {
  DollarSign,
  TrendingUp,
  Package,
  Calendar,
  Clock,
  Award,
  BarChart3,
} from "lucide-react";

interface EarningsData {
  total: number;
  deliveryFees: number;
  tips: number;
  completedOrders: number;
}

interface OrderRecord {
  _id: string;
  amount: number;
  deliveryFee: number;
  tip: number;
  createdAt: string;
  address: {
    city: string;
    pincode: string;
  };
}

interface DailyEarning {
  date: string;
  amount: number;
  orders: number;
}

const EnhancedEarningsTab: React.FC = () => {
  const { tokens } = useSelector((state: RootState) => state.auth);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [dailyEarnings, setDailyEarnings] = useState<DailyEarning[]>([]);
  const [timeRange, setTimeRange] = useState<"today" | "week" | "month" | "all">(
    "today"
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchEarnings();
  }, [timeRange]);

  const getDateRange = () => {
    const now = new Date();
    let from: Date | undefined;

    switch (timeRange) {
      case "today":
        from = new Date(now.setHours(0, 0, 0, 0));
        break;
      case "week":
        from = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        from = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        from = undefined;
    }

    return from ? from.toISOString() : undefined;
  };

  const fetchEarnings = async () => {
    try {
      setIsLoading(true);

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const from = getDateRange();
      const url = from
        ? `/api/delivery/earnings?from=${from}`
        : "/api/delivery/earnings";

      const response = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch earnings");
      }

      const data = await response.json();
      setEarnings(data.earnings);
      setOrders(data.orders || []);
      calculateDailyEarnings(data.orders || []);
    } catch (error: any) {
      console.error("Error fetching earnings:", error);
      toast.error(error.message || "Failed to load earnings");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDailyEarnings = (orderList: OrderRecord[]) => {
    const dailyMap: { [key: string]: { amount: number; orders: number } } = {};

    orderList.forEach((order) => {
      const date = new Date(order.createdAt).toLocaleDateString();
      if (!dailyMap[date]) {
        dailyMap[date] = { amount: 0, orders: 0 };
      }
      dailyMap[date].amount += order.deliveryFee + order.tip;
      dailyMap[date].orders += 1;
    });

    const daily = Object.entries(dailyMap)
      .map(([date, data]) => ({
        date,
        amount: data.amount,
        orders: data.orders,
      }))
      .sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      .slice(-7); // Last 7 days

    setDailyEarnings(daily);
  };

  const getAverageEarningsPerOrder = () => {
    if (!earnings || earnings.completedOrders === 0) return 0;
    return (earnings.deliveryFees + earnings.tips) / earnings.completedOrders;
  };

  const maxEarning = Math.max(...dailyEarnings.map((d) => d.amount), 1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4 pb-24">
      {/* Time Range Selector */}
      <div className="bg-white rounded-2xl shadow-lg p-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto">
          {(["today", "week", "month", "all"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                timeRange === range
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading earnings...</p>
        </div>
      ) : (
        <>
          {/* Total Earnings Card */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl shadow-xl p-6 mb-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm opacity-90 mb-1">Total Earnings</p>
                <p className="text-4xl font-bold">
                  ₹{earnings?.total.toLocaleString() || 0}
                </p>
              </div>
              <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                <DollarSign className="h-8 w-8" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm opacity-90">
              <TrendingUp className="h-4 w-4" />
              <span>
                {earnings?.completedOrders || 0} deliveries completed
              </span>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Package className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600">Delivery Fees</p>
                  <p className="text-xl font-bold text-gray-900">
                    ₹{earnings?.deliveryFees || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-purple-100 p-2 rounded-lg">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600">Tips Received</p>
                  <p className="text-xl font-bold text-gray-900">
                    ₹{earnings?.tips || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-green-100 p-2 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600">Avg per Order</p>
                  <p className="text-xl font-bold text-gray-900">
                    ₹{getAverageEarningsPerOrder().toFixed(0)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-orange-100 p-2 rounded-lg">
                  <Package className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600">Orders</p>
                  <p className="text-xl font-bold text-gray-900">
                    {earnings?.completedOrders || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Earnings Chart */}
          {dailyEarnings.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  Earnings Trend
                </h3>
              </div>

              <div className="space-y-3">
                {dailyEarnings.map((day, index) => (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{day.date}</span>
                      <span className="font-semibold text-gray-900">
                        ₹{day.amount.toFixed(0)}
                      </span>
                    </div>
                    <div className="relative h-8 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 flex items-center justify-end pr-3"
                        style={{ width: `${(day.amount / maxEarning) * 100}%` }}
                      >
                        <span className="text-xs text-white font-semibold">
                          {day.orders} orders
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Orders */}
          {orders.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  Recent Deliveries
                </h3>
              </div>

              <div className="space-y-3">
                {orders.slice(0, 10).map((order, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        Order #{order._id.slice(-6)}
                      </p>
                      <p className="text-sm text-gray-600">
                        {order.address.city} - {order.address.pincode}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">
                        ₹{order.deliveryFee + order.tip}
                      </p>
                      {order.tip > 0 && (
                        <p className="text-xs text-purple-600">
                          +₹{order.tip} tip
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {orders.length === 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Earnings Yet
              </h3>
              <p className="text-gray-600">
                Complete deliveries to start earning
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EnhancedEarningsTab;
