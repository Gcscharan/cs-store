import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Settings,
  Bell,
  Moon,
  Sun,
  Shield,
  MapPin,
  Clock,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const DeliverySettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [notifications, setNotifications] = useState({
    newOrders: true,
    earnings: true,
    updates: true,
    alerts: true,
  });

  const settingsSections = [
    {
      title: "Notifications",
      icon: Bell,
      items: [
        {
          label: "New Orders",
          description: "Get notified about new delivery requests",
          type: "toggle",
          value: notifications.newOrders,
          onChange: (value: boolean) =>
            setNotifications((prev) => ({ ...prev, newOrders: value })),
        },
        {
          label: "Earnings Updates",
          description: "Receive updates about your earnings",
          type: "toggle",
          value: notifications.earnings,
          onChange: (value: boolean) =>
            setNotifications((prev) => ({ ...prev, earnings: value })),
        },
        {
          label: "App Updates",
          description: "Get notified about app updates and new features",
          type: "toggle",
          value: notifications.updates,
          onChange: (value: boolean) =>
            setNotifications((prev) => ({ ...prev, updates: value })),
        },
        {
          label: "Emergency Alerts",
          description: "Important safety and weather alerts",
          type: "toggle",
          value: notifications.alerts,
          onChange: (value: boolean) =>
            setNotifications((prev) => ({ ...prev, alerts: value })),
        },
      ],
    },
    {
      title: "Appearance",
      icon: isDarkMode ? Moon : Sun,
      items: [
        {
          label: "Dark Mode",
          description: "Switch between light and dark themes",
          type: "toggle",
          value: isDarkMode,
          onChange: setIsDarkMode,
        },
      ],
    },
    {
      title: "Location & Safety",
      icon: Shield,
      items: [
        {
          label: "Location Services",
          description: "Allow app to access your location for deliveries",
          type: "navigation",
          action: () => alert("Location settings coming soon"),
        },
        {
          label: "Emergency Contacts",
          description: "Manage your emergency contact information",
          type: "navigation",
          action: () => alert("Emergency contacts coming soon"),
        },
        {
          label: "Safety Tips",
          description: "View safety guidelines and tips",
          type: "navigation",
          action: () => alert("Safety tips coming soon"),
        },
      ],
    },
    {
      title: "Working Hours",
      icon: Clock,
      items: [
        {
          label: "Set Availability",
          description: "Configure your working hours and availability",
          type: "navigation",
          action: () => alert("Working hours coming soon"),
        },
        {
          label: "Auto-Offline",
          description: "Automatically go offline after work hours",
          type: "navigation",
          action: () => alert("Auto-offline coming soon"),
        },
      ],
    },
  ];

  const handleToggle = (
    onChange: (value: boolean) => void,
    currentValue: boolean
  ) => {
    onChange(!currentValue);
  };

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
          <div>
            <h1 className="text-xl font-bold text-gray-900">Settings</h1>
            <p className="text-sm text-gray-600">
              Customize your app experience
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 pb-20">
        {settingsSections.map((section, sectionIndex) => (
          <motion.div
            key={sectionIndex}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIndex * 0.1 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-6 overflow-hidden"
          >
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <section.icon className="h-5 w-5 mr-2 text-blue-600" />
                {section.title}
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {section.items.map((item, itemIndex) => (
                <div key={itemIndex} className="p-4">
                  {item.type === "toggle" ? (
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">
                          {item.label}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {item.description}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          handleToggle(item.onChange!, item.value as boolean)
                        }
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                          item.value ? "bg-blue-500" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            item.value ? "translate-x-6" : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={item.action}
                      className="w-full flex items-center justify-between group hover:bg-gray-50 p-2 -m-2 rounded-lg transition-colors"
                    >
                      <div className="flex-1 text-left">
                        <h4 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {item.label}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {item.description}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        ))}

        {/* App Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Settings className="h-5 w-5 mr-2 text-gray-600" />
            App Information
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex justify-between items-center py-2">
              <span className="font-medium">Version</span>
              <span className="bg-gray-100 px-2 py-1 rounded-full text-xs">
                1.0.0
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-medium">Last Updated</span>
              <span className="text-gray-500">
                {new Date().toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-medium">Platform</span>
              <span className="text-gray-500">Web App</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="font-medium">Storage Used</span>
              <span className="text-gray-500">12.5 MB</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default DeliverySettingsPage;
