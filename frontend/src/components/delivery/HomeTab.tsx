import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Package,
  MapPin,
  User,
  DollarSign,
  AlertTriangle,
} from "lucide-react";

interface AssignedOrder {
  _id: string;
  orderNumber?: string;
  customerName: string;
  deliveryAddress: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  assignedDeliveryBoy: string;
  address?: {
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
  };
  items?: Array<{
    product: {
      name: string;
    };
    quantity: number;
  }>;
}

interface HomeTabProps {
  onStatusUpdate: (isOnline: boolean) => void;
  onOrderAction: (orderId: string, action: "accept" | "decline") => void;
}

const HomeTab: React.FC<HomeTabProps> = ({ onStatusUpdate, onOrderAction }) => {
  const { user, tokens } = useSelector((state: RootState) => state.auth);
  const [assignedOrders, setAssignedOrders] = useState<AssignedOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssignedOrders();
  }, []);

  const fetchAssignedOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch("http://localhost:5001/api/delivery/orders", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          console.log("Authentication failed, redirecting to login");
          localStorage.removeItem("auth");
          window.location.href = "/login";
          return;
        }

        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch assigned orders");
      }

      const data = await response.json();
      setAssignedOrders(data.orders || []);
    } catch (err) {
      console.error("Error fetching assigned orders:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load assigned orders"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOrderAction = async (
    orderId: string,
    action: "accept" | "decline"
  ) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(
        `http://localhost:5001/api/delivery/orders/${orderId}/${action}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} order`);
      }

      // Remove the order from the list after action
      setAssignedOrders((prev) =>
        prev.filter((order) => order._id !== orderId)
      );
    } catch (err) {
      console.error(`Error ${action}ing order:`, err);
      setError(
        err instanceof Error ? err.message : `Failed to ${action} order`
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4 pb-20">
      {/* Today's Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl p-6 shadow-lg mb-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Today's Progress
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="p-3 bg-green-100 rounded-xl w-fit mx-auto mb-2">
              <DollarSign className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">₹0</p>
            <p className="text-sm text-gray-600">Earnings</p>
          </div>
          <div className="text-center">
            <div className="p-3 bg-purple-100 rounded-xl w-fit mx-auto mb-2">
              <Package className="h-6 w-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">0</p>
            <p className="text-sm text-gray-600">Orders</p>
          </div>
        </div>
      </motion.div>

      {/* Assigned Orders Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl shadow-lg p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2 text-blue-600" />
            New Deliveries
          </h3>
          <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
            {assignedOrders.length} Available
          </span>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
            <p className="text-gray-600">Loading deliveries...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-3" />
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        ) : assignedOrders.length === 0 ? (
          <div className="text-center py-12">
            <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
              <Package className="h-8 w-8 text-gray-400" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              No deliveries yet
            </h4>
            <p className="text-gray-600">
              Stay online to receive new delivery requests
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignedOrders.map((order, index) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 bg-gradient-to-r from-blue-50 to-purple-50"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="font-bold text-gray-900 text-lg">
                      Order #{order.orderNumber || order._id.slice(-6)}
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      ₹{order.totalAmount || 0}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                    <p className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-gray-700">
                    <User className="h-4 w-4 mr-3 text-blue-600" />
                    <span className="font-medium">
                      {order.customerName || "Unknown Customer"}
                    </span>
                  </div>
                  <div className="flex items-center text-sm text-gray-700">
                    <MapPin className="h-4 w-4 mr-3 text-red-600" />
                    <span className="truncate">
                      {order.deliveryAddress || "Address not specified"}
                    </span>
                  </div>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => handleOrderAction(order._id, "accept")}
                    className="flex-1 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-semibold shadow-lg"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Accept
                  </button>
                  <button
                    onClick={() => handleOrderAction(order._id, "decline")}
                    className="flex-1 flex items-center justify-center px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-200 font-semibold shadow-lg"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Decline
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default HomeTab;
