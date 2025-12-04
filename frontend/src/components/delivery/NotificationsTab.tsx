import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { motion } from "framer-motion";
import {
  Bell,
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";

interface Notification {
  _id: string;
  type: "order_assigned" | "order_completed" | "payment_received" | "system";
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  orderId?: string;
}

const NotificationsTab: React.FC = () => {
  const { tokens } = useSelector((state: RootState) => state.auth);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch("/api/delivery/notifications", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        // If endpoint doesn't exist, use mock data
        const mockNotifications: Notification[] = [
          {
            _id: "1",
            type: "order_assigned",
            title: "New Order Assigned",
            message: "You have been assigned Order #12345 for delivery",
            isRead: false,
            createdAt: new Date().toISOString(),
            orderId: "12345",
          },
          {
            _id: "2",
            type: "payment_received",
            title: "Payment Received",
            message: "₹150 has been credited to your account for Order #12344",
            isRead: true,
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            _id: "3",
            type: "system",
            title: "System Update",
            message: "New features have been added to the delivery app",
            isRead: true,
            createdAt: new Date(Date.now() - 7200000).toISOString(),
          },
        ];
        setNotifications(mockNotifications);
        return;
      }

      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
      // Use mock data on error
      const mockNotifications: Notification[] = [
        {
          _id: "1",
          type: "order_assigned",
          title: "New Order Assigned",
          message: "You have been assigned Order #12345 for delivery",
          isRead: false,
          createdAt: new Date().toISOString(),
          orderId: "12345",
        },
      ];
      setNotifications(mockNotifications);
    } finally {
      setIsLoading(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "order_assigned":
        return <Package className="h-5 w-5 text-blue-600" />;
      case "order_completed":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "payment_received":
        return <Bell className="h-5 w-5 text-yellow-600" />;
      case "system":
        return <AlertCircle className="h-5 w-5 text-purple-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const markAsRead = (notificationId: string) => {
    setNotifications((prev) =>
      prev.map((notification) =>
        notification._id === notificationId
          ? { ...notification, isRead: true }
          : notification
      )
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 pb-20">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200"
      >
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Bell className="h-6 w-6 mr-2 text-blue-600" />
            Notifications
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Stay updated with your delivery assignments and earnings
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {notifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification._id}
                className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                  !notification.isRead ? "bg-blue-50" : ""
                }`}
                onClick={() => markAsRead(notification._id)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p
                        className={`font-medium ${
                          !notification.isRead
                            ? "text-gray-900"
                            : "text-gray-700"
                        }`}
                      >
                        {notification.title}
                      </p>
                      <div className="flex items-center text-xs text-gray-500">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(notification.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {notification.message}
                    </p>
                    {!notification.isRead && (
                      <div className="mt-2">
                        <span className="inline-block w-2 h-2 bg-blue-600 rounded-full"></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default NotificationsTab;
