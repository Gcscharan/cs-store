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
import { useNavigate } from "react-router-dom";

const HelpSupportPage: React.FC = () => {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqs = [
    {
      question: "How do I get started as a delivery partner?",
      answer:
        "Simply sign up with your details, complete the verification process, and start accepting delivery requests. Make sure to keep your profile updated and maintain a good rating.",
    },
    {
      question: "What are the payment terms?",
      answer:
        "Payments are processed weekly every Monday. You can track your earnings in the Earnings tab and withdraw to your bank account.",
    },
    {
      question: "How do I handle customer complaints?",
      answer:
        "Always be polite and professional. If you encounter any issues, contact our support team immediately. We're here to help resolve any problems.",
    },
    {
      question: "What if I can't find the delivery address?",
      answer:
        "Use the in-app navigation or call the customer directly. If you're still unable to locate the address, contact our support team for assistance.",
    },
    {
      question: "How do I update my availability?",
      answer:
        "Use the online/offline toggle in the app to update your availability status. You can also set your working hours in the Settings section.",
    },
    {
      question: "What safety measures should I follow?",
      answer:
        "Always wear a helmet, follow traffic rules, keep your phone charged, and inform someone about your delivery routes. In case of emergency, use the emergency contacts in the app.",
    },
  ];

  const contactMethods = [
    {
      icon: Phone,
      title: "Call Support",
      description: "Speak directly with our support team",
      action: "Call +91-800-123-4567",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      icon: Mail,
      title: "Email Support",
      description: "Send us an email and we'll respond within 24 hours",
      action: "support@csstore.com",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      icon: MessageCircle,
      title: "Live Chat",
      description: "Chat with our support team in real-time",
      action: "Start Chat",
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
      alert("Live chat feature coming soon!");
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
            <h1 className="text-xl font-bold text-gray-900">Help & Support</h1>
            <p className="text-sm text-gray-600">
              Get help and contact our support team
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
            Contact Support
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
            Frequently Asked Questions
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
            Quick Tips
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>Keep your phone charged and have a power bank handy</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>Always confirm the order details with the customer</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>Take photos of delivered orders for your records</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>Report any issues immediately to our support team</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default HelpSupportPage;
