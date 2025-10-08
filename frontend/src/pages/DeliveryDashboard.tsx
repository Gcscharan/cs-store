import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { useSocket } from "../hooks/useSocket";
import toast from "react-hot-toast";

interface Order {
  _id: string;
  orderStatus: string;
  totalAmount: number;
  address: {
    label: string;
    addressLine: string;
    city: string;
    pincode: string;
    lat: number;
    lng: number;
  };
  userId: {
    name: string;
    phone: string;
  };
  createdAt: string;
}

const DeliveryDashboard = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const { socket } = useSocket();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  // Fetch assigned orders
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/delivery/my-orders", {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setOrders(data.orders);
        }
      } catch (error) {
        console.error("Failed to fetch orders:", error);
        toast.error("Failed to fetch orders");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // Get current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error("Error getting location:", error);
          toast.error("Unable to get your location");
        }
      );
    }
  }, []);

  // Update location
  const updateLocation = async () => {
    if (!currentLocation) {
      toast.error("Location not available");
      return;
    }

    setIsUpdatingLocation(true);
    try {
      const response = await fetch("/api/delivery/update-location", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          lat: currentLocation.lat,
          lng: currentLocation.lng,
        }),
      });

      if (response.ok) {
        toast.success("Location updated successfully");
      } else {
        throw new Error("Failed to update location");
      }
    } catch (error) {
      console.error("Failed to update location:", error);
      toast.error("Failed to update location");
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  // Update order status
  const updateOrderStatus = async (
    orderId: string,
    status: string,
    proofImage?: string
  ) => {
    try {
      const response = await fetch("/api/delivery/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: JSON.stringify({
          orderId,
          status,
          proofImage,
        }),
      });

      if (response.ok) {
        toast.success(`Order status updated to ${status}`);
        // Update local state
        setOrders((prev) =>
          prev.map((order) =>
            order._id === orderId ? { ...order, orderStatus: status } : order
          )
        );
      } else {
        throw new Error("Failed to update order status");
      }
    } catch (error) {
      console.error("Failed to update order status:", error);
      toast.error("Failed to update order status");
    }
  };

  // Handle file upload for proof
  const handleProofUpload = async (orderId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/cloudinary/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        await updateOrderStatus(orderId, "delivered", data.secure_url);
      } else {
        throw new Error("Failed to upload proof image");
      }
    } catch (error) {
      console.error("Failed to upload proof:", error);
      toast.error("Failed to upload proof image");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "assigned":
        return "bg-blue-100 text-blue-800";
      case "picked_up":
        return "bg-yellow-100 text-yellow-800";
      case "in_transit":
        return "bg-purple-100 text-purple-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case "assigned":
        return "picked_up";
      case "picked_up":
        return "in_transit";
      case "in_transit":
        return "delivered";
      default:
        return null;
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
            <p className="text-gray-600">Loading dashboard...</p>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Delivery Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Welcome back, {user?.name || "Driver"}!
              </p>
            </div>

            <div className="flex items-center space-x-4">
              {/* Location Status */}
              <div className="text-center">
                <div className="text-2xl mb-1">
                  {currentLocation ? "📍" : "❌"}
                </div>
                <p className="text-sm text-gray-600">
                  {currentLocation ? "Location Active" : "Location Offline"}
                </p>
              </div>

              {/* Update Location Button */}
              <button
                onClick={updateLocation}
                disabled={!currentLocation || isUpdatingLocation}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentLocation && !isUpdatingLocation
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isUpdatingLocation ? "Updating..." : "Update Location"}
              </button>
            </div>
          </div>
        </div>

        {/* Orders List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {orders.length === 0 ? (
            <div className="col-span-2">
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No assigned orders
                </h3>
                <p className="text-gray-600">
                  You don't have any orders assigned to you at the moment.
                </p>
              </div>
            </div>
          ) : (
            orders.map((order) => (
              <motion.div
                key={order._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                {/* Order Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Order #{order._id.slice(-6)}
                    </h3>
                    <p className="text-sm text-gray-600">
                      ₹{order.totalAmount.toFixed(2)}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                      order.orderStatus
                    )}`}
                  >
                    {order.orderStatus.replace("_", " ").toUpperCase()}
                  </span>
                </div>

                {/* Customer Info */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">Customer</h4>
                  <p className="text-sm text-gray-600">{order.userId.name}</p>
                  <p className="text-sm text-gray-600">{order.userId.phone}</p>
                </div>

                {/* Delivery Address */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-900 mb-2">
                    Delivery Address
                  </h4>
                  <p className="text-sm text-gray-600">
                    {order.address.label}: {order.address.addressLine}
                  </p>
                  <p className="text-sm text-gray-600">
                    {order.address.city} - {order.address.pincode}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {getNextStatus(order.orderStatus) && (
                    <button
                      onClick={() =>
                        updateOrderStatus(
                          order._id,
                          getNextStatus(order.orderStatus)!
                        )
                      }
                      className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Mark as{" "}
                      {getNextStatus(order.orderStatus)
                        ?.replace("_", " ")
                        .toUpperCase()}
                    </button>
                  )}

                  {order.orderStatus === "in_transit" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Upload Delivery Proof
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleProofUpload(order._id, file);
                          }
                        }}
                        className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                      />
                    </div>
                  )}

                  {order.orderStatus === "delivered" && (
                    <div className="text-center py-2">
                      <span className="text-green-600 font-medium">
                        ✅ Order Delivered
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default DeliveryDashboard;
