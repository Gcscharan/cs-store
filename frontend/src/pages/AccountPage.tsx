import { useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Settings,
  Bell,
  HelpCircle,
  LogOut,
  CreditCard,
  Globe,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { RootState } from "../store";
import { useLogout } from "../hooks/useLogout";
import { useLanguage } from "../contexts/LanguageContext";
import { useGetProfileQuery } from "../store/api";

const AccountPage = () => {
  const navigate = useNavigate();
  const performLogout = useLogout();
  const { user, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );
  
  // Fetch fresh profile data from MongoDB
  const { data: fetchedProfile } = useGetProfileQuery(undefined, {
    skip: !isAuthenticated,
  });
  
  const { t } = useLanguage();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Theme toggle removed - application is now light mode only

  const handleOptionClick = (option: string) => {
    setActiveSection(option);

    switch (option) {
      case t("account.profile"):
        navigate("/account/profile/edit");
        break;
      case t("account.orders"):
        navigate("/orders");
        break;
      case t("account.settings"):
        navigate("/account/settings");
        break;
      case t("account.notifications"):
        navigate("/account/notifications");
        break;
      case t("account.language"):
        navigate("/account/settings");
        break;
      case t("account.help"):
        navigate("/help-support");
        break;
      case t("account.logout"):
        performLogout(); // Fire and forget - redirect will handle the rest
        break;
      default:
        console.log(`Unknown option: ${option}`);
    }
  };




  const accountOptions = [
    {
      icon: User,
      label: t("account.profile"),
      description: t("account.profile.description"),
      action: "edit",
    },
    {
      icon: CreditCard,
      label: t("account.orders"),
      description: t("account.orders.description"),
      action: "navigate",
    },
    {
      icon: Settings,
      label: t("account.settings"),
      description: t("account.settings.description"),
      action: "settings",
    },
    {
      icon: Bell,
      label: t("account.notifications"),
      description: t("account.notifications.description"),
      action: "notifications",
    },
    {
      icon: Globe,
      label: t("account.language"),
      description: t("account.language.description"),
      action: "language",
    },
    {
      icon: HelpCircle,
      label: t("account.help"),
      description: t("account.help.description"),
      action: "help",
    },
    // Only show logout option if user is authenticated
    ...(isAuthenticated
      ? [
          {
            icon: LogOut,
            label: t("account.logout"),
            description: t("account.logout.description"),
            action: "logout",
            className: "text-red-600 hover:text-red-700",
          },
        ]
      : []),
  ];

  // If user is not authenticated, show a message that OTP modal should appear
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-gray-600 mb-4">
            You need to be logged in to access this page. The OTP login modal
            should appear automatically.
          </p>
          <p className="text-sm text-gray-500">
            If the modal doesn't appear, please refresh the page or check the
            console for errors.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white py-6 px-4 shadow-sm"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("account.title")}
          </h1>
          <p className="text-gray-600 mt-2">
            {isAuthenticated && fetchedProfile
              ? `Welcome back, ${fetchedProfile.name}!`
              : t("account.welcome")}
          </p>
        </div>
      </motion.div>

      {/* Welcome Message */}
      {isAuthenticated && user && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-blue-50 to-indigo-50 py-8 px-4"
        >
          <div className="max-w-7xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome, {fetchedProfile?.name || user?.email || 'User'}!
            </h2>
            <p className="text-lg text-gray-600">
              Manage your account settings and preferences
            </p>
          </div>
        </motion.div>
      )}



      {/* Account Options */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="py-6 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <div className="space-y-4">
            {accountOptions.map((option, index) => (
              <motion.div
                key={option.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index }}
                className={`bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
                  activeSection === option.label
                    ? "ring-2 ring-blue-500 bg-blue-50"
                    : ""
                } ${option.className || ""}`}
                onClick={() => handleOptionClick(option.label)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleOptionClick(option.label);
                  }
                }}
              >
                <div className="flex items-center space-x-4">
                  {option.label !== "Logout" && (
                    <div
                      className={`p-2 rounded-lg ${
                        activeSection === option.label
                          ? "bg-blue-200"
                          : "bg-blue-100"
                      }`}
                    >
                      <option.icon
                        className={`h-6 w-6 ${
                          activeSection === option.label
                            ? "text-blue-700"
                            : "text-blue-600"
                        }`}
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3
                      className={`text-lg font-semibold ${
                        option.label === "Logout"
                          ? "text-red-600"
                          : "text-gray-900"
                      }`}
                    >
                      {option.label}
                    </h3>
                    <p className="text-gray-600 text-sm">
                      {option.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AccountPage;
