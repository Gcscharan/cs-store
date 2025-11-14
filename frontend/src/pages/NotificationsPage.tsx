import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { RootState } from "../store";
import NotificationsModal from "../components/NotificationsModal";

const NotificationsPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [showModal, setShowModal] = useState(true);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-4">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Login Required
            </h2>
            <p className="text-gray-600 mb-6">
              Please log in to access your notifications.
            </p>
          </div>
          <a
            href="/login"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  const handleClose = () => {
    setShowModal(false);
    navigate("/account");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Back Navigation */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white py-4 px-4 shadow-sm sticky top-0 z-10"
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate("/account")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back to account"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
              <p className="text-sm text-gray-600">Manage your notifications and preferences</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Content area */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow-sm p-6"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Notification Center</h2>
          <p className="text-gray-600 mb-6">
            Stay updated with the latest information about your orders, offers, and account activities.
          </p>
          
          {/* Placeholder content - the actual notifications are handled by the modal */}
          <div className="space-y-4">
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Recent Notifications</h3>
              <p className="text-gray-600 text-sm">
                Your recent notifications will appear here. Click anywhere to view and manage all notifications.
              </p>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Notification Preferences</h3>
              <p className="text-gray-600 text-sm">
                Customize how you receive notifications for orders, promotions, and account updates.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Render the notifications modal */}
      {showModal && <NotificationsModal onClose={handleClose} />}
    </div>
  );
};

export default NotificationsPage;
