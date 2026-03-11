import React from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  DollarSign,
  Star,
  TrendingUp,
  Gift,
  Clock,
  Target,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import { useLanguage } from "../contexts/LanguageContext";

const WaysToEarnPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDeliveryRoute = location.pathname.startsWith("/delivery/");
  const [activeTab, setActiveTab] = React.useState("more");
  const { t } = useLanguage();

  const earningMethods = [
    {
      icon: DollarSign,
      title: t("earn.baseDeliveryFee"),
      description: t("earn.baseDeliveryFeeDesc"),
      amount: "₹25-50",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      icon: Star,
      title: t("earn.peakHoursBonus"),
      description: t("earn.peakHoursBonusDesc"),
      amount: "+₹15",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      icon: TrendingUp,
      title: t("earn.performanceBonus"),
      description: t("earn.performanceBonusDesc"),
      amount: "+₹100",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      icon: Gift,
      title: t("earn.customerTips"),
      description: t("earn.customerTipsDesc"),
      amount: "100%",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      icon: Clock,
      title: t("earn.weekendBonus"),
      description: t("earn.weekendBonusDesc"),
      amount: "+₹20",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      icon: Target,
      title: t("earn.monthlyTarget"),
      description: t("earn.monthlyTargetDesc"),
      amount: "+₹500",
      color: "text-red-600",
      bgColor: "bg-red-50",
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
          <div>
            <h1 className="text-xl font-bold text-gray-900">{t("earn.title")}</h1>
            <p className="text-sm text-gray-600">
              {t("earn.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 pb-20">
        {/* Earning Methods */}
        <div className="space-y-4">
          {earningMethods.map((method, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
            >
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-xl ${method.bgColor}`}>
                  <method.icon className={`h-6 w-6 ${method.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {method.title}
                    </h3>
                    <span className={`text-lg font-bold ${method.color}`}>
                      {method.amount}
                    </span>
                  </div>
                  <p className="text-gray-600">{method.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tips Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mt-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2 text-blue-600" />
            {t("earn.proTips")}
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>{t("earn.tip1")}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>{t("earn.tip2")}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>{t("earn.tip3")}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>{t("earn.tip4")}</p>
            </div>
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

export default WaysToEarnPage;
