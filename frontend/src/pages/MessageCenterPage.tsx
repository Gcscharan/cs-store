import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MessageSquare,
  Bell,
  AlertCircle,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import { formatNotificationCopy } from "../utils/notificationFormatter";

const MessageCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDeliveryRoute = location.pathname.startsWith("/delivery/");
  const { tokens } = useSelector((state: RootState) => state.auth);

  const [activeTab, setActiveTab] = useState("more");
  const [selectedTab, setSelectedTab] = useState<"all" | "updates" | "alerts">(
    "all"
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (!tokens?.accessToken) {
          setMessages([]);
          setError("Authentication required");
          return;
        }

        const endpoint = isDeliveryRoute ? "/api/delivery/messages" : "/api/notifications";
        const response = await fetch(endpoint, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });

        if (!response.ok) {
          const text = await response.text();
          let message = `Failed to load messages (${response.status})`;
          try {
            const parsed = JSON.parse(text);
            message = parsed.error || parsed.message || message;
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        const data = await response.json();
        const list =
          (isDeliveryRoute ? data.messages : data.notifications) || [];
        setMessages(Array.isArray(list) ? list : []);
      } catch (e) {
        setMessages([]);
        setError(e instanceof Error ? e.message : "Failed to load messages");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMessages();
  }, [isDeliveryRoute, tokens?.accessToken]);

  const normalizedMessages = useMemo(() => {
    return messages.map((m) => {
      const createdAt = m.createdAt ? new Date(m.createdAt) : null;
      const type =
        m.type === "delivery_otp" ? "alert" :
        m.type === "order_update" ? "update" :
        "update";

      const icon =
        type === "alert" ? AlertCircle :
        type === "update" ? Bell :
        Bell;

      const color = type === "alert" ? "text-orange-600" : "text-blue-600";
      const bgColor = type === "alert" ? "bg-orange-50" : "bg-blue-50";

      const formatted = formatNotificationCopy({
        eventType: m?.eventType,
        meta: m?.meta,
        fallbackTitle: m?.title || "Message",
        fallbackBody: m?.body || m?.message || m?.content || "",
      });

      return {
        id: m._id || m.id,
        type,
        title: formatted.title,
        content: formatted.body,
        timestamp: createdAt ? createdAt.toLocaleString() : "",
        read: Boolean(m.isRead ?? m.read),
        icon,
        color,
        bgColor,
      };
    });
  }, [messages]);

  const filteredMessages = normalizedMessages.filter((message) => {
    if (selectedTab === "all") return true;
    return message.type === selectedTab;
  });

  const unreadCount = normalizedMessages.filter((msg) => !msg.read).length;

  const tabs = [
    { id: "all", label: "All Messages", count: normalizedMessages.length },
    {
      id: "updates",
      label: "Updates",
      count: normalizedMessages.filter((m) => m.type === "update").length,
    },
    {
      id: "alerts",
      label: "Alerts",
      count: normalizedMessages.filter((m) => m.type === "alert").length,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">Message Center</h1>
            <p className="text-sm text-gray-600">
              {unreadCount > 0
                ? `${unreadCount} unread messages`
                : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              {unreadCount}
            </div>
          )}
        </div>
      </div>

      <div className="p-4 pb-20">
        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-2 mb-6"
        >
          <div className="flex space-x-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl transition-all duration-200 ${
                  selectedTab === tab.id
                    ? "bg-blue-500 text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="font-medium">{tab.label}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    selectedTab === tab.id
                      ? "bg-white/20 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Messages */}
        <div className="space-y-4">
          {isLoading ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center"
            >
              <p className="text-gray-600">Loading messages...</p>
            </motion.div>
          ) : error ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center"
            >
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Failed to Load Messages
              </h3>
              <p className="text-gray-600">{error}</p>
            </motion.div>
          ) : filteredMessages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center"
            >
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Messages
              </h3>
              <p className="text-gray-600">
                You're all caught up! Check back later for updates.
              </p>
            </motion.div>
          ) : (
            filteredMessages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-white rounded-2xl shadow-lg border border-gray-100 p-6 ${
                  !message.read ? "ring-2 ring-blue-100" : ""
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div
                    className={`p-3 rounded-xl ${message.bgColor} flex-shrink-0`}
                  >
                    <message.icon className={`h-6 w-6 ${message.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <h3
                        className={`font-semibold text-gray-900 ${
                          !message.read ? "font-bold" : ""
                        }`}
                      >
                        {message.title}
                      </h3>
                      {!message.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                      )}
                    </div>
                    <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                      {message.content}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{message.timestamp}</span>
                      </div>
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          message.type === "update"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {message.type === "update" ? "Update" : "Alert"}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mt-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <button className="flex flex-col items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
              <Bell className="h-6 w-6 text-gray-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">
                Mark All Read
              </span>
            </button>
            <button className="flex flex-col items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
              <MessageSquare className="h-6 w-6 text-gray-600 mb-2" />
              <span className="text-sm font-medium text-gray-900">
                Contact Support
              </span>
            </button>
          </div>
        </motion.div>
      </div>

      {isDeliveryRoute && (
        <DeliveryBottomNav
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            navigate("/delivery");
          }}
        />
      )}
    </div>
  );
};

export default MessageCenterPage;
