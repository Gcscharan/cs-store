import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  HelpCircle,
  Phone,
  Mail,
  MessageCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import { useLanguage } from "../contexts/LanguageContext";

const HelpSupportPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDeliveryRoute = location.pathname.startsWith("/delivery/");
  const [activeTab, setActiveTab] = useState("more");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const { t } = useLanguage();

  const faqs = [
    {
      question: t("help.faq1Q"),
      answer: t("help.faq1A"),
    },
    {
      question: t("help.faq2Q"),
      answer: t("help.faq2A"),
    },
    {
      question: t("help.faq3Q"),
      answer: t("help.faq3A"),
    },
    {
      question: t("help.faq4Q"),
      answer: t("help.faq4A"),
    },
    {
      question: t("help.faq5Q"),
      answer: t("help.faq5A"),
    },
    {
      question: t("help.faq6Q"),
      answer: t("help.faq6A"),
    },
  ];

  const contactMethods = [
    {
      icon: Phone,
      title: t("help.callSupport"),
      description: t("help.callSupportDesc"),
      action: t("help.callNumber"),
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      icon: Mail,
      title: t("help.emailSupport"),
      description: t("help.emailSupportDesc"),
      action: "support@csstore.com",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      icon: MessageCircle,
      title: t("help.liveChat"),
      description: t("help.liveChatDesc"),
      action: t("help.startChat"),
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  const handleContactAction = (action: string) => {
    if (action.startsWith("Call")) {
      window.location.href = "tel:+918001234567";
    } else if (action.startsWith("support@")) {
      window.location.href = "mailto:support@csstore.com";
    } else {
      alert(t("help.chatComingSoon"));
    }
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
            <h1 className="text-xl font-bold text-gray-900">{t("help.title")}</h1>
            <p className="text-sm text-gray-600">
              {t("help.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 pb-20">
        {/* Contact Methods */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <HelpCircle className="h-5 w-5 mr-2 text-blue-600" />
            {t("help.contactSupport")}
          </h3>
          <div className="space-y-4">
            {contactMethods.map((method, index) => (
              <motion.button
                key={index}
                onClick={() => handleContactAction(method.action)}
                className="w-full p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left group"
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`p-3 rounded-xl ${method.bgColor} group-hover:scale-110 transition-transform`}
                  >
                    <method.icon className={`h-6 w-6 ${method.color}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {method.title}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {method.description}
                    </p>
                    <p className="text-sm font-medium text-blue-600 mt-1">
                      {method.action}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t("help.faqTitle")}
          </h3>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-gray-200 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedFaq(expandedFaq === index ? null : index)
                  }
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium text-gray-900 pr-4">
                    {faq.question}
                  </span>
                  {expandedFaq === index ? (
                    <ChevronUp className="h-5 w-5 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500 flex-shrink-0" />
                  )}
                </button>
                {expandedFaq === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-4 pb-4"
                  >
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t("help.quickTips")}
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>{t("help.tip1")}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>{t("help.tip2")}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>{t("help.tip3")}</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>{t("help.tip4")}</p>
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

export default HelpSupportPage;
