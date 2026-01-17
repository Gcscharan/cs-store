import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import DeliveryListItem from "../components/DeliveryListItem";
import { useOrderUpdates } from "../hooks/useSocket";
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
        toast.success("Payment confirmed!");
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

          {/* Status Timeline */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Order Status
            </h3>
            <OrderTimeline steps={timeline as any} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default OrderTrackingPage;
