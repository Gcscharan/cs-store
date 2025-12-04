import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { logout } from "../store/slices/authSlice";
import {
  Truck,
  Package,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  LogOut,
  Phone,
  Calendar,
} from "lucide-react";

interface Order {
  _id: string;
  orderNumber?: string;
  customerName: string;
  deliveryAddress: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  updatedAt?: string;
  assignedDeliveryBoy: string;
  // Optional fields that might be missing
  address?: {
    addressLine: string;
    city: string;
    pincode: string;
    state: string;
  };
  items?: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  userId?: {
    name: string;
    phone: string;
  };
}

interface DeliveryBoy {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  availability: string;
}

const DeliveryDashboard: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { tokens, isAuthenticated, user } = useSelector(
    (state: RootState) => state.auth
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveryBoy, setDeliveryBoy] = useState<DeliveryBoy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [_activeTab, _setActiveTab] = useState("home");

  // Check authentication and role
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "delivery") {
      navigate("/login");
      return;
    }
    fetchOrders();
  }, [isAuthenticated, user, navigate]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      console.log(
        "Fetching delivery orders with token:",
        tokens.accessToken.substring(0, 20) + "..."
      );

      const response = await fetch("/api/delivery/orders", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      console.log("API response status:", response.status);

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.error("Failed to parse error response:", parseError);
          throw new Error(
            `API error: ${response.status} - ${response.statusText}`
          );
        }

        console.error("API error response:", errorData);

        if (response.status === 401 || response.status === 403) {
          console.log("Authentication failed, redirecting to login");
          localStorage.removeItem("auth");
          window.location.href = "/login";
          return;
        }

        if (response.status === 500) {
          throw new Error(
            errorData.message ||
              "Failed to load orders. Please try again later."
          );
        }

        throw new Error(
          `Failed to fetch orders: ${
            errorData.message || errorData.error || response.statusText
          }`
        );
      }

      const data = await response.json();
      console.log("API response data:", data);

      // Handle the new API response format
      const orders = data.orders || [];
      console.log("Processed orders:", orders);

      setOrders(orders);
      setDeliveryBoy(data.deliveryBoy);
    } catch (err) {
      console.error("Full API error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load orders. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      setIsUpdating(orderId);
      setError(null);

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`/api/delivery/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update order status");
      }

      // Update the order in local state
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order._id === orderId
            ? {
                ...order,
                status: status,
                updatedAt: new Date().toISOString(),
              }
            : order
        )
      );
    } catch (err) {
      console.error("Error updating order status:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update order status"
      );
    } finally {
      setIsUpdating(null);
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "assigned":
        return "bg-blue-100 text-blue-800";
      case "picked_up":
        return "bg-purple-100 text-purple-800";
      case "in_transit":
        return "bg-orange-100 text-orange-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4" />;
      case "assigned":
        return <Package className="h-4 w-4" />;
      case "picked_up":
        return <Truck className="h-4 w-4" />;
      case "in_transit":
        return <Truck className="h-4 w-4" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4" />;
      case "cancelled":
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const canUpdateStatus = (currentStatus: string, newStatus: string) => {
    const statusFlow = {
      assigned: ["picked_up"],
      picked_up: ["in_transit"],
      in_transit: ["delivered"],
    };
    return (
      statusFlow[currentStatus as keyof typeof statusFlow]?.includes(
        newStatus
      ) || false
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Delivery Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  Manage your assigned orders
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {deliveryBoy && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {deliveryBoy.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {deliveryBoy.vehicleType} • {deliveryBoy.availability}
                  </p>
                </div>
              )}
              <button
                onClick={() => navigate("/delivery-profile")}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <User className="h-4 w-4" />
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Total Orders
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {orders.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Pending</p>
                <p className="text-2xl font-bold text-gray-900">
                  {orders.filter((o) => o.status === "assigned").length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Truck className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">In Transit</p>
                <p className="text-2xl font-bold text-gray-900">
                  {orders.filter((o) => o.status === "in_transit").length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Delivered</p>
                <p className="text-2xl font-bold text-gray-900">
                  {orders.filter((o) => o.status === "delivered").length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Orders */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Assigned Orders
            </h2>
          </div>

          {error ? (
            <div className="text-center py-12">
              <div className="text-red-500 text-lg font-medium mb-2">
                Error Loading Orders
              </div>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchOrders}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No delivery orders assigned yet.
              </h3>
              <p className="text-gray-600">
                You don't have any orders assigned to you at the moment.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {orders.map((order) => (
                <div key={order._id} className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          Order #{order.orderNumber || order._id.slice(-6)}
                        </h3>
                        <span
                          className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            order.status
                          )}`}
                        >
                          {getStatusIcon(order.status)}
                          <span className="ml-1">
                            {order.status.replace("_", " ").toUpperCase()}
                          </span>
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">
                            Customer
                          </p>
                          <div className="flex items-center text-sm text-gray-900">
                            <User className="h-4 w-4 text-gray-400 mr-2" />
                            {order.customerName ||
                              order.userId?.name ||
                              "Unknown Customer"}
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <Phone className="h-4 w-4 text-gray-400 mr-2" />
                            {order.userId?.phone ||
                              order.assignedDeliveryBoy ||
                              "N/A"}
                          </div>
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-500 mb-1">
                            Delivery Address
                          </p>
                          <div className="flex items-start text-sm text-gray-900">
                            <MapPin className="h-4 w-4 text-gray-400 mr-2 mt-0.5" />
                            <div>
                              {order.deliveryAddress ? (
                                <p>{order.deliveryAddress}</p>
                              ) : order.address ? (
                                <>
                                  <p>{order.address.addressLine}</p>
                                  <p>
                                    {order.address.city}, {order.address.state}{" "}
                                    - {order.address.pincode}
                                  </p>
                                </>
                              ) : (
                                <p>Address not specified</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {order.items && order.items.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-500 mb-2">
                            Items ({order.items.length})
                          </p>
                          <div className="space-y-1">
                            {order.items.map((item, index) => (
                              <div
                                key={index}
                                className="flex justify-between text-sm text-gray-600"
                              >
                                <span>
                                  {item.name} x {item.qty}
                                </span>
                                <span>₹{item.price * item.qty}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        Created:{" "}
                        {new Date(order.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="mt-4 lg:mt-0 lg:ml-6">
                      <div className="text-right mb-4">
                        <p className="text-2xl font-bold text-gray-900">
                          ₹{order.totalAmount || 0}
                        </p>
                      </div>

                      <div className="space-y-2">
                        {canUpdateStatus(order.status, "picked_up") && (
                          <button
                            onClick={() =>
                              updateOrderStatus(order._id, "picked_up")
                            }
                            disabled={isUpdating === order._id}
                            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isUpdating === order._id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <Package className="h-4 w-4" />
                            )}
                            Mark as Picked Up
                          </button>
                        )}

                        {canUpdateStatus(order.status, "in_transit") && (
                          <button
                            onClick={() =>
                              updateOrderStatus(order._id, "in_transit")
                            }
                            disabled={isUpdating === order._id}
                            className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isUpdating === order._id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <Truck className="h-4 w-4" />
                            )}
                            Mark as In Transit
                          </button>
                        )}

                        {canUpdateStatus(order.status, "delivered") && (
                          <button
                            onClick={() =>
                              updateOrderStatus(order._id, "delivered")
                            }
                            disabled={isUpdating === order._id}
                            className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isUpdating === order._id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                            Mark as Delivered
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryDashboard;
