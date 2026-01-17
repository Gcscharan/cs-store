import { motion } from "framer-motion";

interface DeliveryListItemProps {
  order: {
    _id: string;
    items: Array<{
      name: string;
      qty: number;
      price: number;
    }>;
    totalAmount: number;
    address: {
      label: string;
      addressLine: string;
      city: string;
      pincode: string;
    };
    orderStatus: string;
    createdAt: string;
    deliveryBoy?: {
      name: string;
      phone: string;
      vehicleType: string;
    };
  };
  onStatusUpdate?: (orderId: string, status: string) => void;
  showActions?: boolean;
}

const DeliveryListItem = ({
  order,
  onStatusUpdate,
  showActions = false,
}: DeliveryListItemProps) => {
  const toCustomerStatus = (status: string) => {
    switch (String(status || "").toLowerCase()) {
      case "created":
      case "pending":
        return "Order placed";
      case "confirmed":
        return "Order confirmed";
      case "packed":
      case "assigned":
      case "picked_up":
        return "Shipped";
      case "in_transit":
        return "Out for delivery";
      case "delivered":
        return "Delivered";
      case "cancelled":
      case "failed":
        return "Cancelled";
      default:
        return "Order update";
    }
  };

  const getStatusColor = (status: string) => {
    if (!showActions) {
      const customer = toCustomerStatus(status);
      switch (customer) {
        case "Order placed":
          return "bg-gray-100 text-gray-800";
        case "Order confirmed":
          return "bg-blue-100 text-blue-800";
        case "Shipped":
          return "bg-indigo-100 text-indigo-800";
        case "Out for delivery":
          return "bg-purple-100 text-purple-800";
        case "Delivered":
          return "bg-green-100 text-green-800";
        case "Cancelled":
          return "bg-red-100 text-red-800";
        default:
          return "bg-gray-100 text-gray-800";
      }
    }

    switch (status) {
      case "created":
        return "bg-gray-100 text-gray-800";
      case "assigned":
        return "bg-blue-100 text-blue-800";
      case "picked_up":
        return "bg-yellow-100 text-yellow-800";
      case "in_transit":
        return "bg-purple-100 text-purple-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    if (!showActions) {
      return toCustomerStatus(status);
    }

    switch (status) {
      case "created":
        return "Order Created";
      case "assigned":
        return "Assigned to Driver";
      case "picked_up":
        return "Picked Up";
      case "in_transit":
        return "In Transit";
      case "delivered":
        return "Delivered";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">
            Order #{order._id.slice(-8)}
          </h3>
          <p className="text-sm text-gray-600">
            {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(order.orderStatus)}`}
        >
          {getStatusText(order.orderStatus)}
        </span>
      </div>

      {/* Order Items */}
      <div className="mb-3">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Items:</h4>
        <div className="space-y-1">
          {order.items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span className="text-gray-600">
                {item.name} × {item.qty}
              </span>
              <span className="font-medium">
                ₹{(item.price * item.qty).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center mt-2 pt-2 border-t">
          <span className="font-semibold text-gray-900">Total:</span>
          <span className="font-bold text-lg">
            ₹{order.totalAmount.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Delivery Address */}
      <div className="mb-3">
        <h4 className="text-sm font-medium text-gray-700 mb-1">
          Delivery Address:
        </h4>
        <p className="text-sm text-gray-600">
          {order.address.label}: {order.address.addressLine},{" "}
          {order.address.city} - {order.address.pincode}
        </p>
      </div>

      {/* Delivery Boy Info */}
      {order.deliveryBoy && (
        <div className="mb-3">
          <h4 className="text-sm font-medium text-gray-700 mb-1">
            Delivery Boy:
          </h4>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-semibold text-primary-600">
                {order.deliveryBoy.name.charAt(0)}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {order.deliveryBoy.name}
              </p>
              <p className="text-xs text-gray-600">
                {order.deliveryBoy.vehicleType} • {order.deliveryBoy.phone}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {showActions && onStatusUpdate && (
        <div className="flex space-x-2 pt-3 border-t">
          {order.orderStatus === "assigned" && (
            <button
              onClick={() => onStatusUpdate(order._id, "picked_up")}
              className="flex-1 py-2 px-3 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 transition-colors"
            >
              Mark as Picked Up
            </button>
          )}
          {order.orderStatus === "picked_up" && (
            <button
              onClick={() => onStatusUpdate(order._id, "in_transit")}
              className="flex-1 py-2 px-3 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              Start Delivery
            </button>
          )}
          {order.orderStatus === "in_transit" && (
            <button
              onClick={() => onStatusUpdate(order._id, "delivered")}
              className="flex-1 py-2 px-3 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
            >
              Mark as Delivered
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default DeliveryListItem;
