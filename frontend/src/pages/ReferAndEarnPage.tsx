import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Copy,
  Share2,
  Gift,
  CheckCircle,
  Star,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const ReferAndEarnPage: React.FC = () => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const referralCode = "DELIVER2024";
  const referralLink = `https://csstore.com/refer/${referralCode}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: "Join CS Store as a Delivery Partner",
        text: "Earn money by delivering orders! Use my referral code: DELIVER2024",
        url: referralLink,
      });
    } else {
      handleCopyLink();
    }
  };

  const rewards = [
    {
      icon: Gift,
      title: "Referral Bonus",
      description:
        "Get ₹200 when your referral completes their first 10 deliveries",
      amount: "₹200",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      icon: Star,
      title: "Performance Bonus",
      description:
        "Earn ₹50 for each active referral who maintains 90%+ rating",
      amount: "₹50/month",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      icon: Users,
      title: "Team Leader",
      description: "Become a team leader with 5+ active referrals",
      amount: "₹500/month",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
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
            <h1 className="text-xl font-bold text-gray-900">Refer and Earn</h1>
            <p className="text-sm text-gray-600">
              Invite friends and earn together
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 pb-20">
        {/* Referral Code Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl shadow-lg p-6 mb-6 text-white"
        >
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Your Referral Code</h2>
            <p className="text-blue-100 mb-4">
              Share this code with friends to earn rewards
            </p>
            <div className="bg-white/20 rounded-xl p-4 mb-4">
              <div className="text-3xl font-bold tracking-wider">
                {referralCode}
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleCopyCode}
                className="flex-1 flex items-center justify-center space-x-2 bg-white/20 hover:bg-white/30 rounded-xl py-3 transition-colors"
              >
                <Copy className="h-5 w-5" />
                <span>{copied ? "Copied!" : "Copy Code"}</span>
              </button>
              <button
                onClick={handleShare}
                className="flex-1 flex items-center justify-center space-x-2 bg-white/20 hover:bg-white/30 rounded-xl py-3 transition-colors"
              >
                <Share2 className="h-5 w-5" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Rewards Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Gift className="h-5 w-5 mr-2 text-green-600" />
            How You Earn
          </h3>
          <div className="space-y-4">
            {rewards.map((reward, index) => (
              <div key={index} className="flex items-start space-x-4">
                <div className={`p-3 rounded-xl ${reward.bgColor}`}>
                  <reward.icon className={`h-6 w-6 ${reward.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-gray-900">
                      {reward.title}
                    </h4>
                    <span className={`font-bold ${reward.color}`}>
                      {reward.amount}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{reward.description}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2 text-blue-600" />
            How It Works
          </h3>
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600">1</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Share Your Code</h4>
                <p className="text-sm text-gray-600">
                  Share your referral code or link with friends
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600">2</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Friend Joins</h4>
                <p className="text-sm text-gray-600">
                  Your friend signs up using your code
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600">3</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Earn Rewards</h4>
                <p className="text-sm text-gray-600">
                  Get paid when they complete deliveries
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Your Referral Stats
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">0</div>
              <div className="text-sm text-gray-600">Total Referrals</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">₹0</div>
              <div className="text-sm text-gray-600">Earned</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ReferAndEarnPage;
