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
import { useNavigate } from "react-router-dom";

const WaysToEarnPage: React.FC = () => {
  const navigate = useNavigate();

  const earningMethods = [
    {
      icon: DollarSign,
      title: "Base Delivery Fee",
      description: "Earn ₹25-50 per delivery based on distance",
      amount: "₹25-50",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      icon: Star,
      title: "Peak Hours Bonus",
      description: "Extra ₹15 during rush hours (6-9 PM)",
      amount: "+₹15",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      icon: TrendingUp,
      title: "Performance Bonus",
      description: "₹100 bonus for 95%+ on-time delivery rate",
      amount: "+₹100",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      icon: Gift,
      title: "Customer Tips",
      description: "Keep 100% of customer tips",
      amount: "100%",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      icon: Clock,
      title: "Weekend Bonus",
      description: "Extra ₹20 per delivery on weekends",
      amount: "+₹20",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      icon: Target,
      title: "Monthly Target",
      description: "₹500 bonus for 100+ deliveries per month",
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
            <h1 className="text-xl font-bold text-gray-900">Ways to Earn</h1>
            <p className="text-sm text-gray-600">
              Maximize your delivery earnings
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
            Pro Tips to Maximize Earnings
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>Stay online during peak hours (6-9 PM) for bonus pay</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>Maintain high customer ratings to get priority orders</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>Work weekends for additional bonus opportunities</p>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
              <p>Complete deliveries quickly to increase daily volume</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default WaysToEarnPage;
