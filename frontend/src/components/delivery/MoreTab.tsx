import React from "react";
import { motion } from "framer-motion";
import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  DollarSign,
  Users,
  MessageSquare,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { logout } from "../../store/slices/authSlice";

const MoreTab: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleLogout = () => {
    dispatch(logout());
    navigate("/delivery/login");
  };

  const menuItems = [
    {
      icon: User,
      label: "Profile",
      description: "Manage your personal information and password",
      action: () => navigate("/delivery/profile"),
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      icon: DollarSign,
      label: "Ways to Earn",
      description: "Tips, bonuses, and performance incentives",
      action: () => navigate("/delivery/earnings-info"),
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      icon: Users,
      label: "Refer and Earn",
      description: "Invite new delivery partners and earn rewards",
      action: () => navigate("/delivery/refer"),
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      icon: HelpCircle,
      label: "Help & Support",
      description: "FAQs, support resources, and contact info",
      action: () => navigate("/delivery/support"),
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      icon: MessageSquare,
      label: "Message Center",
      description: "Updates, alerts, and admin messages",
      action: () => navigate("/delivery/messages"),
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      icon: Settings,
      label: "Settings",
      description: "Notification preferences and app settings",
      action: () => navigate("/delivery/settings"),
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-4 pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className="text-2xl font-bold text-gray-900 mb-2">More</h2>
        <p className="text-gray-600">Manage your account and preferences</p>
      </motion.div>

      {/* Main Menu */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-6 overflow-hidden"
      >
        <div className="divide-y divide-gray-100">
          {menuItems.map((item, index) => (
            <motion.button
              key={index}
              onClick={item.action}
              className="w-full p-4 hover:bg-gray-50 transition-all duration-200 text-left group"
              whileHover={{ x: 4 }}
            >
              <div className="flex items-center space-x-4">
                <div
                  className={`p-3 rounded-xl ${item.bgColor} group-hover:scale-110 transition-transform duration-200`}
                >
                  <item.icon className={`h-6 w-6 ${item.color}`} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-lg">
                    {item.label}
                  </p>
                  <p className="text-sm text-gray-600">{item.description}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 transition-colors" />
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* App Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <FileText className="h-5 w-5 mr-2 text-gray-600" />
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
        </div>
      </motion.div>

      {/* Logout Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
      >
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center space-x-3 p-4 bg-gradient-to-r from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 text-red-600 rounded-xl transition-all duration-200 font-semibold group"
        >
          <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform" />
          <span>Logout</span>
        </button>
      </motion.div>
    </div>
  );
};

export default MoreTab;
