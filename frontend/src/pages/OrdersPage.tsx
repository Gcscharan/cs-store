import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { RootState } from "../store";
import { motion } from "framer-motion";
import {
  ShoppingCart,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";
import { getProductImage } from "../utils/image";

interface OrderItem {
  productId?: string | {
    _id?: string;
    name?: string;
    images?: string[];
    price?: number;
  };
  product?: {
    _id?: string;
    name?: string;
    imageUrl?: string;
    images?: string[];
    price?: number;
  };
  name?: string;
  price: number;
  qty?: number;
  quantity?: number;
}

interface Order {
  _id: string;
  orderNumber?: string;
  items: OrderItem[];
  totalAmount: number;
  status?: string;
  orderStatus?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentReceivedAt?: string;
  address?: {
    label?: string;
    addressLine?: string;
    city?: string;
    state?: string;
    pincode?: string;
    lat?: number;
    lng?: number;
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

const OrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { tokens, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("");

  useEffect(() => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    fetchOrders();
  }, [isAuthenticated]);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/orders", {
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

  // Map database status to user-friendly display
  const mapDatabaseStatusToUserFriendly = (dbStatus: string): string => {
    const mapping: { [key: string]: string } = {
      created: "Pending",
      pending: "Pending",
      assigned: "Processing",
      picked_up: "Shipped",
      in_transit: "Shipped",
      delivered: "Delivered",
      cancelled: "Cancelled",
    };
    return mapping[dbStatus.toLowerCase()] || dbStatus;
  };

  const filteredOrders = orders.filter((order) => {
    if (!selectedStatus) return true;
    const dbStatus = order.orderStatus || order.status || "";
    const friendlyStatus = mapDatabaseStatusToUserFriendly(dbStatus);
    return friendlyStatus.toLowerCase() === selectedStatus.toLowerCase();
  });

  const getStatusIcon = (status: string) => {
    const friendlyStatus = mapDatabaseStatusToUserFriendly(status);
    switch (friendlyStatus) {
      case "Pending":
        return <Clock className="h-5 w-5 text-yellow-600" />;
      case "Processing":
        return <Package className="h-5 w-5 text-blue-600" />;
      case "Shipped":
        return <Package className="h-5 w-5 text-purple-600" />;
      case "Delivered":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "Cancelled":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusBadgeColor = (status: string) => {
    const friendlyStatus = mapDatabaseStatusToUserFriendly(status);
    switch (friendlyStatus) {
      case "Pending":
        return "bg-yellow-100 text-yellow-800";
      case "Processing":
        return "bg-blue-100 text-blue-800";
      case "Shipped":
        return "bg-purple-100 text-purple-800";
      case "Delivered":
        return "bg-green-100 text-green-800";
      case "Cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatPaymentInfo = (order: Order) => {
    const method = order.paymentMethod || "cod";
    const status = order.paymentStatus || "pending";
    
    if (status === "paid" && order.paymentReceivedAt) {
      if (method === "cod") {
        return `Paid in cash on delivery on ${new Date(order.paymentReceivedAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      } else if (method === "upi") {
        return `Paid via UPI on ${new Date(order.paymentReceivedAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      } else {
        return `Paid on ${new Date(order.paymentReceivedAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      }
    } else if (status === "paid") {
      if (method === "cod") return "Paid in cash on delivery";
      if (method === "upi") return "Paid via UPI";
      return "Paid";
    } else {
      return "Payment Pending";
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Login Required
            </h2>
            <p className="text-gray-600 mb-6">
              Please log in to view your orders.
            </p>
          </div>
          <a
            href="/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Orders</h1>
          <p className="text-gray-600">Track and manage your order history</p>
        </div>

        {/* Status Filter */}
        <div className="mb-6">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Orders</option>
            <option value="Pending">Pending</option>
            <option value="Processing">Processing</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        {/* Orders List */}
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
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {selectedStatus
                ? "No orders with this status"
                : "No orders found"}
            </h3>
            <p className="text-gray-600 mb-6">
              {selectedStatus
                ? "Try selecting a different status or view all orders."
                : "You haven't placed any orders yet. Start shopping to see your orders here."}
            </p>
            {selectedStatus && (
              <button
                onClick={() => setSelectedStatus("")}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
              >
                View All Orders
              </button>
            )}
            {!selectedStatus && (
              <a
                href="/products"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                Start Shopping
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                {/* Cancellation Message */}
                {mapDatabaseStatusToUserFriendly(order.orderStatus || order.status || "") === "Cancelled" && (
                  <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-600 font-semibold text-center">
                      Order has been cancelled by the seller
                    </p>
                  </div>
                )}

                {/* Order Items */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Items ({order.items.length})
                  </h4>
                  <div className="space-y-2">
                    {order.items.map((item, index) => {
                      // Handle both populated and unpopulated productId
                      const populatedProduct = typeof item.productId === 'object' ? item.productId : null;
                      const productName = item.name || populatedProduct?.name || item.product?.name || "Product";
                      const productPrice = item.price || populatedProduct?.price || item.product?.price || 0;
                      const quantity = item.qty || item.quantity || 1;
                      
                      // Get image URL - check populated product first, then fallback to product name
                      let imageUrl = "/placeholder-product.png";
                      if (populatedProduct?.images && populatedProduct.images.length > 0) {
                        const firstImage = populatedProduct.images[0] as any;
                        if (typeof firstImage === 'object' && firstImage !== null) {
                          imageUrl = firstImage.thumb || firstImage.full;
                        }
                      } else if (item.product?.images && item.product.images.length > 0) {
                        const firstImage = item.product.images[0] as any;
                        if (typeof firstImage === 'object' && firstImage !== null) {
                          imageUrl = firstImage.thumb || firstImage.full;
                        }
                      } else if (item.product?.imageUrl) {
                        imageUrl = item.product.imageUrl;
                      } else if (productName && productName !== "Product") {
                        // Use product image mapper as fallback
                        imageUrl = getProductImage(populatedProduct || item.product);
                      }
                      
                      // Replace via.placeholder.com URLs with inline SVG
                      if (imageUrl && imageUrl.includes("via.placeholder.com")) {
                        imageUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZTVlN2ViIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5Y2EzYWYiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+";
                      }
                      
                      // Get product ID for navigation
                      const productId = (typeof item.productId === 'object' ? item.productId?._id : item.productId) || 
                                       item.product?._id || 
                                       (item.product as any)?.id;
                      
                      return (
                        <div
                          key={index}
                          className="flex items-center space-x-3 py-2 cursor-pointer hover:bg-gray-50 rounded-lg transition-colors"
                          onClick={() => productId && navigate(`/product/${productId}`)}
                        >
                          <img
                            src={imageUrl}
                            alt={productName}
                            className="w-12 h-12 rounded-lg object-cover"
                            onError={(e) => {
                              // Final fallback to placeholder
                              if ((e.target as HTMLImageElement).src !== "/placeholder-product.png") {
                                (e.target as HTMLImageElement).src = "/placeholder-product.png";
                              }
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {productName}
                            </p>
                            <p className="text-sm text-gray-500">
                              Qty: {quantity} × ₹{productPrice}
                            </p>
                          </div>
                          <p className="text-sm font-medium text-gray-900">
                            ₹{(quantity * productPrice).toLocaleString()}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Order Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">
                      Total Amount
                    </h4>
                    <p className="text-lg font-semibold text-gray-900">
                      ₹{order.totalAmount.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">
                      Payment Status
                    </h4>
                    <p className="text-sm text-gray-900 mb-1">
                      {order.paymentStatus === "paid" ? "Paid" : "Pending"}
                    </p>
                    <p className="text-xs text-gray-600">
                      {formatPaymentInfo(order)}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">
                      Delivery Address
                    </h4>
                    <p className="text-sm text-gray-900">
                      {order.address?.addressLine || order.address?.label || order.shippingAddress?.street || "N/A"}, {" "}
                      {order.address?.city || order.shippingAddress?.city || "N/A"}
                    </p>
                  </div>
                </div>

                {/* Order Status & Total */}
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(order.orderStatus || order.status || "")}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(order.orderStatus || order.status || "")}`}>
                      {mapDatabaseStatusToUserFriendly(order.orderStatus || order.status || "")}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-lg font-bold text-gray-900">₹{order.totalAmount.toLocaleString()}</p>
                  </div>
                </div>

                {/* Order Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200">
                  <div className="flex space-x-3">
                    {mapDatabaseStatusToUserFriendly(order.orderStatus || order.status || "") !== "Cancelled" && (
                      <button 
                        onClick={() => navigate(`/orders/${order._id}`)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </button>
                    )}
                    {mapDatabaseStatusToUserFriendly(order.orderStatus || order.status || "") === "Delivered" && (
                      <button className="text-green-600 hover:text-green-800 text-sm font-medium">
                        Reorder
                      </button>
                    )}
                  </div>
                  <div className="mt-2 sm:mt-0">
                    <p className="text-xs text-gray-500">
                      Last updated:{" "}
                      {new Date(order.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
