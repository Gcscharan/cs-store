import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import MapView from "../components/MapView";

const AdminDeliveryMap = () => {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data - in real app, fetch from API
  useEffect(() => {
    const mockDrivers = [
      {
        id: "driver1",
        name: "Rajesh Kumar",
        phone: "9876543210",
        vehicleType: "bike",
        location: { lat: 17.385, lng: 78.4867 },
        status: "available",
        orders: 2,
      },
      {
        id: "driver2",
        name: "Suresh Patel",
        phone: "9876543211",
        vehicleType: "scooter",
        location: { lat: 17.39, lng: 78.49 },
        status: "busy",
        orders: 1,
      },
    ];

    const mockOrders = [
      {
        id: "order1",
        customerName: "John Doe",
        address: "123 Main St, Hyderabad",
        location: { lat: 17.38, lng: 78.48 },
        status: "assigned",
        driverId: "driver1",
      },
      {
        id: "order2",
        customerName: "Jane Smith",
        address: "456 Park Ave, Hyderabad",
        location: { lat: 17.395, lng: 78.495 },
        status: "in_transit",
        driverId: "driver2",
      },
    ];

    setDrivers(mockDrivers);
    setOrders(mockOrders);
    setIsLoading(false);
  }, []);

  const markers = [
    ...drivers.map((driver) => ({
      id: driver.id,
      position: driver.location,
      title: `${driver.name} (${driver.vehicleType})`,
      icon: driver.status === "available" ? "🟢" : "🔴",
      info: `
        <div>
          <h3 class="font-semibold">${driver.name}</h3>
          <p class="text-sm">${driver.vehicleType} • ${driver.phone}</p>
          <p class="text-sm">Status: ${driver.status}</p>
          <p class="text-sm">Active Orders: ${driver.orders}</p>
        </div>
      `,
    })),
    ...orders.map((order) => ({
      id: order.id,
      position: order.location,
      title: `Order ${order.id}`,
      icon: "📦",
      info: `
        <div>
          <h3 class="font-semibold">Order ${order.id}</h3>
          <p class="text-sm">Customer: ${order.customerName}</p>
          <p class="text-sm">Address: ${order.address}</p>
          <p class="text-sm">Status: ${order.status}</p>
        </div>
      `,
    })),
  ];

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
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Delivery Map</h1>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Available Drivers</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Busy Drivers</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Orders</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="p-4 border-b">
                <h2 className="text-xl font-semibold text-gray-900">
                  Live Delivery Map
                </h2>
                <p className="text-sm text-gray-600">
                  Real-time driver locations and orders
                </p>
              </div>
              <div className="h-96">
                <MapView
                  center={{ lat: 17.385, lng: 78.4867 }}
                  zoom={12}
                  markers={markers}
                  className="h-full"
                />
              </div>
            </div>
          </div>

          {/* Driver List */}
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Active Drivers
              </h3>
              <div className="space-y-3">
                {drivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg"
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${
                        driver.status === "available"
                          ? "bg-green-500"
                          : "bg-red-500"
                      }`}
                    ></div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{driver.name}</p>
                      <p className="text-sm text-gray-600">
                        {driver.vehicleType}
                      </p>
                      <p className="text-xs text-gray-500">
                        {driver.orders} active orders
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Active Orders
              </h3>
              <div className="space-y-3">
                {orders.map((order) => (
                  <div key={order.id} className="p-3 border rounded-lg">
                    <p className="font-medium text-gray-900">
                      Order {order.id}
                    </p>
                    <p className="text-sm text-gray-600">
                      {order.customerName}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {order.status}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminDeliveryMap;
