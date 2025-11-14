import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import {
  ArrowLeft,
  User,
  Package,
  MapPin,
  Phone,
  Mail,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface OrderItem {
  productId?: {
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
  items: OrderItem[];
  totalAmount: number;
  status?: string;
  orderStatus?: string;
  paymentMethod?: string;
  paymentStatus: string;
  paymentReceivedAt?: string;
  address?: {
    name?: string;          // Recipient name
    phone?: string;         // Recipient phone
    label?: string;
    addressLine?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode?: string;
  };
  deliveryBoyId?: {
    _id: string;
    name: string;
    phone: string;
  };
  earnings?: {
    deliveryFee: number;
    tip: number;
    commission: number;
  };
  createdAt: string;
  updatedAt: string;
}

const AdminOrderDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const { tokens, isAuthenticated, user } = useSelector(
    (state: RootState) => state.auth
  );

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated || !user?.isAdmin) {
      navigate("/login");
      return;
    }
    if (orderId) {
      fetchOrderDetails();
    }
  }, [isAuthenticated, user, navigate, orderId]);

  const fetchOrderDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/orders`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch order details");
      }

      const data = await response.json();
      const foundOrder = data.orders.find((o: Order) => o._id === orderId);

      if (!foundOrder) {
        throw new Error("Order not found");
      }

      setOrder(foundOrder);
    } catch (err) {
      console.error("Error fetching order details:", err);
      setError("Failed to load order details. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Map database statuses to user-friendly names
  const mapDatabaseStatusToUserFriendly = (status: string): string => {
    const mapping: { [key: string]: string } = {
      created: "pending",
      assigned: "accepted",
      picked_up: "in_progress",
      in_transit: "in_progress",
      delivered: "completed",
      cancelled: "cancelled",
    };
    return mapping[status.toLowerCase()] || status;
  };

  // Get available status transitions based on current status
  const getAvailableStatusOptions = (currentStatus: string): { value: string; label: string; color: string }[] => {
    const dbStatus = currentStatus.toLowerCase();
    
    // Pending orders: Admin can ONLY Accept or Cancel
    if (dbStatus === "created" || dbStatus === "pending") {
      return [
        { value: "assigned", label: "Accept Order", color: "bg-green-600 hover:bg-green-700" },
        { value: "cancelled", label: "Cancel Order", color: "bg-red-600 hover:bg-red-700" },
      ];
    }
    
    // Once accepted or cancelled: No further admin actions
    // Delivery partner updates will happen via their own interface
    return [];
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;

    try {
      setIsUpdatingStatus(true);
      setError(null);

      const response = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update order status");
      }

      const data = await response.json();
      setOrder(data.order);
      setSuccessMessage("Order status updated successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
      
      // Refresh order details
      await fetchOrderDetails();
    } catch (err) {
      console.error("Error updating order status:", err);
      setError("Failed to update order status. Please try again.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    const mappedStatus = mapDatabaseStatusToUserFriendly(status);
    switch (mappedStatus.toLowerCase()) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "accepted":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "in_progress":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "completed":
        return "bg-green-100 text-green-800 border-green-300";
      case "cancelled":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getProductName = (item: OrderItem): string => {
    if (item.name) return item.name;
    if (typeof item.productId === "object" && item.productId?.name) {
      return item.productId.name;
    }
    if (item.product?.name) return item.product.name;
    return "Product";
  };

  const getProductPrice = (item: OrderItem): number => {
    return item.price;
  };

  const getProductQuantity = (item: OrderItem): number => {
    return item.qty || item.quantity || 1;
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
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-x-3">
            <button
              onClick={fetchOrderDetails}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate("/admin/orders")}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
            >
              Back to Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const currentStatus = order.status || order.orderStatus || "pending";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => navigate("/admin/orders")}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Orders
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Order #{order.orderNumber || order._id.substring(0, 8)}
              </h1>
              <p className="text-gray-600 mt-1">Order ID: {order._id}</p>
            </div>
            <span
              className={`px-4 py-2 text-sm font-semibold rounded-full border ${getStatusBadgeColor(
                currentStatus
              )}`}
            >
              {mapDatabaseStatusToUserFriendly(currentStatus).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            <span className="text-green-800">{successMessage}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-3" />
            <span className="text-red-800">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Order Items
              </h2>
              <div className="space-y-4">
                {order.items.map((item, index) => {
                  const productName = getProductName(item);
                  const price = getProductPrice(item);
                  const quantity = getProductQuantity(item);
                  const subtotal = price * quantity;

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between border-b border-gray-200 pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center flex-1">
                        <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center mr-4">
                          <Package className="h-8 w-8 text-gray-400" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {productName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            ₹{price.toLocaleString()} × {quantity}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900">
                          ₹{subtotal.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 pt-4 border-t border-gray-200 space-y-3">
                {/* Delivery Fee Breakdown */}
                {order.earnings && (
                  <>
                    <div className="flex justify-between items-center text-gray-700">
                      <span>Items Subtotal</span>
                      <span>
                        ₹{(order.totalAmount - (order.earnings.deliveryFee || 0)).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-gray-700">
                      <span className="flex items-center">
                        <Package className="h-4 w-4 mr-2 text-blue-500" />
                        Delivery Fee
                      </span>
                      <span>
                        {order.earnings.deliveryFee > 0 
                          ? `₹${order.earnings.deliveryFee.toLocaleString()}`
                          : <span className="text-green-600 font-semibold">FREE</span>
                        }
                      </span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                  <span className="text-lg font-bold text-gray-900">
                    Total Amount
                  </span>
                  <span className="text-2xl font-bold text-gray-900">
                    ₹{order.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Customer Details
              </h2>
              <div className="space-y-3">
                <div className="flex items-center">
                  <User className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    <p className="font-semibold text-gray-900">
                      {order.userId.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-gray-400 mr-3" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-semibold text-gray-900">
                      {order.userId.email}
                    </p>
                  </div>
                </div>
                {order.userId.phone && (
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="font-semibold text-gray-900">
                        {order.userId.phone}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery Address */}
            {order.address && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Delivery Address
                </h2>
                <div className="text-gray-700 space-y-2">
                  {order.address.name && (
                    <p className="font-semibold text-lg">{order.address.name}</p>
                  )}
                  {order.address.phone && (
                    <p className="text-gray-600">📱 {order.address.phone}</p>
                  )}
                  {order.address.label && (
                    <p className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium mt-1">
                      {order.address.label}
                    </p>
                  )}
                  {order.address.addressLine && (
                    <p className="mt-2">{order.address.addressLine}</p>
                  )}
                  {order.address.landmark && (
                    <p className="text-gray-600">Landmark: {order.address.landmark}</p>
                  )}
                  <p className="font-medium">
                    {order.address.city}, {order.address.state}
                  </p>
                  {order.address.pincode && (
                    <p className="text-gray-600">Pincode: {order.address.pincode}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Order Status Update */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Order Actions
              </h2>
              {(() => {
                const availableActions = getAvailableStatusOptions(currentStatus);
                
                if (availableActions.length === 0) {
                  return (
                    <div className="text-center py-6">
                      <CheckCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 text-sm">
                        {currentStatus === "delivered" || currentStatus === "completed"
                          ? "This order has been completed."
                          : currentStatus === "cancelled"
                          ? "This order has been cancelled."
                          : "Order has been accepted and assigned to delivery partner."}
                      </p>
                      <p className="text-gray-500 text-xs mt-2">
                        {currentStatus === "assigned" 
                          ? "Delivery partner will update the status."
                          : "No further changes will be made."}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {availableActions.map((action) => (
                      <button
                        key={action.value}
                        onClick={() => handleStatusUpdate(action.value)}
                        disabled={isUpdatingStatus}
                        className={`w-full text-white px-4 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors ${action.color}`}
                      >
                        {isUpdatingStatus ? (
                          <>
                            <Loader2 className="animate-spin h-5 w-5 mr-2" />
                            Processing...
                          </>
                        ) : (
                          action.label
                        )}
                      </button>
                    ))}
                    
                    {currentStatus !== "cancelled" && currentStatus !== "delivered" && (
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500 text-center">
                          {currentStatus === "created" || currentStatus === "pending"
                            ? "Accept to process the order or decline to cancel it."
                            : currentStatus === "assigned"
                            ? "Move to In Progress when delivery starts."
                            : "Mark as completed when delivery is done."}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Order Info */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Order Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">Payment Status</p>
                  <p className="font-semibold text-gray-900 capitalize mb-1">
                    {order.paymentStatus === "paid" ? "Paid" : "Pending"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatPaymentInfo(order)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Order Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(order.updatedAt).toLocaleString()}
                  </p>
                </div>
                {order.deliveryBoyId && typeof order.deliveryBoyId === 'object' && order.deliveryBoyId !== null && order.deliveryBoyId.name && (
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-500 mb-2">Delivery Boy</p>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="font-semibold text-gray-900">
                        {order.deliveryBoyId.name}
                      </p>
                      <p className="text-sm text-gray-600">
                        {order.deliveryBoyId.phone}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetailsPage;
