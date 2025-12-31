import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { motion } from "framer-motion";
import { toast } from "react-hot-toast";
import {
  CheckCircle,
  XCircle,
  Package,
  MapPin,
  User,
  DollarSign,
  AlertTriangle,
  Navigation,
  Phone,
  CheckSquare,
} from "lucide-react";
import { io, Socket } from "socket.io-client";

interface Order {
  _id: string;
  userId: {
    name: string;
    phone: string;
  };
  deliveryBoyId?: string; // ID of assigned delivery partner
  items: Array<{
    name: string;
    qty: number;
    price: number;
  }>;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  paymentReceivedAt?: string;
  orderStatus: string;
  deliveryStatus: string;
  address: {
    label: string;
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
    lat: number;
    lng: number;
  };
  deliveryOtp?: string;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryInfo {
  id: string;
  name: string;
  availability: string;
  earnings: number;
}

interface HomeTabProps {
  onStatusUpdate?: (isOnline: string) => void;
  onOrderAction?: (orderId: string, action: "accept" | "decline") => void;
}

const EnhancedHomeTab: React.FC<HomeTabProps> = () => {
  const { user, tokens } = useSelector((state: RootState) => state.auth);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [otpInput, setOtpInput] = useState<{ [key: string]: string }>({});
  const [_uploadingProof, _setUploadingProof] = useState<{ [key: string]: boolean }>({});
  const [_arrivedTimestamp, _setArrivedTimestamp] = useState<{ [key: string]: number }>({});
  const [resendTimer, setResendTimer] = useState<{ [key: string]: number }>({});
  const [monitoringPayments, setMonitoringPayments] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchOrders();

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  // Timer countdown for resend OTP
  useEffect(() => {
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((orderId) => {
          if (updated[orderId] > 0) {
            updated[orderId] -= 1;
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Connect socket after deliveryInfo is available
  useEffect(() => {
    if (deliveryInfo && !socket) {
      connectSocket();
    }
  }, [deliveryInfo]);

  // Automatic payment monitoring for COD orders
  useEffect(() => {
    if (!activeOrders || activeOrders.length === 0) return;

    const codOrdersWithQR = activeOrders.filter(
      order => 
        order.paymentMethod === "cod" && 
        order.paymentStatus !== "paid" && 
        (order.orderStatus === "arrived" || order.orderStatus === "in_transit")
    );

    if (codOrdersWithQR.length === 0) return;

    const monitorPaymentStatus = async (orderId: string) => {
      try {
        if (!tokens?.accessToken) return;

        const response = await fetch(`http://localhost:5001/api/orders/${orderId}/payment-status`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.paymentStatus === "paid") {
            // Payment detected - automatically complete the order
            setMonitoringPayments(prev => ({ ...prev, [orderId]: false }));
            await autoCompleteDelivery(orderId);
          }
        }
      } catch (error) {
        console.error("Payment monitoring error:", error);
      }
    };

    // Start monitoring for each COD order
    codOrdersWithQR.forEach(order => {
      if (!monitoringPayments[order._id]) {
        setMonitoringPayments(prev => ({ ...prev, [order._id]: true }));
        
        // Check every 3 seconds
        const interval = setInterval(() => {
          monitorPaymentStatus(order._id);
        }, 3000);

        // Cleanup interval after 30 minutes (failsafe)
        setTimeout(() => {
          clearInterval(interval);
          setMonitoringPayments(prev => ({ ...prev, [order._id]: false }));
        }, 30 * 60 * 1000);

        // Store interval reference for cleanup
        return () => clearInterval(interval);
      }
    });
  }, [activeOrders, tokens, monitoringPayments]);

  const autoCompleteDelivery = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) return;

      const response = await fetch(`http://localhost:5001/api/delivery/orders/${orderId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({}), // Empty body for COD orders
      });

      if (!response.ok) {
        throw new Error("Failed to auto-complete delivery");
      }

      const data = await response.json();
      toast.success(`Payment Received – Order Completed Successfully! Earned ₹${data.earnings || 0}`, {
        duration: 4000,
        icon: '🎉'
      });
      
      // Refresh orders to reflect the completion
      fetchOrders();
    } catch (error) {
      console.error("Auto-completion error:", error);
      toast.error("Payment detected but failed to complete delivery automatically");
    }
  };

  const connectSocket = () => {
    const newSocket = io("http://localhost:5001", {
      auth: {
        token: tokens?.accessToken,
      },
    });

    newSocket.on("connect", () => {
      console.log("Socket connected");
      if (deliveryInfo) {
        const roomName = `driver_${deliveryInfo.id}`;
        console.log(`[SOCKET] Joining room: ${roomName}`);
        newSocket.emit("join_room", {
          room: roomName,
          userId: user?.id,
          userRole: "delivery",
        });
        console.log(`[SOCKET] Join room emitted for ${roomName}`);
      } else {
        console.warn("[SOCKET] deliveryInfo not available yet");
      }
    });

    newSocket.on("order:assigned", (data: any) => {
      console.log("[SOCKET] New order assigned:", data);
      toast.success("New order assigned to you!");
      // Refresh orders list to show the new assignment
      fetchOrders();
    });

    newSocket.on("refresh_orders", () => {
      console.log("[SOCKET] Received refresh_orders signal");
      // Force refresh of orders list
      fetchOrders();
    });

    newSocket.on("order:cancelled", (data: any) => {
      console.log("[SOCKET] Order cancelled:", data);
      toast.error("Order was cancelled");
      fetchOrders();
    });

    newSocket.on("order:statusUpdate", (data: any) => {
      console.log("[SOCKET] Order status update:", data);
      // Refresh orders to show updated status
      fetchOrders();
    });

    setSocket(newSocket);
  };

  const fetchOrders = async () => {
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
          window.location.href = "/delivery/login";
          return;
        }

        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch orders");
      }

      const data = await response.json();
      console.log(`[FETCH_ORDERS] Received ${data.orders?.length || 0} orders from API`);
      
      setDeliveryInfo(data.deliveryBoy);
      
      // Backend only returns orders assigned to this delivery partner
      // Separate available (needs acceptance) and active (assigned & in-progress) orders
      const orders = data.orders || [];
      const available = orders.filter((o: Order) => o.orderStatus === "created");
      const active = orders.filter((o: Order) => 
        ["assigned", "picked_up", "in_transit", "arrived"].includes(o.orderStatus)
      );
      
      console.log(`[FETCH_ORDERS] Available: ${available.length}, Active: ${active.length}`);
      active.forEach((o: Order) => {
        console.log(`  - Order ${o._id}: ${o.orderStatus}/${o.deliveryStatus}`);
      });
      
      setAvailableOrders(available);
      setActiveOrders(active);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load orders"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`http://localhost:5001/api/delivery/orders/${orderId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to accept order");
      }

      const data = await response.json();
      toast.success("Order accepted! OTP: " + data.order.deliveryOtp);
      fetchOrders();
    } catch (err) {
      console.error("Error accepting order:", err);
      toast.error(err instanceof Error ? err.message : "Failed to accept order");
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`http://localhost:5001/api/delivery/orders/${orderId}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ reason: "Not available" }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reject order");
      }

      toast.success("Order rejected");
      fetchOrders();
    } catch (err) {
      console.error("Error rejecting order:", err);
      toast.error(err instanceof Error ? err.message : "Failed to reject order");
    }
  };

  const handlePickup = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      // Step 1: Fetch fresh order state to avoid race conditions
      toast.loading("Verifying order status...", { id: "pickup-loading" });
      
      const orderCheckResponse = await fetch(`http://localhost:5001/api/delivery/orders`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!orderCheckResponse.ok) {
        throw new Error("Failed to fetch order details");
      }

      const orderData = await orderCheckResponse.json();
      const freshOrder = orderData.orders?.find((o: Order) => o._id === orderId);

      if (!freshOrder) {
        toast.dismiss("pickup-loading");
        toast.error("Order not found or not assigned to you");
        fetchOrders();
        return;
      }

      // Step 2: Validate order status before attempting pickup
      if (freshOrder.deliveryStatus !== "assigned") {
        toast.dismiss("pickup-loading");
        toast.error(
          `Order is not ready for pickup. Current status: ${freshOrder.deliveryStatus}. Please refresh or wait.`
        );
        fetchOrders();
        return;
      }

      if (freshOrder.orderStatus !== "assigned") {
        toast.dismiss("pickup-loading");
        toast.error(
          `Order must be assigned before pickup. Current order status: ${freshOrder.orderStatus}`
        );
        fetchOrders();
        return;
      }

      // Step 3: Attempt pickup
      toast.dismiss("pickup-loading");
      toast.loading("Marking as picked up...", { id: "pickup-processing" });

      const response = await fetch(`http://localhost:5001/api/delivery/orders/${orderId}/pickup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.dismiss("pickup-processing");
        throw new Error(errorData.error || "Failed to mark as picked up");
      }

      toast.dismiss("pickup-processing");
      toast.success("✅ Pickup recorded successfully!");
      fetchOrders();
    } catch (err) {
      console.error("Error picking up order:", err);
      toast.error(err instanceof Error ? err.message : "Failed to pick up order");
    }
  };

  const handleStartDelivery = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`http://localhost:5001/api/delivery/orders/${orderId}/start-delivery`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start delivery");
      }

      toast.success("Delivery started - You're on the way!");
      fetchOrders();
    } catch (err) {
      console.error("Error starting delivery:", err);
      toast.error(err instanceof Error ? err.message : "Failed to start delivery");
    }
  };

  const markArrived = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`http://localhost:5001/api/delivery/orders/${orderId}/arrived`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to mark as arrived");
      }

      toast.success("Marked as arrived. OTP sent to customer!");
      _setArrivedTimestamp((prev: any) => ({ ...prev, [orderId]: Date.now() }));
      setResendTimer((prev) => ({ ...prev, [orderId]: 30 }));
      fetchOrders();
    } catch (err) {
      console.error("Error marking arrived:", err);
      toast.error(err instanceof Error ? err.message : "Failed to mark as arrived");
    }
  };

  const handleCompleteDelivery = async (orderId: string) => {
    try {
      // Find the order to check payment method
      const order = activeOrders.find(o => o._id === orderId);
      const isCOD = order?.paymentMethod === "cod";
      
      // For COD orders, skip OTP verification
      // For prepaid orders, require OTP
      const otp = otpInput[orderId];
      if (!isCOD && (!otp || otp.length !== 4)) {
        toast.error("Please enter valid 4-digit OTP");
        return;
      }

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      // Prepare request body based on payment method
      const requestBody = isCOD ? {} : { otp };

      const response = await fetch(`http://localhost:5001/api/delivery/orders/${orderId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to complete delivery");
      }

      const data = await response.json();
      toast.success(`Delivery completed! Earned ₹${data.earnings || 0}`);
      setOtpInput((prev) => ({ ...prev, [orderId]: "" }));
      fetchOrders();
    } catch (err) {
      console.error("Error completing delivery:", err);
      toast.error(err instanceof Error ? err.message : "Failed to complete delivery");
    }
  };

  const openNavigation = (lat: number, lng: number) => {
    // Validate coordinates exist and are not zero/null
    if (!lat || !lng || lat === 0 || lng === 0 || isNaN(lat) || isNaN(lng)) {
      toast.error("Address location not available. Please ask user to update address.");
      console.error("❌ Cannot navigate: Invalid coordinates", { lat, lng });
      return;
    }

    // Open Google Maps with GPS coordinates (like Swiggy/Zomato)
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank");
    toast.success("Opening navigation...");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4 pb-24">
      {/* Today's Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 shadow-xl mb-6 text-white"
      >
        <h3 className="text-lg font-semibold mb-4 opacity-90">Today's Progress</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <DollarSign className="h-6 w-6 mb-2" />
            <p className="text-2xl font-bold">₹{deliveryInfo?.earnings || 0}</p>
            <p className="text-sm opacity-80">Earnings</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
            <Package className="h-6 w-6 mb-2" />
            <p className="text-2xl font-bold">{activeOrders.length}</p>
            <p className="text-sm opacity-80">Active Orders</p>
          </div>
        </div>
      </motion.div>

      {/* Available Orders */}
      {availableOrders.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">New Requests</h3>
            <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-semibold">
              {availableOrders.length}
            </span>
          </div>

          <div className="space-y-4">
            {availableOrders.map((order) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="border-2 border-blue-200 rounded-xl p-4 bg-gradient-to-br from-blue-50 to-purple-50"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-lg text-gray-900">
                      Order #{order._id.slice(-6)}
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      ₹{order.totalAmount}
                    </p>
                  </div>
                  <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-semibold">
                    NEW
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm">
                    <User className="h-4 w-4 mr-2 text-blue-600" />
                    <span className="font-medium">{order.userId.name}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 mr-2 text-green-600" />
                    <span>{order.userId.phone}</span>
                  </div>
                  <div className="flex items-start text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-red-600 mt-0.5" />
                    <span className="flex-1">{order.address.addressLine}, {order.address.city}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => handleAcceptOrder(order._id)}
                    className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
                  >
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Accept
                  </button>
                  <button
                    onClick={() => handleRejectOrder(order._id)}
                    className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
                  >
                    <XCircle className="h-5 w-5 mr-2" />
                    Decline
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Active Deliveries */}
      {activeOrders.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <h3 className="text-lg font-bold text-gray-900 mb-4">Active Deliveries</h3>

          <div className="space-y-4">
            {activeOrders.map((order) => (
              <div
                key={order._id}
                className="border border-gray-200 rounded-xl p-4 bg-gray-50"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold text-lg">Order #{order._id.slice(-6)}</p>
                    <div className="flex items-center space-x-2">
                      <p className="text-xl font-bold text-green-600">₹{order.totalAmount}</p>
                      {order.paymentStatus === "paid" && (
                        <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full flex items-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          PAID ✅
                        </span>
                      )}
                    </div>
                    {order.paymentMethod === "cod" && (
                      <p className="text-sm text-gray-600 mt-1">
                        Payment: {order.paymentMethod.toUpperCase()}
                        {order.paymentReceivedAt && (
                          <span className="text-green-600 ml-2">
                            • Received {new Date(order.paymentReceivedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                    order.orderStatus === "assigned"
                      ? "bg-blue-100 text-blue-800"
                      : order.orderStatus === "picked_up"
                      ? "bg-purple-100 text-purple-800"
                      : order.orderStatus === "in_transit"
                      ? "bg-orange-100 text-orange-800"
                      : order.orderStatus === "arrived"
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-100 text-gray-800"
                  }`}>
                    {order.orderStatus.replace("_", " ").toUpperCase()}
                  </span>
                </div>

                {/* Delivery Progress */}
                <div className="mb-4">
                  <div className="flex items-center mb-2">
                    <div className={`flex-1 h-2 rounded-l-full ${
                      ["assigned", "picked_up", "in_transit", "delivered"].includes(order.orderStatus)
                        ? "bg-blue-600"
                        : "bg-gray-300"
                    }`}></div>
                    <div className={`flex-1 h-2 ${
                      ["picked_up", "in_transit", "delivered"].includes(order.orderStatus)
                        ? "bg-purple-600"
                        : "bg-gray-300"
                    }`}></div>
                    <div className={`flex-1 h-2 rounded-r-full ${
                      ["in_transit", "delivered"].includes(order.orderStatus)
                        ? "bg-orange-600"
                        : "bg-gray-300"
                    }`}></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className={order.orderStatus === "assigned" ? "font-bold text-blue-600" : ""}>Assigned</span>
                    <span className={order.orderStatus === "picked_up" ? "font-bold text-purple-600" : ""}>Picked Up</span>
                    <span className={order.orderStatus === "in_transit" ? "font-bold text-orange-600" : ""}>In Transit</span>
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm">
                    <User className="h-4 w-4 mr-2 text-blue-600" />
                    <span className="font-medium">{order.userId.name}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 mr-2 text-green-600" />
                    <a href={`tel:${order.userId.phone}`} className="text-blue-600 underline">
                      {order.userId.phone}
                    </a>
                  </div>
                  <div className="flex items-start text-sm">
                    <MapPin className="h-4 w-4 mr-2 text-red-600 mt-0.5" />
                    <span className="flex-1">{order.address.addressLine}, {order.address.city}</span>
                  </div>
                </div>

                {/* Navigation Button */}
                <button
                  onClick={() => openNavigation(order.address.lat, order.address.lng)}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold mb-3 flex items-center justify-center hover:bg-blue-700 transition-colors"
                >
                  <Navigation className="h-5 w-5 mr-2" />
                  Navigate to Location
                </button>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {order.orderStatus === "assigned" && (
                    <button
                      onClick={() => handlePickup(order._id)}
                      className="w-full py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors"
                    >
                      <CheckSquare className="h-5 w-5 inline mr-2" />
                      Mark as Picked Up
                    </button>
                  )}

                  {order.orderStatus === "picked_up" && (
                    <button
                      onClick={() => handleStartDelivery(order._id)}
                      className="w-full py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
                    >
                      <Navigation className="h-5 w-5 inline mr-2" />
                      Start Delivery
                    </button>
                  )}

                  {order.orderStatus === "in_transit" && (
                    <>
                      <button
                        onClick={() => markArrived(order._id)}
                        className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors mb-2"
                      >
                        <MapPin className="h-5 w-5 inline mr-2" />
                        Mark as Arrived
                      </button>
                    </>
                  )}

                  {(order.orderStatus === "in_transit" || order.orderStatus === "arrived") && (
                    <div className="space-y-2">
                      {/* OTP Input - Only for prepaid orders, not COD */}
                      {order.paymentMethod !== "cod" && (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm font-semibold text-yellow-800 mb-2">
                            Enter Customer OTP to Complete
                          </p>
                          <input
                            type="text"
                            maxLength={4}
                            placeholder="4-digit OTP"
                            value={otpInput[order._id] || ""}
                            onChange={(e) =>
                              setOtpInput((prev) => ({
                                ...prev,
                                [order._id]: e.target.value.replace(/\D/g, ""),
                              }))
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg text-center text-2xl font-bold tracking-widest"
                          />
                          
                          {/* Resend OTP Button - Only shown when order is arrived */}
                          {order.orderStatus === "arrived" && (
                            <div className="mt-3">
                              {resendTimer[order._id] > 0 ? (
                                <p className="text-xs text-gray-600 text-center">
                                  Resend OTP available in {resendTimer[order._id]} seconds
                                </p>
                              ) : (
                                <button
                                  onClick={() => markArrived(order._id)}
                                  className="w-full py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-semibold"
                                >
                                  Resend OTP
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* COD Completion Info - Only show when payment is received and ready to complete */}
                      {order.paymentMethod === "cod" && order.paymentStatus === "paid" && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm font-semibold text-blue-800 mb-1">
                            Cash on Delivery Order
                          </p>
                          <p className="text-xs text-blue-600">
                            Ready to complete - No OTP verification required
                          </p>
                        </div>
                      )}
                      
                      {/* Payment Received Info - Show for paid COD orders */}
                      {order.paymentMethod === "cod" && order.paymentStatus === "paid" && (
                        <div className="w-full py-3 bg-green-50 border border-green-200 text-green-800 rounded-lg font-semibold mb-2 flex items-center justify-center">
                          <CheckCircle className="h-5 w-5 inline mr-2" />
                          Payment Received ✅
                        </div>
                      )}
                      
                      {/* Complete Delivery Button */}
                      <button
                        onClick={() => handleCompleteDelivery(order._id)}
                        disabled={
                          (order.paymentMethod === "cod" && order.paymentStatus !== "paid") ||
                          (order.paymentMethod !== "cod" && (!otpInput[order._id] || otpInput[order._id].length !== 4))
                        }
                        className={`w-full py-3 rounded-lg font-semibold transition-all ${
                          (order.paymentMethod === "cod" && order.paymentStatus !== "paid") ||
                          (order.paymentMethod !== "cod" && (!otpInput[order._id] || otpInput[order._id].length !== 4))
                            ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                            : "bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg"
                        }`}
                      >
                        <CheckCircle className="h-5 w-5 inline mr-2" />
                        {order.paymentMethod !== "cod" && (!otpInput[order._id] || otpInput[order._id].length !== 4)
                          ? "Enter OTP First"
                          : "Complete Delivery"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ) : availableOrders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl shadow-lg p-12 text-center"
        >
          <div className="p-4 bg-gray-100 rounded-full w-fit mx-auto mb-4">
            <Package className="h-12 w-12 text-gray-400" />
          </div>
          <h4 className="text-xl font-bold text-gray-900 mb-2">No Active Orders</h4>
          <p className="text-gray-600">
            {deliveryInfo?.availability === "available"
              ? "Stay online to receive delivery requests"
              : "Go online to start receiving orders"}
          </p>
        </motion.div>
      ) : null}

      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-3" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

    </div>
  );
};

export default EnhancedHomeTab;
