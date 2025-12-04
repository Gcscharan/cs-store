import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Shield,
  Lock,
  Trash2,
  Download,
  HelpCircle,
  Eye,
  EyeOff,
  X,
  ArrowLeft,
} from "lucide-react";
import toast from "react-hot-toast";
import { logout } from "../store/slices/authSlice";
import { useCurrency } from "../contexts/CurrencyContext";
import { useLanguage } from "../contexts/LanguageContext";
import SkeletonLoader from "../components/SkeletonLoader";

// RTK Query — Notification Preferences + Profile
import {
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useGetProfileQuery,
  useChangePasswordMutation,
  useDeleteAccountMutation,
} from "../store/api";

const SettingsPage: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );

  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState({
    old: false,
    new: false,
    confirm: false,
  });

  // RTK Query (Profile)
  const { data: _profile } = useGetProfileQuery(undefined, {
    skip: !isAuthenticated,
  });

  // RTK Query (Notification Preferences)
  const {
    data: prefs,
    isLoading: loadingPrefs,
    refetch: _refetchPrefs,
  } = useGetNotificationPreferencesQuery(undefined, {
    skip: !isAuthenticated,
  });

  const [updatePreferences] = useUpdateNotificationPreferencesMutation();
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation();
  const [deleteAccount, { isLoading: isDeleting }] = useDeleteAccountMutation();
  
  const { currency, setCurrency } = useCurrency();
  const { language, setLanguage } = useLanguage();

  const [notifications, setNotifications] = useState({
    orderUpdates: true,
    promotions: false,
    newsletter: true,
    sms: true,
  });

  useEffect(() => {
    if (prefs) {
      setNotifications({
        orderUpdates: prefs.orderUpdates ?? true,
        promotions: prefs.promotions ?? false,
        newsletter: prefs.newsletter ?? true,
        sms: prefs.sms ?? true,
      });
    }
  }, [prefs]);

  const handleNotificationToggle = async (key: keyof typeof notifications) => {
    const newNotifications = { ...notifications, [key]: !notifications[key] };
    setNotifications(newNotifications);
    
    try {
      await updatePreferences(newNotifications).unwrap();
      toast.success("Notification preferences updated");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to update preferences");
      // Revert on error
      setNotifications(notifications);
    }
  };

  // PASSWORD CHANGE LOGIC
  const togglePasswordVisibility = (key: "old" | "new" | "confirm") => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handlePasswordSubmit = async () => {
    const { oldPassword, newPassword, confirmPassword } = passwordData;

    if (!oldPassword || !newPassword) {
      toast.error("All fields are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }

    try {
      await changePassword({
        currentPassword: oldPassword,
        newPassword,
      }).unwrap();
      
      toast.success("Password changed successfully");
      setShowPasswordModal(false);
      setPasswordData({ oldPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to change password");
    }
  };

  // LOGOUT HANDLER
  const handleLogout = () => {
    const ok = window.confirm("Are you sure you want to logout?");
    if (!ok) return;

    // Clear all local storage and session data
    localStorage.clear();
    sessionStorage.clear();
    
    // Dispatch logout action
    dispatch(logout());
    
    // Redirect to home
    navigate("/");
    toast.success("Logged out successfully");
  };

  // DELETE ACCOUNT
  const handleAccountDeletion = async () => {
    const ok = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data."
    );
    if (!ok) return;

    try {
      await deleteAccount(undefined).unwrap();
      toast.success("Account deleted successfully");
      
      // Clear all local storage and session data
      localStorage.clear();
      sessionStorage.clear();
      
      // Dispatch logout action
      dispatch(logout());
      
      // Redirect to home
      navigate("/");
    } catch (err: any) {
      toast.error(err?.data?.message || "Failed to delete account");
    }
  };

  // Show skeleton loaders while loading initial data
  if (loadingPrefs) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <SkeletonLoader variant="text" width="40%" />
              <div className="space-y-4 mt-4">
                <SkeletonLoader variant="rectangular" height={60} />
                <SkeletonLoader variant="rectangular" height={60} />
                <SkeletonLoader variant="rectangular" height={60} />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <SkeletonLoader variant="text" width="40%" />
              <div className="space-y-4 mt-4">
                <SkeletonLoader variant="rectangular" height={50} />
                <SkeletonLoader variant="rectangular" height={50} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // AUTH GUARD
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-6">
        <div>
          <h2 className="text-xl font-bold mb-2">Login Required</h2>
          <p className="mb-4 text-gray-600">
            Please log in to access your settings.
          </p>
          <button
            className="bg-blue-600 text-white px-6 py-3 rounded-lg"
            onClick={() => navigate("/login")}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white py-4 px-4 shadow-sm sticky top-0 z-10"
      >
        <div className="max-w-4xl mx-auto flex items-center space-x-4">
          <button
            onClick={() => navigate("/account")}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Settings
            </h1>
            <p className="text-sm text-gray-600">
              Manage your account preferences
            </p>
          </div>
        </div>
      </motion.div>

      {/* CONTENT */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* NOTIFICATION PREFERENCES */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Bell className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Notification Preferences</h2>
          </div>

          {loadingPrefs ? (
            <p className="text-sm text-gray-500">Loading preferences…</p>
          ) : (
            <div className="space-y-4">
              {[
                {
                  key: "orderUpdates",
                  label: "Order Updates",
                  desc: "Order status changes",
                },
                {
                  key: "promotions",
                  label: "Promotions",
                  desc: "Special offers & deals",
                },
                {
                  key: "newsletter",
                  label: "Newsletter",
                  desc: "Weekly updates",
                },
                {
                  key: "sms",
                  label: "SMS Notifications",
                  desc: "Delivery updates via SMS",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between py-3 border-b last:border-b-0"
                >
                  <div>
                    <h4 className="font-medium">{item.label}</h4>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications[item.key as keyof typeof notifications]}
                      onChange={() =>
                        handleNotificationToggle(
                          item.key as keyof typeof notifications
                        )
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 rounded-full peer-checked:bg-blue-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:h-5 after:w-5 after:rounded-full after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* APPEARANCE */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Eye className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Appearance</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <h4 className="font-medium">Language</h4>
                <p className="text-sm text-gray-500">Select your preferred language</p>
              </div>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="language-select"
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="te">తెలుగు</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <h4 className="font-medium">Currency</h4>
                <p className="text-sm text-gray-500">Display prices in your currency</p>
              </div>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as any)}
                className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="currency-select"
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>
        </div>

        {/* PRIVACY & SECURITY */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Privacy & Security</h2>
          </div>

          <div className="space-y-6">
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full flex items-center justify-between px-4 py-3 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center space-x-3">
                <Lock className="h-5 w-5 text-gray-600" />
                <span>Change Password</span>
              </div>
              <span className="text-gray-400">›</span>
            </button>

            <button className="w-full flex items-center justify-between px-4 py-3 border rounded-lg hover:bg-gray-50">
              <div className="flex items-center space-x-3">
                <Download className="h-5 w-5 text-gray-600" />
                <span>Download My Data</span>
              </div>
              <span className="text-gray-400">›</span>
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-4 py-3 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center space-x-3">
                <ArrowLeft className="h-5 w-5 text-gray-600" />
                <span>Logout</span>
              </div>
              <span className="text-gray-400">›</span>
            </button>
          </div>
        </div>

        {/* DANGER ZONE */}
        <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Trash2 className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-800">
              Danger Zone
            </h2>
          </div>
          <p className="text-gray-600 text-sm mb-4">
            Permanently delete your account and all associated data.
          </p>
          <button
            onClick={handleAccountDeletion}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            data-testid="delete-account-button"
          >
            {isDeleting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            <span>{isDeleting ? "Deleting..." : "Delete Account"}</span>
          </button>
        </div>

        {/* FOOTER HELP */}
        <div className="text-center mt-8">
          <div className="inline-flex items-center text-gray-600 space-x-2">
            <HelpCircle className="h-4 w-4" />
            <span>
              Need help? Visit our{" "}
              <a
                href="/help-support"
                className="text-blue-600 font-medium"
              >
                Help Center
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* PASSWORD CHANGE MODAL */}
      {showPasswordModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40 p-4"
        >
          <motion.div
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="bg-white p-6 rounded-xl w-full max-w-md shadow-xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Change Password</h3>
              <button
                className="p-2 hover:bg-gray-100 rounded-lg"
                onClick={() => setShowPasswordModal(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* FORM */}
            <div className="space-y-4">
              {/* OLD PASSWORD */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Current Password
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPasswords.old ? "text" : "password"}
                    value={passwordData.oldPassword}
                    onChange={(e) =>
                      setPasswordData((p) => ({
                        ...p,
                        oldPassword: e.target.value,
                      }))
                    }
                    className="w-full border px-3 py-2 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility("old")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPasswords.old ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* NEW PASSWORD */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  New Password
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPasswords.new ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) =>
                      setPasswordData((p) => ({
                        ...p,
                        newPassword: e.target.value,
                      }))
                    }
                    className="w-full border px-3 py-2 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility("new")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPasswords.new ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>

              {/* CONFIRM NEW PASSWORD */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Confirm New Password
                </label>
                <div className="relative mt-1">
                  <input
                    type={showPasswords.confirm ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) =>
                      setPasswordData((p) => ({
                        ...p,
                        confirmPassword: e.target.value,
                      }))
                    }
                    className="w-full border px-3 py-2 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility("confirm")}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showPasswords.confirm ? (
                      <EyeOff className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handlePasswordSubmit}
                disabled={isChangingPassword}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                data-testid="change-password-submit"
              >
                {isChangingPassword && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{isChangingPassword ? "Changing..." : "Change Password"}</span>
              </button>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default SettingsPage;