import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams } from "react-router-dom";
import MapView from "../components/MapView";
import DeliveryListItem from "../components/DeliveryListItem";
import { useOrderUpdates } from "../hooks/useSocket";
import toast from "react-hot-toast";

const OrderTrackingPage = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<any>(null);
  const [deliveryBoyLocation, setDeliveryBoyLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Use socket for real-time updates
  const { orderStatus, paymentStatus } = useOrderUpdates(id || '');

  // Fetch order data and handle real-time updates
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await fetch(`/api/orders/${id}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        });
        
        if (response.ok) {
          const orderData = await response.json();
          setOrder(orderData);
        } else {
          // Fallback to mock data for demo
          const mockOrder = {
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
            orderStatus: "in_transit",
            paymentStatus: "paid",
            createdAt: new Date().toISOString(),
            deliveryBoy: {
              name: "Rajesh Kumar",
              phone: "9876543210",
              vehicleType: "bike",
            },
          };
          setOrder(mockOrder);
        }
      } catch (error) {
        console.error("Failed to fetch order:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
    setDeliveryBoyLocation({ lat: 17.39, lng: 78.49 }); // Mock delivery boy location
  }, [id]);

  // Handle real-time status updates
  useEffect(() => {
    if (order && orderStatus && orderStatus !== order.orderStatus) {
      setOrder(prev => ({ ...prev, orderStatus }));
      toast.success(`Order status updated: ${orderStatus}`);
    }
  }, [orderStatus, order]);

  // Handle payment status updates
  useEffect(() => {
    if (order && paymentStatus && paymentStatus !== order.paymentStatus) {
      setOrder(prev => ({ ...prev, paymentStatus }));
      if (paymentStatus === 'paid') {
        toast.success('Payment confirmed!');
      } else if (paymentStatus === 'failed') {
        toast.error('Payment failed');
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

  const markers = [
    {
      id: "destination",
      position: { lat: order.address.lat, lng: order.address.lng },
      title: "Delivery Address",
      icon: "🏠",
      info: `${order.address.label}: ${order.address.addressLine}`,
    },
  ];

  if (deliveryBoyLocation) {
    markers.push({
      id: "driver",
      position: deliveryBoyLocation,
      title: "Delivery Boy",
      icon: "🚚",
      info: `${order.deliveryBoy?.name} - ${order.deliveryBoy?.vehicleType}`,
    });
  }

  const polylines = deliveryBoyLocation
    ? [
        {
          path: [
            { lat: deliveryBoyLocation.lat, lng: deliveryBoyLocation.lng },
            { lat: order.address.lat, lng: order.address.lng },
          ],
          color: "#0ea5e9",
          weight: 3,
        },
      ]
    : [];

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Map View */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="text-xl font-semibold text-gray-900">
                Live Tracking
              </h2>
              <p className="text-sm text-gray-600">
                Real-time delivery location
              </p>
            </div>
            <div className="h-96">
              <MapView
                center={order.address}
                zoom={13}
                markers={markers}
                polylines={polylines}
                className="h-full"
              />
            </div>
          </div>

          {/* Order Details */}
          <div className="space-y-6">
            <DeliveryListItem order={order} />

            {/* Status Timeline */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Order Status
              </h3>
              <div className="space-y-4">
                {[
                  {
                    status: "created",
                    label: "Order Created",
                    completed: true,
                  },
                  {
                    status: "assigned",
                    label: "Assigned to Driver",
                    completed: true,
                  },
                  {
                    status: "picked_up",
                    label: "Picked Up",
                    completed:
                      order.orderStatus === "picked_up" ||
                      order.orderStatus === "in_transit" ||
                      order.orderStatus === "delivered",
                  },
                  {
                    status: "in_transit",
                    label: "In Transit",
                    completed:
                      order.orderStatus === "in_transit" ||
                      order.orderStatus === "delivered",
                  },
                  {
                    status: "delivered",
                    label: "Delivered",
                    completed: order.orderStatus === "delivered",
                  },
                ].map((step, index) => (
                  <div
                    key={step.status}
                    className="flex items-center space-x-3"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                        step.completed
                          ? "bg-green-500 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {step.completed ? "✓" : index + 1}
                    </div>
                    <div>
                      <p
                        className={`font-medium ${
                          step.completed ? "text-green-700" : "text-gray-600"
                        }`}
                      >
                        {step.label}
                      </p>
                      {step.status === order.orderStatus && (
                        <p className="text-sm text-primary-600">
                          Current Status
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ETA */}
            {order.orderStatus === "in_transit" && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="text-2xl">⏰</div>
                  <div>
                    <p className="font-semibold text-blue-900">
                      Estimated Delivery
                    </p>
                    <p className="text-blue-700">15-20 minutes</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default OrderTrackingPage;
