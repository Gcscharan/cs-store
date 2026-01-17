import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import toast from "react-hot-toast";
import { useOrderWebSocket } from "../hooks/useOrderWebSocket";
import {
  Search,
  ArrowLeft,
  ShoppingCart,
  DollarSign,
  Calendar,
  User,
  Package,
  Clock,
  CheckCircle,
  Trash2,
  AlertTriangle,
} from "lucide-react";

function canonicalizeOrderStatus(raw: string): string {
  const v = String(raw || "").trim();
  if (!v) return "";
  const upper = v.toUpperCase();
  if (upper === "PENDING" || upper === "PENDING_PAYMENT") return "CREATED";
  if (upper === "OUT_FOR_DELIVERY") return "IN_TRANSIT";
  return upper;
}

interface Order {
  _id: string;
  orderNumber?: string;
  userId: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    productId?: string | {
      _id: string;
      name: string;
      price: number;
      images?: string[];
    };
    product?: {
      _id: string;
      name: string;
      price: number;
      images?: string[];
    };
    name?: string;
    price: number;
    qty?: number;
    quantity?: number;
  }>;
  totalAmount: number;
  status?: string;
  orderStatus?: string;
  paymentMethod?: string;
  paymentStatus: string;
  paymentReceivedAt?: string;
  deliveryBoyId?: {
    _id: string;
    name: string;
    phone: string;
  } | string;
  address?: {
    label?: string;
    addressLine?: string;
    city: string;
    state: string;
    pincode?: string;
  };
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  createdAt: string;
  updatedAt: string;
}

const AdminOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { tokens, isAuthenticated, user, loading } = useSelector(
    (state: RootState) => state.auth
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState("");
  const [alsoDeleteRoutes, setAlsoDeleteRoutes] = useState(true);

  // Check authentication
  useEffect(() => {
    if (loading) {
      return;
    }

    const isAdmin = !!(user?.isAdmin || user?.role === "admin");
    if (!isAuthenticated || !isAdmin) {
      navigate("/login", { replace: true });
      return;
    }
    fetchOrders();
  }, [loading, isAuthenticated, user, navigate]);

  const handleClusterOrders = () => {
    navigate("/admin/routes/preview");
  };

  const handleRecentClusters = () => {
    navigate("/admin/routes/recent");
  };

  const purgeOrders = async () => {
    if (purgeConfirmText !== "DELETE_ALL_ORDERS") {
      toast.error("You must type DELETE_ALL_ORDERS exactly.");
      return;
    }

    try {
      setIsProcessing(true);
      const response = await fetch("/api/admin/orders/purge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify({ confirm: purgeConfirmText, alsoDeleteRoutes }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).message || (data as any).error || "Failed to purge orders");
      }

      toast.success(
        `Deleted ${(data as any).deletedOrders} orders${alsoDeleteRoutes ? ` and ${(data as any).deletedRoutes} routes` : ""}`
      );
      setShowPurgeModal(false);
      setPurgeConfirmText("");
      fetchOrders(); // Refresh list
    } catch (error: any) {
      console.error("Purge orders error:", error);
      toast.error(error.message || "Failed to purge orders");
    } finally {
      setIsProcessing(false);
    }
  };

  // Real-time order status updates via WebSocket
  const handleOrderStatusChanged = useCallback((payload: any) => {
    console.log("🔄 [Admin UI] Received order status update:", payload);
    
    // Update the order in local state
    setOrders(prevOrders => 
      prevOrders.map(order => {
        if (order._id === payload.orderId) {
          return {
            ...order,
            orderStatus: payload.to,
            status: payload.to,
            updatedAt: payload.timestamp,
          };
        }
        return order;
      })
    );

    // Show toast notification
    toast.success(
      `Order #${payload.orderId.substring(0, 8)} status changed to ${payload.to}`,
      { duration: 3000 }
    );
  }, []);

  useOrderWebSocket({
    userId: user?.id,
    userRole: user?.isAdmin ? 'admin' : 'customer',
    onOrderStatusChanged: handleOrderStatusChanged,
    enabled: isAuthenticated && user?.isAdmin,
  });

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/admin/orders", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }

      const data = await response.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Failed to load orders. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  const packOrder = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setIsProcessing(true);
      const response = await fetch(`/api/admin/orders/${order._id}/pack`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).message || (data as any).error || "Failed to pack order");
      }

      toast.success((data as any).message || "Order packed");
      if ((data as any).order) {
        setOrders((prevOrders) =>
          prevOrders.map((o) => (o._id === (data as any).order._id ? { ...(data as any).order } : o))
        );
      } else {
        fetchOrders();
      }
    } catch (error: any) {
      console.error("Pack order error:", error);
      toast.error(error.message || "Failed to pack order");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptClick = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrder(order);
    setShowAcceptModal(true);
  };

  const handleDeclineClick = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedOrder(order);
    setShowDeclineModal(true);
  };

  const confirmAccept = async () => {
    if (!selectedOrder) return;

    try {
      setIsProcessing(true);
      const response = await fetch(`/api/admin/orders/${selectedOrder._id}/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).message || (data as any).error || "Failed to confirm order");
      }

      toast.success((data as any).message || "Order confirmed");
      
      // Update the local orders state immediately if order data is returned
      if ((data as any).order) {
        setOrders(prevOrders => 
          prevOrders.map(order => 
            order._id === (data as any).order._id ? { ...(data as any).order } : order
          )
        );
      }
      
      setShowAcceptModal(false);
      setSelectedOrder(null);
    } catch (error: any) {
      console.error("Accept order error:", error);
      toast.error(error.message || "Failed to accept order");
      setIsProcessing(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDecline = async () => {
    if (!selectedOrder) return;

    try {
      setIsProcessing(true);
      const response = await fetch(`/api/orders/${selectedOrder._id}/cancel`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("You do not have permission to cancel this order");
        }
        if (response.status === 409) {
          throw new Error("Order cannot be cancelled in its current state");
        }
        throw new Error((data as any).message || (data as any).error || "Failed to cancel order");
      }

      toast.success((data as any).message || "Order cancelled");
      setShowDeclineModal(false);
      setSelectedOrder(null);
      if ((data as any).order) {
        setOrders(prevOrders =>
          prevOrders.map(o => (o._id === (data as any).order._id ? { ...(data as any).order } : o))
        );
      } else {
        fetchOrders();
      }
    } catch (error: any) {
      console.error("Decline order error:", error);
      toast.error(error.message || "Failed to decline order");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.userId?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.userId?.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      order._id.toLowerCase().includes(searchQuery.toLowerCase());
    const status = canonicalizeOrderStatus(order.status || order.orderStatus || "");
    const matchesStatus = !selectedStatus || status === canonicalizeOrderStatus(selectedStatus);
    return matchesSearch && matchesStatus;
  });

  const statuses = [
    ...new Set(
      orders
        .map((o) => canonicalizeOrderStatus(o.status || o.orderStatus || ""))
        .filter(Boolean)
    ),
  ];
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => {
    const status = canonicalizeOrderStatus(o.status || o.orderStatus || "");
    return status === "CREATED" || status === "CONFIRMED";
  }).length;
  const completedOrders = orders.filter((o) => {
    const status = canonicalizeOrderStatus(o.status || o.orderStatus || "");
    return status === "DELIVERED";
  }).length;
  const totalRevenue = orders.reduce(
    (sum, order) => sum + order.totalAmount,
    0
  );

  const mapDatabaseStatusToUserFriendly = (status: string): string => {
    const canonical = canonicalizeOrderStatus(status);
    const mapping: { [key: string]: string } = {
      // Map backend enum to display labels (no semantic transformation)
      created: "Created",
      pending: "Created",
      confirmed: "Confirmed",
      packed: "Packed",
      out_for_delivery: "Out for Delivery",
      delivered: "Delivered",
      failed: "Failed",
      returned: "Returned",
      cancelled: "Cancelled",
      // Legacy statuses (for backward compatibility)
      assigned: "Assigned",
      picked_up: "Picked Up",
      in_transit: "In Transit",
      arrived: "Arrived",
    };
    return mapping[canonical.toLowerCase()] || canonical || status;
  };

  const getStatusBadgeColor = (status: string) => {
    const canonical = canonicalizeOrderStatus(status).toLowerCase();
    switch (canonical) {
      case "created":
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "packed":
        return "bg-indigo-100 text-indigo-800";
      case "out_for_delivery":
        return "bg-purple-100 text-purple-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-orange-100 text-orange-800";
      case "returned":
        return "bg-pink-100 text-pink-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      // Legacy statuses
      case "assigned":
        return "bg-indigo-100 text-indigo-800";
      case "picked_up":
      case "in_transit":
        return "bg-purple-100 text-purple-800";
      case "arrived":
        return "bg-teal-100 text-teal-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    const canonical = canonicalizeOrderStatus(status).toLowerCase();
    switch (canonical) {
      case "pending":
      case "created":
        return <Clock className="h-4 w-4" />;
      case "confirmed":
      case "packed":
      case "assigned":
      case "picked_up":
      case "in_transit":
      case "out_for_delivery":
      case "arrived":
        return <Package className="h-4 w-4" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <ShoppingCart className="h-4 w-4" />;
    }
  };

  const formatPaymentInfo = (order: Order) => {
    const method = order.paymentMethod || "cod";
    const status = order.paymentStatus || "pending";
    
    if (status === "paid" && order.paymentReceivedAt) {
      if (method === "cod") {
        return `Paid via UPI on ${new Date(order.paymentReceivedAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      } else {
        return `Paid via Razorpay on ${new Date(order.paymentReceivedAt || order.createdAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      }
    } else if (status === "paid") {
      return method === "cod" ? "Paid via UPI" : "Paid via Razorpay";
    } else {
      return "Payment Pending";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <button
              onClick={() => navigate("/admin")}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Orders Management
              </h1>
              <p className="text-gray-600">View and manage all orders</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
              />
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </option>
              ))}
            </select>

            <button
              onClick={handleClusterOrders}
              title="Preview route clusters (no changes until you assign)"
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <span className="text-base">🔁</span>
              Cluster Orders
            </button>

            <button
              onClick={handleRecentClusters}
              title="Monitor recently assigned delivery clusters"
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Recent Clusters
            </button>

            <button
              onClick={() => setShowPurgeModal(true)}
              title="Delete all orders (requires confirmation)"
              className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-red-600 text-white hover:bg-red-700"
            >
              <Trash2 className="h-4 w-4" />
              Delete Orders
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                  {totalOrders}
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
                  {pendingOrders}
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
                <p className="text-sm font-medium text-gray-500">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {completedOrders}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">
                  Total Revenue
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{totalRevenue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {error ? (
            <div className="text-center py-12">
              <div className="text-red-500 text-lg font-medium mb-2">
                Error Loading Orders
              </div>
              <p className="text-gray-600 mb-4">{error}</p>
              <div className="space-x-3">
                <button
                  onClick={fetchOrders}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Try Again
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem("auth");
                    window.location.href = "/login";
                  }}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Login Again
                </button>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Orders Found
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery || selectedStatus
                  ? "No orders match your current filters."
                  : "No orders available."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delivery Boy
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order) => (
                    <tr 
                      key={order._id} 
                      onClick={() => navigate(`/admin/orders/${order._id}`)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          #{order.orderNumber || order._id.substring(0, 8)}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {order._id.substring(0, 12)}...
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="h-4 w-4 text-gray-600" />
                            </div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {order.userId?.name || 'Unknown User'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {order.userId?.email || 'No email'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {order.items.length} item
                          {order.items.length !== 1 ? "s" : ""}
                        </div>
                        <div className="text-sm text-gray-500">
                          {(() => {
                            const firstItem = order.items[0];
                            const productName = firstItem?.name || 
                                              (typeof firstItem?.productId === 'object' ? firstItem.productId?.name : null) ||
                                              firstItem?.product?.name || 
                                              "Product";
                            return `${productName}${order.items.length > 1 ? ` +${order.items.length - 1} more` : ""}`;
                          })()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 text-gray-400 mr-1" />₹
                          {order.totalAmount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(order.status || order.orderStatus || "pending")}
                          <span
                            className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                              order.status || order.orderStatus || "pending"
                            )}`}
                          >
                            {mapDatabaseStatusToUserFriendly(order.status || order.orderStatus || "pending")}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="max-w-32">
                          {order.deliveryBoyId ? (
                            // Delivery boy is assigned
                            <div onClick={(e) => e.stopPropagation()}>
                              {typeof order.deliveryBoyId === 'object' && order.deliveryBoyId.name ? (
                                // Show populated delivery boy details
                                <>
                                  <p className="text-xs font-medium text-gray-900 mb-1">
                                    {order.deliveryBoyId.name}
                                  </p>
                                  <p className="text-xs text-gray-500 mb-2">
                                    {order.deliveryBoyId.phone || 'No phone'}
                                  </p>
                                </>
                              ) : (
                                // Show "Assigned" if we only have ID
                                <p className="text-xs font-medium text-gray-900 mb-2">Assigned</p>
                              )}
                            </div>
                          ) : (
                            // No delivery boy assigned yet
                            <div onClick={(e) => e.stopPropagation()}>
                              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                                Unassigned
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="max-w-32">
                          <p className="text-xs font-medium text-gray-900 mb-1">
                            {order.paymentStatus === "paid" ? "Paid" : "Pending"}
                          </p>
                          <p className="text-xs text-gray-500 break-words">
                            {formatPaymentInfo(order)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                          {new Date(order.createdAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {(() => {
                          const canonical = canonicalizeOrderStatus(order.orderStatus || order.status || "");

                          const canConfirm = canonical === "CREATED";
                          const canPack = canonical === "CONFIRMED";
                          const canCancel = ["CREATED", "CONFIRMED", "PACKED"].includes(canonical);

                          if (!canConfirm && !canPack && !canCancel) {
                            return <span className="text-gray-400 text-xs">—</span>;
                          }

                          return (
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              {canConfirm && (
                                <button
                                  onClick={(e) => handleAcceptClick(order, e)}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                >
                                  Confirm
                                </button>
                              )}

                              {canPack && (
                                <button
                                  onClick={(e) => packOrder(order, e)}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                  Pack
                                </button>
                              )}

                              {canCancel && (
                                <button
                                  onClick={(e) => handleDeclineClick(order, e)}
                                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Accept Confirmation Modal */}
        {showAcceptModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Confirm Order
              </h3>
              <p className="text-gray-600 mb-6">
                Confirm order #{selectedOrder.orderNumber || selectedOrder._id.substring(0, 8)} to start processing?
                <br />
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowAcceptModal(false);
                    setSelectedOrder(null);
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAccept}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
                >
                  {isProcessing ? "Processing..." : "Confirm Accept"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Decline Confirmation Modal */}
        {showDeclineModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Cancel Order
              </h3>
              <p className="text-gray-600 mb-4">
                Cancel order #{selectedOrder.orderNumber || selectedOrder._id.substring(0, 8)}?
                <br />
                <span className="text-sm text-gray-500 mt-1 block">
                  This action cannot be undone and inventory will be restored.
                </span>
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowDeclineModal(false);
                    setSelectedOrder(null);
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDecline}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
                >
                  {isProcessing ? "Processing..." : "Confirm Cancel"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Purge Orders Confirmation Modal */}
        {showPurgeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-6 w-6 text-red-600 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete All Orders
                </h3>
              </div>
              <p className="text-gray-600 mb-4">
                This will permanently delete all orders{alsoDeleteRoutes ? " and persisted routes" : ""}. This action cannot be undone.
              </p>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={alsoDeleteRoutes}
                    onChange={(e) => setAlsoDeleteRoutes(e.target.checked)}
                    className="mr-2"
                  />
                  Also delete persisted routes
                </label>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <code className="bg-gray-100 px-1 rounded">DELETE_ALL_ORDERS</code> to confirm:
                </label>
                <input
                  type="text"
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  placeholder="DELETE_ALL_ORDERS"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowPurgeModal(false);
                    setPurgeConfirmText("");
                  }}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={purgeOrders}
                  disabled={isProcessing || purgeConfirmText !== "DELETE_ALL_ORDERS"}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50"
                >
                  {isProcessing ? "Deleting..." : "Delete All Orders"}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminOrdersPage;
