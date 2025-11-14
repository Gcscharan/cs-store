import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MessageSquare,
  Bell,
  AlertCircle,
  CheckCircle,
  Clock,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const MessageCenterPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState<"all" | "updates" | "alerts">(
    "all"
  );

  const messages = [
    {
      id: 1,
      type: "update",
      title: "New Feature: Real-time Navigation",
      content:
        "We've added real-time navigation to help you find delivery addresses more easily. Update your app to access this feature.",
      timestamp: "2 hours ago",
      read: false,
      icon: Bell,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      id: 2,
      type: "alert",
      title: "Peak Hours Bonus Active",
      content:
        "Earn extra ₹15 per delivery during peak hours (6-9 PM) today. Make sure to stay online!",
      timestamp: "4 hours ago",
      read: false,
      icon: AlertCircle,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      id: 3,
      type: "update",
      title: "Weekly Performance Report",
      content:
        "Great job this week! You completed 25 deliveries with a 98% on-time rate. Keep up the excellent work!",
      timestamp: "1 day ago",
      read: true,
      icon: Star,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      id: 4,
      type: "alert",
      title: "Weather Alert",
      content:
        "Heavy rain expected in your area. Please drive safely and consider taking breaks if needed.",
      timestamp: "2 days ago",
      read: true,
      icon: AlertCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      id: 5,
      type: "update",
      title: "Payment Processed",
      content:
        "Your weekly earnings of ₹1,250 have been processed and will reflect in your account within 24 hours.",
      timestamp: "3 days ago",
      read: true,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
  ];

  const filteredMessages = messages.filter((message) => {
    if (selectedTab === "all") return true;
    return message.type === selectedTab;
  });

  const unreadCount = messages.filter((msg) => !msg.read).length;

  const tabs = [
    { id: "all", label: "All Messages", count: messages.length },
    {
      id: "updates",
      label: "Updates",
      count: messages.filter((m) => m.type === "update").length,
    },
    {
      id: "alerts",
      label: "Alerts",
      count: messages.filter((m) => m.type === "alert").length,
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
          {filteredMessages.length === 0 ? (
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
    </div>
  );
};

export default MessageCenterPage;
