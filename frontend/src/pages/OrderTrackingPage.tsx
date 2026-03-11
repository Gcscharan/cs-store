import { useMemo, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import DeliveryListItem from "../components/DeliveryListItem";
import { useOrderUpdates } from "../hooks/useSocket";
import { useCustomerLiveTracking } from "../hooks/useCustomerLiveTracking";
import toast from "react-hot-toast";
import OrderTimeline from "../components/OrderTimeline";
import { buildCustomerOrderTimeline } from "../utils/customerOrderTimeline";
import { shouldShowDeliveryPartner } from "../utils/deliveryPartnerVisibility";

const OrderTrackingPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use socket for real-time updates
  const { orderStatus, paymentStatus } = useOrderUpdates(id || "");
  
  // Live tracking for delivery partner location
  const { 
    location: liveLocation, 
    isConnected: isLiveConnected, 
    lastUpdatedAgo,
    shouldStopTracking 
  } = useCustomerLiveTracking({
    enabled: Boolean(id && order?.status && !["DELIVERED", "CANCELLED", "REFUNDED"].includes(String(order?.status || "").toUpperCase())),
    orderId: id || null,
    orderStatus: order?.status,
  });

  const refreshOrder = useCallback(async () => {
    if (!id) return;
    try {
      const response = await fetch(`/api/orders/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrder((data as any)?.order ?? data);
        return;
      }

      // Fallback to mock data for demo
      setOrder({
        _id: id,
        items: [
          { name: "Rice 1kg", qty: 2, price: 50 },
          { name: "Dal 500g", qty: 1, price: 80 },
        ],
        totalAmount: 180,
        address: {
          label: "Home",
          addressLine: "123 Main Street",
          city: "Hyderabad",
          pincode: "500001",
          lat: 17.385,
          lng: 78.4867,
        },
        paymentStatus: "paid",
        createdAt: new Date().toISOString(),
        deliveryPartner: {
          name: "Rajesh Kumar",
          phone: "9876543210",
          vehicleType: "bike",
        },
        timeline: [
          { key: "ORDER_PLACED", state: "completed", timestamp: new Date().toISOString() },
          { key: "ORDER_CONFIRMED", state: "completed", timestamp: new Date().toISOString() },
          { key: "ORDER_PACKED", state: "completed", timestamp: new Date().toISOString() },
          {
            key: "ORDER_IN_TRANSIT",
            state: "current",
            timestamp: new Date().toISOString(),
            eta: {
              start: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              end: new Date(Date.now() + 90 * 60 * 1000).toISOString(),
              confidence: "high",
            },
          },
          { key: "ORDER_DELIVERED", state: "pending" },
        ],
      });
    } catch (error) {
      console.error("Failed to fetch order:", error);
    }
  }, [id]);

  // Fetch order data and handle real-time updates
  useEffect(() => {
    void refreshOrder().finally(() => {
      setIsLoading(false);
    });
  }, [refreshOrder]);

  // Handle real-time status updates
  useEffect(() => {
    if (!orderStatus) return;
    void refreshOrder().catch(() => undefined);
  }, [orderStatus, refreshOrder]);

  // Handle payment status updates
  useEffect(() => {
    if (order && paymentStatus && paymentStatus !== order.paymentStatus) {
      setOrder((prev: any) => ({ ...prev, paymentStatus }));
      if (paymentStatus === "paid") {
        const token = localStorage.getItem("accessToken");
        const orderId = String(id || "").trim();
        console.info("[FRONTEND][SUCCESS_DISPATCHED]", {
          source: "OrderTrackingPage:socket",
          orderId,
          note: "Verifying backend paymentStatus before showing success",
        });

        fetch(`/api/orders/${orderId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then((r) => r.json().catch(() => ({})))
          .then((payload: any) => {
            const ps = String(payload?.order?.paymentStatus || payload?.paymentStatus || "").toUpperCase();
            if (ps === "PAID") {
              toast.success("Payment confirmed!");
            } else {
              console.warn("[FRONTEND][SUCCESS_DISPATCHED_BLOCKED]", {
                source: "OrderTrackingPage:socket",
                orderId,
                paymentStatus: ps,
              });
            }
          })
          .catch(() => {
            console.warn("[FRONTEND][SUCCESS_DISPATCHED_BLOCKED]", {
              source: "OrderTrackingPage:socket",
              orderId,
              reason: "VERIFY_FAILED",
            });
          });
      } else if (paymentStatus === "failed") {
        toast.error("Payment failed");
      }
    }
  }, [paymentStatus, order]);

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gray-50 py-8 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading order details...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (!order) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gray-50 py-8 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Order Tracking
          </h1>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❌</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Order not found
            </h3>
            <p className="text-gray-600">
              The order you're looking for doesn't exist.
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  const backendTimeline = Array.isArray((order as any)?.timeline) ? ((order as any).timeline as any[]) : [];
  const timeline = buildCustomerOrderTimeline(backendTimeline);

  const refunds = useMemo(() => {
    return Array.isArray((order as any)?.refunds) ? (((order as any).refunds as any[]) || []) : [];
  }, [order]);

  const refundTimeline = useMemo(() => {
    if (!refunds.length) return [] as any[];

    const normalizeStatus = (raw: any) => String(raw || "").trim().toUpperCase();
    const statuses = refunds.map((r) => normalizeStatus(r?.status));

    const hasCompleted = statuses.includes("COMPLETED");
    const hasProcessing = statuses.includes("PROCESSING") || statuses.includes("INITIATED");
    const hasFailed = statuses.includes("FAILED");
    const hasPartial = statuses.includes("PARTIAL");

    const stage: "REQUESTED" | "PROCESSING" | "COMPLETED" | "FAILED" | "PARTIAL" =
      hasFailed && !hasCompleted ? "FAILED" :
      hasPartial ? "PARTIAL" :
      hasCompleted && !hasProcessing ? "COMPLETED" :
      hasProcessing ? "PROCESSING" :
      "REQUESTED";

    const earliestCreatedAt = refunds
      .map((r) => String(r?.createdAt || r?.updatedAt || "").trim())
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

    const latestUpdatedAt = refunds
      .map((r) => String(r?.updatedAt || r?.createdAt || "").trim())
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];

    const steps: any[] = [];

    steps.push({
      key: "CUSTOMER_REFUND_INITIATED",
      label: stage === "REQUESTED" ? "Refund requested" : "Refund initiated",
      timestamp: earliestCreatedAt,
      state: stage === "REQUESTED" ? "current" : "completed",
      description:
        stage === "REQUESTED"
          ? "We’ve received your request. Refund timelines depend on your bank and payment method."
          : undefined,
    });

    steps.push({
      key: "CUSTOMER_REFUND_PROCESSING",
      label: "Refund processing",
      timestamp: stage === "COMPLETED" || stage === "FAILED" || stage === "PARTIAL" ? latestUpdatedAt : undefined,
      state:
        stage === "PROCESSING"
          ? "current"
          : stage === "REQUESTED"
            ? "pending"
            : "completed",
      description:
        stage === "PROCESSING"
          ? "Banks may take 2–7 business days to reflect the amount."
          : undefined,
    });

    steps.push({
      key: "CUSTOMER_REFUND_FINAL",
      label:
        stage === "FAILED"
          ? "Refund failed"
          : stage === "PARTIAL"
            ? "Partial refund completed"
            : "Refund completed",
      timestamp: stage === "COMPLETED" || stage === "FAILED" || stage === "PARTIAL" ? latestUpdatedAt : undefined,
      state:
        stage === "FAILED"
          ? "failed"
          : stage === "COMPLETED"
            ? "completed"
            : stage === "PARTIAL"
              ? (hasProcessing ? "current" : "completed")
              : "pending",
      description:
        stage === "FAILED"
          ? "Refund could not be completed. Our support team may contact you."
          : stage === "PARTIAL"
            ? "Some of the amount has been refunded. Remaining amount is still under review."
            : stage === "COMPLETED"
              ? "If you don’t see it yet, please check again in 24–48 hours."
              : undefined,
    });

    return steps;
  }, [refunds]);

  const combinedTimeline = useMemo(() => {
    if (!refundTimeline.length) return timeline as any[];
    return [...timeline, ...refundTimeline] as any[];
  }, [refundTimeline, timeline]);
  const currentStep = timeline.find((s: any) => String(s?.state || "") === "current");
  const showPartner = shouldShowDeliveryPartner({
    currentCustomerStepKey: String((currentStep as any)?.key || ""),
    hasDeliveryPartner: Boolean((order as any)?.deliveryPartner),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 py-8 px-4"
    >
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Order Tracking
        </h1>
        <div className="space-y-6">
          <DeliveryListItem order={order} />

            {showPartner && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Delivery Partner</h3>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {String((order as any)?.deliveryPartner?.name || "Delivery partner")}
                    </p>
                    {(order as any)?.deliveryPartner?.vehicleType && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {String((order as any)?.deliveryPartner?.vehicleType)}
                      </p>
                    )}
                    {(order as any)?.deliveryPartner?.phone && (
                      <p className="text-sm text-gray-700 mt-2">{String((order as any)?.deliveryPartner?.phone)}</p>
                    )}
                  </div>

                  {(order as any)?.deliveryPartner?.phone && (
                    <a
                      href={`tel:${String((order as any)?.deliveryPartner?.phone)}`}
                      className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                    >
                      Call
                    </a>
                  )}
                </div>
              </div>
            )}

          {/* Live Tracking Map */}
          {liveLocation && !shouldStopTracking && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Live Tracking</h3>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-2 w-2 rounded-full ${isLiveConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-xs text-gray-500">
                    {isLiveConnected ? 'Live' : 'Connecting...'}
                  </span>
                  {lastUpdatedAgo && (
                    <span className="text-xs text-gray-400 ml-2">
                      Updated {lastUpdatedAgo}
                    </span>
                  )}
                </div>
              </div>
              
              {/* ETA Display */}
              {liveLocation.etaMinutes > 0 && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Estimated arrival</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {liveLocation.etaMinutes} min
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Distance</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {(liveLocation.distanceRemainingM / 1000).toFixed(1)} km
                      </p>
                    </div>
                  </div>
                  {liveLocation.stale && (
                    <p className="text-xs text-orange-600 mt-2">
                      ⚠️ Location may be outdated
                    </p>
                  )}
                </div>
              )}

              {/* Google Maps Embed */}
              <div className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden relative">
                <iframe
                  title="Live Tracking Map"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  loading="lazy"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps/embed/v1/directions?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY || ''}&origin=${liveLocation.riderLat},${liveLocation.riderLng}&destination=${(order as any)?.address?.lat || ''},${(order as any)?.address?.lng || ''}&mode=driving`}
                />
                
                {/* Overlay markers for better visualization */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* Rider marker */}
                  <div 
                    className="absolute transform -translate-x-1/2 -translate-y-full"
                    style={{ 
                      left: '30%', 
                      top: '50%',
                    }}
                  >
                    <div className="relative">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                          <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1v-1h3.05a2.5 2.5 0 014.9 0H19a1 1 0 001-1v-5a1 1 0 00-.293-.707l-3-3A1 1 0 0016 4H3z"/>
                        </svg>
                      </div>
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-blue-600" />
                    </div>
                  </div>
                  
                  {/* Destination marker */}
                  <div 
                    className="absolute transform -translate-x-1/2 -translate-y-full"
                    style={{ 
                      left: '70%', 
                      top: '60%',
                    }}
                  >
                    <div className="relative">
                      <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Address info */}
              <div className="mt-4 flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {(order as any)?.address?.label || 'Delivery Address'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {(order as any)?.address?.addressLine}, {(order as any)?.address?.city}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Status Timeline */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Order Status
            </h3>
            <OrderTimeline steps={combinedTimeline as any} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default OrderTrackingPage;
