import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSocket } from "../hooks/useSocket";
import MapView from "../components/MapView";
import toast from "react-hot-toast";

interface DeliveryBoy {
  _id: string;
  name: string;
  phone: string;
  vehicleType: string;
  availability: string;
  currentLocation: {
    lat: number;
    lng: number;
    lastUpdatedAt: string;
  };
  assignedOrders: any[];
  earnings: number;
  completedOrdersCount: number;
}

interface Order {
  _id: string;
  orderStatus: string;
  totalAmount: number;
  address: {
    lat: number;
    lng: number;
    addressLine: string;
    city: string;
  };
  userId: {
    name: string;
  };
  deliveryBoyId?: string;
  createdAt: string;
}

const AdminDeliveryMap = () => {
  const { socket } = useSocket();
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DeliveryBoy | null>(
    null
  );
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showReassignModal, setShowReassignModal] = useState(false);

  // Fetch delivery boys and orders
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deliveryResponse, ordersResponse] = await Promise.all([
          fetch("/api/delivery", {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            },
          }),
          fetch("/api/orders", {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
            },
          }),
        ]);

        if (deliveryResponse.ok) {
          const deliveryData = await deliveryResponse.json();
          setDeliveryBoys(deliveryData.deliveryBoys);
        }

        if (ordersResponse.ok) {
          const ordersData = await ordersResponse.json();
          setOrders(ordersData.orders);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("Failed to load delivery data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Socket connection for real-time updates
  useEffect(() => {
    if (socket) {
      // Join admin room
      socket.emit("join_room", {
        room: "admin_room",
        userId: "admin",
        userRole: "admin",
      });

      // Listen for driver location updates
      socket.on("driver:location:update", (data) => {
        setDeliveryBoys((prev) =>
          prev.map((driver) =>
            driver._id === data.driverId
              ? {
                  ...driver,
                  currentLocation: {
                    lat: data.lat,
                    lng: data.lng,
                    lastUpdatedAt: new Date().toISOString(),
                  },
                }
              : driver
          )
        );
      });

      // Listen for order status updates
      socket.on("order:status:update", (data) => {
        setOrders((prev) =>
          prev.map((order) =>
            order._id === data.orderId
              ? { ...order, orderStatus: data.status }
              : order
          )
        );
        toast.success(`Order ${data.orderId} status updated to ${data.status}`);
      });

      return () => {
        socket.off("driver:location:update");
        socket.off("order:status:update");
      };
    }
  }, [socket]);

  // Reassign order
  const reassignOrder = async (orderId: string, deliveryBoyId: string) => {
    try {
      const response = await fetch("/api/delivery/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          orderId,
          deliveryBoyId,
        }),
      });

      if (response.ok) {
        toast.success("Order reassigned successfully");
        setShowReassignModal(false);
        setSelectedOrder(null);

        // Update local state
        setOrders((prev) =>
          prev.map((order) =>
            order._id === orderId
              ? { ...order, deliveryBoyId, orderStatus: "assigned" }
              : order
          )
        );
      } else {
        throw new Error("Failed to reassign order");
      }
    } catch (error) {
      console.error("Failed to reassign order:", error);
      toast.error("Failed to reassign order");
    }
  };

  // Get markers for map
  const getMapMarkers = () => {
    const markers: any[] = [];

    // Add delivery boy markers
    deliveryBoys.forEach((driver) => {
      if (driver.currentLocation.lat && driver.currentLocation.lng) {
        markers.push({
          id: `driver_${driver._id}`,
          position: {
            lat: driver.currentLocation.lat,
            lng: driver.currentLocation.lng,
          },
          title: driver.name,
          icon: getDriverIcon(driver.availability),
          info: `${driver.name} - ${driver.vehicleType} (${driver.availability})`,
          type: "driver",
          data: driver,
        });
      }
    });

    // Add order markers
    orders.forEach((order) => {
      if (order.address.lat && order.address.lng) {
        markers.push({
          id: `order_${order._id}`,
          position: {
            lat: order.address.lat,
            lng: order.address.lng,
          },
          title: `Order #${order._id.slice(-6)}`,
          icon: getOrderIcon(order.orderStatus),
          info: `${order.userId.name} - ₹${order.totalAmount} (${order.orderStatus})`,
          type: "order",
          data: order,
        });
      }
    });

    return markers;
  };

  const getDriverIcon = (availability: string) => {
    switch (availability) {
      case "available":
        return "🟢";
      case "busy":
        return "🟡";
      case "offline":
        return "🔴";
      default:
        return "⚫";
    }
  };

  const getOrderIcon = (status: string) => {
    switch (status) {
      case "created":
        return "📦";
      case "assigned":
        return "🚚";
      case "picked_up":
        return "📦";
      case "in_transit":
        return "🚛";
      case "delivered":
        return "✅";
      default:
        return "📋";
    }
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case "available":
        return "text-green-600 bg-green-100";
      case "busy":
        return "text-yellow-600 bg-yellow-100";
      case "offline":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

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
            <p className="text-gray-600">Loading delivery map...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50 py-8 px-4"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Delivery Management
          </h1>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {deliveryBoys.length}
              </div>
              <div className="text-sm text-gray-600">Total Drivers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {
                  deliveryBoys.filter((d) => d.availability === "available")
                    .length
                }
              </div>
              <div className="text-sm text-gray-600">Available</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {deliveryBoys.filter((d) => d.availability === "busy").length}
              </div>
              <div className="text-sm text-gray-600">Busy</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {orders.filter((o) => o.orderStatus === "in_transit").length}
              </div>
              <div className="text-sm text-gray-600">In Transit</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map View */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-xl font-semibold text-gray-900">
                  Live Delivery Map
                </h2>
                <p className="text-sm text-gray-600">
                  Real-time driver locations and order status
                </p>
              </div>
              <div className="h-96">
                <MapView
                  center={{ lat: 17.385, lng: 78.4867 }}
                  zoom={12}
                  markers={getMapMarkers()}
                  onMarkerClick={(marker) => {
                    if (marker.type === "driver") {
                      setSelectedDriver(marker.data);
                    } else if (marker.type === "order") {
                      setSelectedOrder(marker.data);
                    }
                  }}
                  className="h-full"
                />
              </div>
            </div>
          </div>

          {/* Driver List */}
          <div className="space-y-6">
            {/* Selected Driver Details */}
            {selectedDriver && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Driver Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium">Name:</span>{" "}
                    {selectedDriver.name}
                  </div>
                  <div>
                    <span className="font-medium">Phone:</span>{" "}
                    {selectedDriver.phone}
                  </div>
                  <div>
                    <span className="font-medium">Vehicle:</span>{" "}
                    {selectedDriver.vehicleType}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    <span
                      className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getAvailabilityColor(selectedDriver.availability)}`}
                    >
                      {selectedDriver.availability.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Earnings:</span> ₹
                    {selectedDriver.earnings.toFixed(2)}
                  </div>
                  <div>
                    <span className="font-medium">Completed Orders:</span>{" "}
                    {selectedDriver.completedOrdersCount}
                  </div>
                  <div>
                    <span className="font-medium">Assigned Orders:</span>{" "}
                    {selectedDriver.assignedOrders.length}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDriver(null)}
                  className="mt-4 w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            )}

            {/* Selected Order Details */}
            {selectedOrder && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Order Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium">Order ID:</span> #
                    {selectedOrder._id.slice(-6)}
                  </div>
                  <div>
                    <span className="font-medium">Customer:</span>{" "}
                    {selectedOrder.userId.name}
                  </div>
                  <div>
                    <span className="font-medium">Amount:</span> ₹
                    {selectedOrder.totalAmount.toFixed(2)}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    <span
                      className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${getAvailabilityColor(selectedOrder.orderStatus)}`}
                    >
                      {selectedOrder.orderStatus.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium">Address:</span>{" "}
                    {selectedOrder.address.addressLine}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <button
                    onClick={() => setShowReassignModal(true)}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Reassign Order
                  </button>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            {/* Driver List */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                All Drivers
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {deliveryBoys.map((driver) => (
                  <div
                    key={driver._id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedDriver?._id === driver._id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                    onClick={() => setSelectedDriver(driver)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-gray-900">
                          {driver.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {driver.vehicleType}
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-xs px-2 py-1 rounded-full ${getAvailabilityColor(driver.availability)}`}
                        >
                          {driver.availability}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {driver.assignedOrders.length} orders
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Reassign Modal */}
        {showReassignModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Reassign Order #{selectedOrder._id.slice(-6)}
              </h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {deliveryBoys
                  .filter((driver) => driver.availability === "available")
                  .map((driver) => (
                    <div
                      key={driver._id}
                      className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50"
                      onClick={() =>
                        reassignOrder(selectedOrder._id, driver._id)
                      }
                    >
                      <div className="font-medium text-gray-900">
                        {driver.name}
                      </div>
                      <div className="text-sm text-gray-600">
                        {driver.vehicleType}
                      </div>
                      <div className="text-xs text-gray-500">
                        {driver.assignedOrders.length} current orders
                      </div>
                    </div>
                  ))}
              </div>
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={() => setShowReassignModal(false)}
                  className="flex-1 py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AdminDeliveryMap;
