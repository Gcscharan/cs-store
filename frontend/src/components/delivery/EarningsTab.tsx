import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Calendar, Package, Clock } from "lucide-react";

const EarningsTab: React.FC = () => {
  const { tokens } = useSelector((state: RootState) => state.auth);
  const [earnings, setEarnings] = useState({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    total: 0,
  });
  const [recentEarnings, setRecentEarnings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEarnings();
  }, []);

  const fetchEarnings = async () => {
    try {
      setIsLoading(true);

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch("/api/delivery/earnings", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch earnings");
      }

      const data = await response.json();
      setEarnings(
        data.earnings || { today: 0, thisWeek: 0, thisMonth: 0, total: 0 }
      );
      setRecentEarnings(data.recentEarnings || []);
    } catch (err) {
      console.error("Error fetching earnings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 pb-20">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading earnings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      {/* Earnings Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="grid grid-cols-2 gap-4 mb-6"
      >
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{earnings.today}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Week</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{earnings.thisWeek}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{earnings.thisMonth}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{earnings.total}
              </p>
            </div>
            <Package className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </motion.div>

      {/* Recent Earnings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recent Earnings
        </h3>

        {recentEarnings.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No recent earnings</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentEarnings.map((earning: any, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center">
                  <Package className="h-5 w-5 text-blue-600 mr-3" />
                  <div>
                    <p className="font-medium text-gray-900">
                      Order #{earning.orderNumber}
                    </p>
                    <p className="text-sm text-gray-600 flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {new Date(earning.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className="font-semibold text-green-600">
                  +₹{earning.amount}
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default EarningsTab;
