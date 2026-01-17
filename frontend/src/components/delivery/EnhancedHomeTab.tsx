import React, { useState, useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../store";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import api from "../../store/api";
import {
  CheckCircle,
  XCircle,
  Package,
  MapPin,
  User,
  DollarSign,
  Smartphone,
  AlertTriangle,
  Navigation,
  Phone,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { getApiOrigin, toApiUrl } from "../../config/runtime";
import { navigateToDestination } from "../../utils/navigation";
import { getStatusBadgeConfig, getPaymentStatusText, getPaymentStatusColor } from "../../utils/deliveryStatusUtils";
import { StatsCardSkeleton, ActiveOrderCardSkeleton } from "./DeliverySkeletons";
import useLiveLocationTracker from "../../hooks/useLiveLocationTracker";

interface Order {
  _id: string;
  userId: {
    name: string;
    phone: string;
    email?: string;
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
  arrivedAt?: string;
  deliveryOtpExpiresAt?: string;
  deliveryOtpGeneratedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  failureReasonCode?: string;
  failureNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryInfo {
  id: string;
  name: string;
  availability: string;
  earnings: number;
  completedOrdersCount?: number;
}

type CodCollection = {
  _id: string;
  orderId: string;
  mode: "CASH" | "UPI";
  amount: number;
  currency: string;
  collectedAt: string;
  idempotencyKey: string;
};

interface HomeTabProps {
  onStatusUpdate?: (isOnline: string) => void;
  onOrderAction?: (orderId: string, action: "accept" | "decline") => void;
}

const DeliverySummary: React.FC<{
  activeCount: number;
  completedCount: number;
}> = ({ activeCount, completedCount }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Delivery Summary</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-700/80">ACTIVE ORDERS</p>
            <Package className="h-5 w-5 text-blue-700" />
          </div>
          <p className="mt-3 text-4xl font-extrabold text-blue-800 tabular-nums">{activeCount}</p>
          <p className="mt-1 text-xs text-blue-700/70">In Progress</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-700/80">COMPLETED ORDERS</p>
            <CheckCircle className="h-5 w-5 text-emerald-700" />
          </div>
          <p className="mt-3 text-4xl font-extrabold text-emerald-800 tabular-nums">{completedCount}</p>
          <p className="mt-1 text-xs text-emerald-700/70">Lifetime Delivered</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-gray-600">Your current workload and delivery history</p>
    </motion.div>
  );
};

const TodaysPerformance: React.FC<{ earnings: number }> = ({ earnings }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-lg p-6 mb-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Today’s Performance</h3>
      </div>

      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-5 text-white shadow-xl">
        <p className="text-xs font-semibold opacity-90">TODAY’S EARNINGS</p>
        <p className="mt-3 text-3xl font-extrabold tabular-nums">₹ {Number(earnings || 0).toLocaleString("en-IN")}</p>
        <p className="mt-1 text-xs opacity-80">(Completed today)</p>
      </div>
    </motion.div>
  );
};

const EnhancedHomeTab: React.FC<HomeTabProps> = () => {
  const { user, tokens } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [deliveryInfo, setDeliveryInfo] = useState<DeliveryInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState<{ [key: string]: boolean }>({});
  const [navigationStage, setNavigationStage] = useState<{ [key: string]: "fetching_location" | "opening_maps" | null }>({});
  const [error, setError] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [otpInput, setOtpInput] = useState<{ [key: string]: string }>({});
  const [_uploadingProof, _setUploadingProof] = useState<{ [key: string]: boolean }>({});
  const [_arrivedTimestamp, _setArrivedTimestamp] = useState<{ [key: string]: number }>({});
  const [resendTimer, setResendTimer] = useState<{ [key: string]: number }>({});
  const [deliveryAttempted, setDeliveryAttempted] = useState<{ [key: string]: boolean }>({});
  const [monitoringPayments, setMonitoringPayments] = useState<{ [key: string]: boolean }>({});
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [retryCount, setRetryCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullToRefreshY, setPullToRefreshY] = useState(0);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelNotes, setCancelNotes] = useState<string>("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [codCollectionByOrderId, setCodCollectionByOrderId] = useState<Record<string, CodCollection | null | undefined>>(
    {}
  );
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectOrderId, setCollectOrderId] = useState<string | null>(null);
  const [collectMode, setCollectMode] = useState<"CASH" | "UPI" | "">("");
  const [collectSubmitting, setCollectSubmitting] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const maxRetries = 3;
  const ENABLE_COD_AUTO_COMPLETE = false;

  const apiBase = getApiOrigin();

  const getOrCreateIdempotencyKey = (orderId: string): string => {
    const key = `cod_collection_idem_${orderId}`;
    const existing = String(localStorage.getItem(key) || "").trim();
    if (existing) return existing;
    const created = `${orderId}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(key, created);
    return created;
  };

  const fetchCodCollection = async (orderId: string): Promise<CodCollection | null> => {
    if (!tokens?.accessToken) return null;

    const response = await fetch(toApiUrl(`/delivery/orders/${orderId}/cod-collection`), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {
      }
      throw new Error(errorData?.error || errorData?.message || "Failed to fetch COD collection");
    }

    const data = await response.json();
    const raw = data?.codCollection;
    if (!raw) return null;
    return {
      _id: String(raw._id),
      orderId: String(raw.orderId),
      mode: String(raw.mode).toUpperCase() === "UPI" ? "UPI" : "CASH",
      amount: Number(raw.amount),
      currency: String(raw.currency || "INR"),
      collectedAt: String(raw.collectedAt),
      idempotencyKey: String(raw.idempotencyKey || ""),
    };
  };

  const refreshCodCollectionsForActiveOrders = async (orders: Order[]) => {
    const candidates = orders.filter((o) => {
      const method = String(o.paymentMethod || "").toLowerCase();
      const status = String(o.orderStatus || "").toLowerCase();
      const deliveryStatusLower = String(o.deliveryStatus || "").toLowerCase();
      if (status === "delivered" || deliveryStatusLower === "delivered") return false;
      if (status === "cancelled" || deliveryStatusLower === "cancelled") return false;
      if (method !== "cod") return false;
      if (!o.arrivedAt) return false;
      return true;
    });

    if (candidates.length === 0) return;

    setCodCollectionByOrderId((prev) => {
      const next = { ...prev };
      for (const o of candidates) {
        if (!(o._id in next)) next[o._id] = undefined;
      }
      return next;
    });

    await Promise.all(
      candidates.map(async (o) => {
        try {
          const coll = await fetchCodCollection(o._id);
          setCodCollectionByOrderId((prev) => ({ ...prev, [o._id]: coll }));
        } catch (e) {
          console.error("Failed to fetch COD collection:", e);
        }
      })
    );
  };

  const openCollectModal = (orderId: string, mode: "CASH" | "UPI") => {
    setCollectOrderId(orderId);
    setCollectMode(mode);
    setCollectModalOpen(true);
  };

  const closeCollectModal = () => {
    if (collectSubmitting) return;
    setCollectModalOpen(false);
    setCollectOrderId(null);
    setCollectMode("");
  };

  const confirmCollectPayment = async () => {
    try {
      if (!collectOrderId || !collectMode) return;
      if (!tokens?.accessToken) throw new Error("No authentication token available");

      setCollectSubmitting(true);
      const idempotencyKey = getOrCreateIdempotencyKey(collectOrderId);

      const response = await fetch(toApiUrl(`/delivery/orders/${collectOrderId}/cod-collection`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({
          mode: collectMode,
          idempotencyKey,
        }),
      });

      let payload: any = {};
      try {
        payload = await response.json();
      } catch {
      }

      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || "Failed to record COD collection");
      }

      const raw = payload?.codCollection;
      if (raw) {
        const coll: CodCollection = {
          _id: String(raw._id),
          orderId: String(raw.orderId),
          mode: String(raw.mode).toUpperCase() === "UPI" ? "UPI" : "CASH",
          amount: Number(raw.amount),
          currency: String(raw.currency || "INR"),
          collectedAt: String(raw.collectedAt),
          idempotencyKey: String(raw.idempotencyKey || ""),
        };
        setCodCollectionByOrderId((prev) => ({ ...prev, [collectOrderId]: coll }));
      }

      toast.success("Payment recorded. You can now send OTP.", { duration: 3500 });
      closeCollectModal();
      fetchOrders();
    } catch (err) {
      console.error("COD collection error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to record payment", { duration: 5000 });
    } finally {
      setCollectSubmitting(false);
    }
  };

  const isOnDuty = deliveryInfo?.availability === "available";
  const { activeRouteId, isTracking } = useLiveLocationTracker({
    accessToken: tokens?.accessToken,
    isOnDuty,
    enabled: user?.role === "delivery",
  });

  useEffect(() => {
    console.log("[LiveLocation] gate", {
      isOnDuty,
      activeRouteId,
      isTracking,
    });
  }, [activeRouteId, isOnDuty, isTracking]);

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
    if (!ENABLE_COD_AUTO_COMPLETE) return;
    if (!activeOrders || activeOrders.length === 0) return;

    const codOrdersWithQR = activeOrders.filter(
      (order) =>
        order.paymentMethod === "cod" &&
        String(order.paymentStatus || "").toLowerCase() !== "paid" &&
        (order.orderStatus === "arrived" || order.orderStatus === "in_transit")
    );

    if (codOrdersWithQR.length === 0) return;

    const monitorPaymentStatus = async (orderId: string) => {
      try {
        if (!tokens?.accessToken) return;

        const response = await fetch(toApiUrl(`/orders/${orderId}/payment-status`), {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (String(data.paymentStatus || "").toLowerCase() === "paid") {
            // Payment detected - automatically complete the order
            setMonitoringPayments((prev) => ({ ...prev, [orderId]: false }));
            await autoCompleteDelivery(orderId);
          }
        }
      } catch (error) {
        console.error("Payment monitoring error:", error);
      }
    };

    // Start monitoring for each COD order
    codOrdersWithQR.forEach((order) => {
      if (!monitoringPayments[order._id]) {
        setMonitoringPayments((prev) => ({ ...prev, [order._id]: true }));

        // Check every 3 seconds
        const interval = setInterval(() => {
          monitorPaymentStatus(order._id);
        }, 3000);

        // Cleanup interval after 30 minutes (failsafe)
        setTimeout(() => {
          clearInterval(interval);
          setMonitoringPayments((prev) => ({ ...prev, [order._id]: false }));
        }, 30 * 60 * 1000);

        // Store interval reference for cleanup
        return () => clearInterval(interval);
      }
    });
  }, [activeOrders, tokens, monitoringPayments]);

  const autoCompleteDelivery = async (orderId: string) => {
    try {
      throw new Error("Auto-complete is disabled. Delivery must be completed via OTP verification.");
      if (!tokens?.accessToken) return;

      const response = await fetch(toApiUrl(`/delivery/orders/${orderId}/complete`), {
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
        icon: "🎉",
      });

      // Refresh orders to reflect the completion
      fetchOrders();
    } catch (error) {
      console.error("Auto-completion error:", error);
      toast.error("Payment detected but failed to complete delivery automatically");
    }
  };

  const openCancelModal = (orderId: string) => {
    setCancelOrderId(orderId);
    setCancelReason("");
    setCancelNotes("");
    setCancelModalOpen(true);
  };

  const closeCancelModal = () => {
    if (cancelSubmitting) return;
    setCancelModalOpen(false);
    setCancelOrderId(null);
    setCancelReason("");
    setCancelNotes("");
  };

  const confirmCancellation = async () => {
    try {
      if (!cancelOrderId) return;
      if (!cancelReason) {
        toast.error("Please select a cancellation reason");
        return;
      }
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const notes = String(cancelNotes || "").trim().slice(0, 200);
      setCancelSubmitting(true);

      const response = await fetch(toApiUrl(`/delivery/orders/${cancelOrderId}/attempt`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({
          status: "FAILED",
          failureReason: cancelReason,
          ...(notes ? { failureNotes: notes } : {}),
        }),
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
        }
        throw new Error(errorData?.error || errorData?.message || "Cancellation failed");
      }

      toast.success("Order cancelled successfully", { duration: 3500 });
      closeCancelModal();
      fetchOrders();
    } catch (err) {
      console.error("Cancellation error:", err);
      toast.error(err instanceof Error ? err.message : "Cancellation failed", { duration: 5000 });
    } finally {
      setCancelSubmitting(false);
    }
  };

  const connectSocket = () => {
    const newSocket = io(getApiOrigin() || "/", {
      auth: {
        token: tokens?.accessToken,
      },
    });

    newSocket.on("connect", () => {
      console.log("Socket connected");
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

    newSocket.on("notification:refresh", (data: any) => {
      console.log("[SOCKET] notification:refresh", data);
      dispatch(api.util.invalidateTags(["Notification", "NotificationUnreadCount"]));
    });

    setSocket(newSocket);
  };

  const fetchOrders = async (isRetry = false) => {
    try {
      if (!isRetry) {
        setIsLoading(true);
      }
      setError(null);
      setGateError(null);

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(toApiUrl(`/delivery/orders`), {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log("Authentication failed, redirecting to login");
          localStorage.removeItem("auth");
          window.location.href = "/delivery/login";
          return;
        }

        if (response.status === 403) {
          let errorMessage = "Access denied";
          try {
            const errorData = await response.json();
            errorMessage = errorData?.error || errorData?.message || errorMessage;
          } catch {
          }
          setGateError(errorMessage);
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
      const available = orders.filter((o: Order) =>
        String(o.orderStatus || "").toLowerCase() === "created"
      );

      // Filter active orders - only show orders that are actually assigned to this delivery partner
      // Check both orderStatus and deliveryStatus, and ensure deliveryBoyId matches if present
      const active = orders.filter((o: Order) => {
        const s = String(o.orderStatus || "").toLowerCase();
        const deliveryStatus = String(o.deliveryStatus || "").toLowerCase();

        // Skip orders that are explicitly unassigned
        if (deliveryStatus === "unassigned") {
          return false;
        }

        // Only include orders in active states
        return [
          "confirmed",
          "packed",
          "out_for_delivery",
          "assigned",
          "picked_up",
          "in_transit",
          "arrived",
          "cancelled",
        ].includes(s);
      });

      console.log(`[FETCH_ORDERS] Available: ${available.length}, Active: ${active.length}`);
      active.forEach((o: Order) => {
        console.log(`  - Order ${o._id}: ${o.orderStatus}/${o.deliveryStatus}`);
      });

      setAvailableOrders(available);
      setActiveOrders(active);
      void refreshCodCollectionsForActiveOrders(active);
      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      console.error("Error fetching orders:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load orders";

      setError(errorMessage);

      // Auto-retry with exponential backoff
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          fetchOrders(true);
        }, delay);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;

    if (deltaY > 0 && window.scrollY === 0) {
      setPullToRefreshY(Math.min(deltaY, 80));
    }
  };

  const handleTouchEnd = () => {
    if (pullToRefreshY > 50 && !isRefreshing) {
      setIsRefreshing(true);
      fetchOrders();
    }
    setPullToRefreshY(0);
    touchStartY.current = null;
  };

  const toggleOrderExpansion = (orderId: string) => {
    setExpandedOrders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orderId)) {
        newSet.delete(orderId);
      } else {
        newSet.add(orderId);
      }
      return newSet;
    });
  };

  if (gateError) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-xl mx-auto">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account not ready</h2>
          <p className="text-gray-700 mb-4">{gateError}</p>
          <button
            onClick={() => {
              void fetchOrders();
            }}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const handleAcceptOrder = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(toApiUrl(`/delivery/orders/${orderId}/accept`), {
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
      toast.success("Order accepted! OTP: " + data.order.deliveryOtp, { duration: 3000 });
      fetchOrders();
    } catch (err) {
      console.error("Error accepting order:", err);
      toast.error(err instanceof Error ? err.message : "Failed to accept order", { duration: 5000 });
    }
  };

  const handleRejectOrder = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(toApiUrl(`/delivery/orders/${orderId}/reject`), {
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

      toast.success("Order rejected", { duration: 3000 });
      fetchOrders();
    } catch (err) {
      console.error("Error rejecting order:", err);
      toast.error(err instanceof Error ? err.message : "Failed to reject order", { duration: 5000 });
    }
  };

  const handlePickup = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      toast.loading("Marking as picked up...", { id: "pickup-processing" });

      const response = await fetch(toApiUrl(`/delivery/orders/${orderId}/pickup`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
        }

        toast.dismiss("pickup-processing");

        // Handle state conflicts - order may have been reassigned or status changed
        if (response.status === 409 || response.status === 403) {
          const errorMessage = errorData?.error || errorData?.message || 
            (response.status === 403 ? "You are not assigned to this order" : "Order state conflict");
          
          toast.error(errorMessage, { duration: 5000 });
          
          // Auto-refresh to get latest order state
          setTimeout(() => {
          fetchOrders();
          }, 1000);
          return;
        }

        throw new Error(errorData?.error || errorData?.message || "Failed to mark as picked up");
      }

      toast.dismiss("pickup-processing");
      toast.success("✅ Pickup recorded successfully!", { duration: 3000 });
      fetchOrders();
    } catch (err) {
      console.error("Error picking up order:", err);
      toast.error(err instanceof Error ? err.message : "Failed to pick up order", { duration: 5000 });
    }
  };

  const handleStartDelivery = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(toApiUrl(`/delivery/orders/${orderId}/start-delivery`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
        }

        // Handle state conflicts - order may have been reassigned or status changed
        if (response.status === 409 || response.status === 403) {
          const errorMessage = errorData?.error || errorData?.message || 
            (response.status === 403 ? "You are not assigned to this order" : "Cannot start delivery from current state");
          
          toast.error(errorMessage, { duration: 5000 });
          
          // Auto-refresh to get latest order state
          setTimeout(() => {
          fetchOrders();
          }, 1000);
          return;
        }

        throw new Error(errorData?.error || errorData?.message || "Failed to start delivery");
      }

      toast.success("Delivery started - You're on the way!", { duration: 3000 });
      fetchOrders();
    } catch (err) {
      console.error("Error starting delivery:", err);
      toast.error(err instanceof Error ? err.message : "Failed to start delivery", { duration: 5000 });
    }
  };

  const markArrived = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`${apiBase}/api/delivery/orders/${orderId}/arrived`, {
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

      toast.success("Arrival recorded.", { duration: 3000 });
      _setArrivedTimestamp((prev: any) => ({ ...prev, [orderId]: Date.now() }));
      fetchOrders();
    } catch (err) {
      console.error("Error marking arrived:", err);
      toast.error(err instanceof Error ? err.message : "Failed to mark as arrived", { duration: 5000 });
    }
  };

  const startDeliveryAttempt = async (orderId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(
        `${apiBase}/api/delivery/orders/${orderId}/deliver`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
        }
        const msg = errorData?.error || errorData?.message || "Failed to start delivery attempt";
        throw new Error(msg);
      }

      toast.success("OTP sent to customer. Ask customer for OTP to complete delivery.", { duration: 5000 });
      setDeliveryAttempted((prev) => ({ ...prev, [orderId]: true }));
      setResendTimer((prev) => ({ ...prev, [orderId]: 30 }));
      setExpandedOrders((prev) => {
        const next = new Set(prev);
        next.add(orderId);
        return next;
      });
      fetchOrders();
    } catch (err) {
      console.error("Error starting delivery attempt:", err);
      toast.error(err instanceof Error ? err.message : "Failed to start delivery attempt", { duration: 5000 });
    }
  };

  const verifyOtpAndDeliver = async (orderId: string) => {
    try {
      const otp = String(otpInput[orderId] || "").trim();
      if (!otp || otp.length !== 4) {
        toast.error("Please enter valid 4-digit OTP");
        return;
      }

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(
        `${apiBase}/api/delivery/orders/${orderId}/verify-otp`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
          body: JSON.stringify({ otp }),
        }
      );

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
        }
        throw new Error(errorData?.error || errorData?.message || "OTP verification failed");
      }

      toast.success("Delivery completed!", { duration: 4000 });
      setOtpInput((prev) => ({ ...prev, [orderId]: "" }));
      setDeliveryAttempted((prev) => ({ ...prev, [orderId]: false }));
      fetchOrders();
    } catch (err) {
      console.error("Error verifying OTP:", err);
      toast.error(err instanceof Error ? err.message : "OTP verification failed", { duration: 5000 });
    }
  };

  const openNavigation = async (order: Order) => {
    if (isNavigating[order._id]) return;

    setIsNavigating((prev) => ({ ...prev, [order._id]: true }));
    setNavigationStage((prev) => ({ ...prev, [order._id]: "fetching_location" }));

    try {
      const label = `Drop: ${order.userId?.name || order._id}`;
      const result = await navigateToDestination({
        destLat: Number(order.address?.lat),
        destLng: Number(order.address?.lng),
        label,
        onStageChange: (stage) => {
          setNavigationStage((prev) => ({ ...prev, [order._id]: stage }));
        },
      });

      if (result.openedWith === "destination_only") {
        toast.error("Unable to fetch your current location. Opening destination only.");
      }
    } catch (err) {
      console.error("Navigation error:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to open navigation"
      );
    } finally {
      setIsNavigating((prev) => ({ ...prev, [order._id]: false }));
      setNavigationStage((prev) => ({ ...prev, [order._id]: null }));
    }
  };

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4 pb-24"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-Refresh Indicator */}
      {pullToRefreshY > 0 && (
        <div 
          className="fixed top-0 left-0 right-0 flex items-center justify-center bg-blue-600 text-white py-2 z-50 transition-transform"
          style={{ transform: `translateY(${pullToRefreshY - 50}px)` }}
        >
          <RefreshCw className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm font-semibold">
            {isRefreshing ? 'Refreshing...' : 'Pull to refresh'}
          </span>
        </div>
      )}

      {isLoading && !deliveryInfo ? (
        <StatsCardSkeleton />
      ) : (
        <>
          <DeliverySummary
            activeCount={activeOrders.length}
            completedCount={Number(deliveryInfo?.completedOrdersCount || 0)}
          />
          <TodaysPerformance earnings={Number(deliveryInfo?.earnings || 0)} />
        </>
      )}

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
                    <span className="font-medium">{order.userId?.name || "Unknown Customer"}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 mr-2 text-green-600" />
                    <span>{order.userId?.phone || "No Phone"}</span>
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
      {isLoading && activeOrders.length === 0 ? (
        <div className="space-y-4">
          {[1, 2].map(i => <ActiveOrderCardSkeleton key={i} />)}
        </div>
      ) : activeOrders.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Active Deliveries</h3>
            <button
              onClick={() => fetchOrders()}
              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label="Refresh orders"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-4">
            {activeOrders.map((order) => {
              const status = String(order.orderStatus || "").toLowerCase();
              const deliveryStatusLower = String(order.deliveryStatus || "").toLowerCase();
              const isCancelled = status === "cancelled" || deliveryStatusLower === "cancelled";
              const isDelivered = status === "delivered" || deliveryStatusLower === "delivered";
              const isCod = String(order.paymentMethod || "").toLowerCase() === "cod";
              const hasArrived = !!order.arrivedAt;
              const codCollection = codCollectionByOrderId[order._id];
              const codCollectionKnown = codCollection !== undefined;
              const codCollected = !!codCollection;
              const canSendOtp = !isCancelled && !isDelivered && hasArrived && (!isCod || codCollected);
              const canShowCancelButton =
                (status === "in_transit" || status === "out_for_delivery") &&
                  !!order.arrivedAt &&
                !isCancelled &&
                !isDelivered;
              const isExpanded = !isCancelled && expandedOrders.has(order._id);
              const statusConfig = getStatusBadgeConfig(status);
              const StatusIcon = statusConfig.icon;
              const paymentStatusText = getPaymentStatusText(
                order.paymentMethod,
                order.paymentStatus,
                order.totalAmount
              );
              const paymentStatusColors = getPaymentStatusColor(order.paymentStatus);
              
              return (
                <motion.div
                  key={order._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-gray-200 rounded-xl bg-gray-50 overflow-hidden"
                >
                  {/* Collapsed State - Always Visible */}
                  <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <p className="font-bold text-lg text-gray-900">Order #{order._id.slice(-6)}</p>
                        <p className="text-xl font-bold text-green-600 mt-1">₹{order.totalAmount.toLocaleString("en-IN")}</p>
                    </div>
                      <div className="flex flex-col items-end gap-2">
                        {!isCancelled && (
                          <button
                            onClick={() => toggleOrderExpansion(order._id)}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label={isExpanded ? "Collapse order" : "Expand order"}
                          >
                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                          </button>
                        )}
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${statusConfig.bgColor} ${statusConfig.textColor}`}>
                          <StatusIcon className={`h-3.5 w-3.5 ${statusConfig.iconColor}`} />
                          <span>{statusConfig.label}</span>
                        </div>
                      </div>
                    </div>

                    {/* Payment Status - Unified Badge */}
                    <div className={`mb-3 px-3 py-2 rounded-lg ${paymentStatusColors.bgColor} ${paymentStatusColors.textColor}`}>
                      <p className="text-xs font-semibold">{paymentStatusText}</p>
                    </div>

                    {/* COD collection status (delivery event) */}
                    {isCod && hasArrived && !isCancelled && !isDelivered && (
                      <div className="mb-3">
                        {codCollectionKnown && codCollected ? (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                            <p className="text-sm font-semibold text-emerald-900">Payment Collected</p>
                            <p className="text-xs text-emerald-800 mt-1">
                              Mode: {codCollection.mode === "UPI" ? "UPI" : "Cash"}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                            <p className="text-sm font-semibold text-yellow-900">Collect Payment Before OTP</p>
                            <p className="text-xs text-yellow-800 mt-1">Amount is locked to ₹{order.totalAmount.toLocaleString("en-IN")}</p>
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <button
                                onClick={() => openCollectModal(order._id, "CASH")}
                                disabled={collectSubmitting}
                                className="py-3 bg-white border-2 border-yellow-300 text-yellow-900 rounded-xl font-semibold hover:bg-yellow-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                              >
                                <DollarSign className="h-5 w-5 mr-2" />
                                Cash
                              </button>
                              <button
                                onClick={() => openCollectModal(order._id, "UPI")}
                                disabled={collectSubmitting}
                                className="py-3 bg-white border-2 border-yellow-300 text-yellow-900 rounded-xl font-semibold hover:bg-yellow-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                              >
                                <Smartphone className="h-5 w-5 mr-2" />
                                UPI
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {isCancelled ? (
                      <div className="bg-gray-100 border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">Order Cancelled</p>
                            <p className="mt-1 text-xs text-gray-700">
                              Reason: {String(order.cancelReason || order.failureReasonCode || order.failureNotes || "N/A")}
                            </p>
                            <p className="mt-1 text-xs text-gray-600">
                              Cancelled at:{" "}
                              {new Date(String(order.cancelledAt || order.updatedAt || "")).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (

                      <>
                        {/* Primary Action Button - Always Visible */}
                        {/* Only show pickup button if order is actually assigned (not unassigned) */}
                        {status === "assigned" && String(order.deliveryStatus || "").toLowerCase() !== "unassigned" && (
                          <button
                            onClick={() => handlePickup(order._id)}
                            className="w-full py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
                          >
                            <CheckSquare className="h-5 w-5 mr-2" />
                            Mark as Picked Up
                          </button>
                        )}

                        {/* Show warning if order appears assigned but delivery status is unassigned */}
                        {status === "assigned" && String(order.deliveryStatus || "").toLowerCase() === "unassigned" && (
                          <div className="w-full py-3 bg-yellow-50 border-2 border-yellow-200 rounded-xl text-center">
                            <p className="text-sm font-semibold text-yellow-800">Order not yet assigned to you</p>
                            <p className="text-xs text-yellow-600 mt-1">Waiting for assignment...</p>
                          </div>
                        )}

                        {status === "picked_up" && (
                          <button
                            onClick={() => handleStartDelivery(order._id)}
                            className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
                          >
                            <Navigation className="h-5 w-5 mr-2" />
                            Start Delivery
                          </button>
                        )}

                        {status === "packed" && (
                          <button
                            onClick={() => handleStartDelivery(order._id)}
                            className="w-full py-4 bg-gradient-to-r from-orange-600 to-orange-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
                          >
                            <Navigation className="h-5 w-5 mr-2" />
                            Start Delivery
                          </button>
                        )}

                        {status === "in_transit" && !order.arrivedAt && (
                          <button
                            onClick={() => markArrived(order._id)}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
                          >
                            <MapPin className="h-5 w-5 mr-2" />
                            Mark as Arrived
                          </button>
                        )}

                        {status === "in_transit" && canSendOtp && (
                          <button
                            onClick={() => startDeliveryAttempt(order._id)}
                            className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
                          >
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Start Delivery Attempt
                          </button>
                        )}
                      </>
                    )}
                </div>

                  {/* OTP Input - Always visible after delivery attempt (not gated by expansion) */}
                  {(status === "in_transit" && deliveryAttempted[order._id] && !isCancelled && (!isCod || codCollected)) && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm font-semibold text-yellow-800 mb-2">
                        Enter OTP sent to customer to complete delivery
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

                      <button
                        onClick={() => verifyOtpAndDeliver(order._id)}
                        disabled={!otpInput[order._id] || otpInput[order._id].length !== 4}
                        className={`mt-3 w-full py-3 rounded-lg font-semibold transition-colors ${
                          !otpInput[order._id] || otpInput[order._id].length !== 4
                            ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                            : "bg-green-600 text-white hover:bg-green-700"
                        }`}
                      >
                        Verify OTP & Complete Delivery
                      </button>

                      <div className="mt-3">
                        {resendTimer[order._id] > 0 ? (
                          <p className="text-xs text-gray-600 text-center">
                            Resend OTP available in {resendTimer[order._id]} seconds
                          </p>
                        ) : (
                          <button
                            onClick={() => startDeliveryAttempt(order._id)}
                            className="w-full py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 transition-colors text-sm font-semibold"
                          >
                            Resend OTP
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {canShowCancelButton && (
                    <div className="mt-4">
                      <button
                        onClick={() => openCancelModal(order._id)}
                        className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center"
                      >
                        <AlertTriangle className="h-5 w-5 mr-2" />
                        Customer Not Available
                      </button>
                    </div>
                  )}

                  {/* Expanded State - Progressive Disclosure */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="border-t border-gray-200 bg-white overflow-hidden"
                      >
                        <div className="p-4 space-y-4">
                          {/* Next Action Hint */}
                          {statusConfig.nextAction && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                              <p className="text-sm font-semibold text-blue-900">
                                Next: {statusConfig.nextAction}
                              </p>
                            </div>
                          )}

                {/* Delivery Progress */}
                          <div>
                  <div className="flex items-center mb-2">
                    <div className={`flex-1 h-2 rounded-l-full ${
                      ["assigned", "picked_up", "in_transit", "out_for_delivery", "delivered"].includes(status)
                        ? "bg-blue-600"
                        : "bg-gray-300"
                    }`}></div>
                    <div className={`flex-1 h-2 ${
                      ["picked_up", "in_transit", "out_for_delivery", "delivered"].includes(status)
                        ? "bg-purple-600"
                        : "bg-gray-300"
                    }`}></div>
                    <div className={`flex-1 h-2 rounded-r-full ${
                      ["in_transit", "out_for_delivery", "delivered"].includes(status)
                        ? "bg-orange-600"
                        : "bg-gray-300"
                    }`}></div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className={status === "assigned" ? "font-bold text-blue-600" : ""}>Assigned</span>
                    <span className={status === "picked_up" ? "font-bold text-purple-600" : ""}>Picked Up</span>
                    <span className={status === "in_transit" || status === "out_for_delivery" ? "font-bold text-orange-600" : ""}>In Transit</span>
                  </div>
                </div>

                          {/* Customer Details */}
                          <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <User className="h-4 w-4 mr-2 text-blue-600" />
                              <span className="font-medium text-gray-900">{order.userId?.name || "Unknown Customer"}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="h-4 w-4 mr-2 text-green-600" />
                    {order.userId?.phone ? (
                                <a href={`tel:${order.userId.phone}`} className="text-blue-600 underline font-medium">
                        {order.userId.phone}
                      </a>
                    ) : (
                                <span className="text-gray-600">No Phone</span>
                    )}
                  </div>
                  <div className="flex items-start text-sm">
                              <MapPin className="h-4 w-4 mr-2 text-red-600 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-700">{order.address.addressLine}, {order.address.city}, {order.address.pincode}</span>
                  </div>
                </div>

                          {/* Secondary Action - Navigate */}
                {!isCancelled && (
                  <button
                    onClick={() => openNavigation(order)}
                    disabled={!!isNavigating[order._id]}
                    className="w-full py-3 border-2 border-blue-600 text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <Navigation className="h-5 w-5 mr-2" />
                    {isNavigating[order._id]
                      ? navigationStage[order._id] === "opening_maps"
                        ? "Opening maps…"
                        : "Fetching location…"
                      : "Navigate to Location"}
                  </button>
                )}

                          
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      ) : availableOrders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl shadow-lg p-8 text-center"
        >
          <div className="p-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full w-fit mx-auto mb-4">
            <Package className="h-12 w-12 text-blue-600" />
          </div>
          <h4 className="text-xl font-bold text-gray-900 mb-2">No Active Orders</h4>
          <p className="text-gray-600 mb-4">
            {deliveryInfo?.availability === "available"
              ? "Stay online to receive delivery requests"
              : "Go online to start receiving orders"}
          </p>
          {deliveryInfo?.earnings && deliveryInfo.earnings > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4">
              <p className="text-sm text-green-800">
                <span className="font-semibold">Today's Earnings:</span> ₹{deliveryInfo.earnings.toLocaleString("en-IN")}
              </p>
            </div>
          )}
          <button
            onClick={() => fetchOrders()}
            className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center mx-auto"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </motion.div>
      ) : null}

      {/* Error Recovery Card */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-6"
        >
          <div className="flex items-start space-x-3 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-red-900 mb-1">Unable to Load Orders</h4>
              <p className="text-sm text-red-800 mb-2">{error}</p>
              {retryCount > 0 && retryCount < maxRetries && (
                <p className="text-xs text-red-600">
                  Retrying... ({retryCount}/{maxRetries})
                </p>
              )}
        </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                setRetryCount(0);
                fetchOrders();
              }}
              disabled={retryCount >= maxRetries}
              className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {retryCount >= maxRetries ? "Max Retries Reached" : "Retry Now"}
            </button>
            <button
              onClick={() => setError(null)}
              className="px-4 py-2.5 bg-red-100 text-red-700 rounded-lg font-semibold hover:bg-red-200 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </motion.div>
      )}

      {/* Cancel Delivery Modal */}
      <AnimatePresence>
        {cancelModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200"
            >
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">Cancel Delivery</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Confirm cancellation if the customer is unavailable.
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Reason
                  </label>
                  <select
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    disabled={cancelSubmitting}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <option value="">Select a reason</option>
                    <option value="CUSTOMER_NOT_AVAILABLE">Customer not reachable</option>
                    <option value="ADDRESS_ISSUE">Address incorrect</option>
                    <option value="CUSTOMER_REJECTED">Customer refused delivery</option>
                  </select>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Additional notes (optional)
                  </label>
                  <textarea
                    value={cancelNotes}
                    onChange={(e) => setCancelNotes(e.target.value)}
                    disabled={cancelSubmitting}
                    maxLength={200}
                    rows={3}
                    placeholder="Add any helpful context (max 200 characters)"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={closeCancelModal}
                    disabled={cancelSubmitting}
                    className="flex-1 py-3 bg-gray-100 text-gray-900 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={() => void confirmCancellation()}
                    disabled={cancelSubmitting || !cancelReason}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {cancelSubmitting ? "Cancelling…" : "Confirm Cancellation"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collect Payment Modal */}
      <AnimatePresence>
        {collectModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-200"
            >
              <div className="p-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    {collectMode === "UPI" ? (
                      <Smartphone className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">Confirm Payment Collected</h3>
                    <p className="mt-1 text-sm text-gray-600">
                      Mode: <span className="font-semibold">{collectMode === "UPI" ? "UPI" : "Cash"}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-600">Amount (locked)</p>
                  <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums">
                    ₹{Number(activeOrders.find((o) => o._id === collectOrderId)?.totalAmount || 0).toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={closeCollectModal}
                    disabled={collectSubmitting}
                    className="flex-1 py-3 bg-gray-100 text-gray-900 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={() => void confirmCollectPayment()}
                    disabled={collectSubmitting}
                    className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {collectSubmitting ? "Recording…" : "Confirm"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default EnhancedHomeTab;
