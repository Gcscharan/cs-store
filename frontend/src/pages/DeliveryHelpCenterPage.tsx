import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  HelpCircle,
  DollarSign,
  Calendar,
  CreditCard,
  LogOut,
} from "lucide-react";

const DeliveryHelpCenterPage: React.FC = () => {
  const navigate = useNavigate();

  const issueOptions = [
    {
      id: "order-earning",
      title: "Order Earning Issue",
      description: "Problems with order payments and earnings",
      icon: DollarSign,
      color: "bg-green-50 text-green-600",
      hoverColor: "hover:bg-green-100",
    },
    {
      id: "daily-incentive",
      title: "Daily Incentive Issue",
      description: "Issues with daily bonuses and incentives",
      icon: Calendar,
      color: "bg-blue-50 text-blue-600",
      hoverColor: "hover:bg-blue-100",
    },
    {
      id: "incentives-payout",
      title: "Incentives & Payout Issue",
      description: "Problems with incentives and payment processing",
      icon: CreditCard,
      color: "bg-purple-50 text-purple-600",
      hoverColor: "hover:bg-purple-100",
    },
    {
      id: "leave-cs-store",
      title: "I Want to Leave CS Store",
      description: "Information about leaving the delivery partner program",
      icon: LogOut,
      color: "bg-red-50 text-red-600",
      hoverColor: "hover:bg-red-100",
    },
  ];

  const handleIssueClick = (issueId: string) => {
    // For now, show an alert. In the future, this can navigate to specific issue pages
    const issue = issueOptions.find((opt) => opt.id === issueId);
    alert(`Opening ${issue?.title} form. This feature will be available soon!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/delivery")}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back to Dashboard</span>
          </button>
          <div className="flex items-center space-x-2">
            <HelpCircle className="h-6 w-6 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-900">Help Center</h1>
          </div>
          <div className="w-20"></div> {/* Spacer for centering */}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-4xl mx-auto"
        >
          {/* Page Title */}
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Delivery Partner Help Center
            </h2>
            <p className="text-gray-600 text-lg">
              Get help with your delivery partner account and resolve issues
              quickly
            </p>
          </div>

          {/* Raise a New Issue Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-2xl shadow-lg p-8"
          >
            <div className="text-center mb-8">
              <div className="p-4 bg-blue-50 rounded-full w-fit mx-auto mb-4">
                <HelpCircle className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                Raise a New Issue
              </h3>
              <p className="text-gray-600">
                Select the type of issue you're experiencing to get the right
                help
              </p>
            </div>

            {/* Issue Options Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {issueOptions.map((option, index) => {
                const IconComponent = option.icon;
                return (
                  <motion.button
                    key={option.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + index * 0.1 }}
                    onClick={() => handleIssueClick(option.id)}
                    className={`p-6 rounded-xl border-2 border-gray-100 ${option.hoverColor} transition-all duration-200 text-left group hover:shadow-lg hover:border-gray-200`}
                  >
                    <div className="flex items-start space-x-4">
                      <div
                        className={`p-3 rounded-lg ${option.color} group-hover:scale-110 transition-transform duration-200`}
                      >
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-gray-700">
                          {option.title}
                        </h4>
                        <p className="text-sm text-gray-600 group-hover:text-gray-500">
                          {option.description}
                        </p>
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>

          {/* Additional Help Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-8 bg-white rounded-2xl shadow-lg p-6"
          >
            <h3 className="text-xl font-semibold text-gray-900 mb-4 text-center">
              Need Immediate Help?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">
                  Emergency Support
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  For urgent safety or emergency issues
                </p>
                <button
                  onClick={() => navigate("/delivery/emergency")}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  Go to Emergency Page
                </button>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">
                  Contact Support
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Call our support team directly
                </p>
                <a
                  href="tel:9391795162"
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  +91 9391795162
                </a>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default DeliveryHelpCenterPage;
