import React, { useEffect, useState } from "react";
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
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import { useLanguage } from "../contexts/LanguageContext";

const ReferAndEarnPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isDeliveryRoute = location.pathname.startsWith("/delivery/");
  const { tokens } = useSelector((state: RootState) => state.auth);
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState("more");
  const [copied, setCopied] = useState(false);

  const [isLoading, setIsLoading] = useState(isDeliveryRoute);
  const [error, setError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string>("");

  useEffect(() => {
    const fetchReferral = async () => {
      if (!isDeliveryRoute) return;

      try {
        setIsLoading(true);
        setError(null);

        if (!tokens?.accessToken) {
          setReferralCode("");
          setError(t("referral.authRequired"));
          return;
        }

        const response = await fetch("/api/delivery/referral", {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });

        if (!response.ok) {
          const text = await response.text();
          let message = t("referral.loadFailed", { status: String(response.status) });
          try {
            const parsed = JSON.parse(text);
            message = parsed.error || parsed.message || message;
          } catch {
            // ignore
          }
          throw new Error(message);
        }

        const data = await response.json();
        setReferralCode(String(data.referralCode || ""));
      } catch (e) {
        setReferralCode("");
        setError(e instanceof Error ? e.message : t("referral.loadFailedDefault"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchReferral();
  }, [isDeliveryRoute, tokens?.accessToken]);

  const referralLink = referralCode
    ? `${window.location.origin}/delivery/signup?ref=${encodeURIComponent(
        referralCode
      )}`
    : "";

  const handleCopyCode = () => {
    if (!referralCode) return;
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (!referralCode || !referralLink) {
      handleCopyCode();
      return;
    }
    if (navigator.share) {
      navigator.share({
        title: t("referral.shareTitle"),
        text: t("referral.shareText", { code: referralCode }),
        url: referralLink,
      });
    } else {
      handleCopyLink();
    }
  };

  const rewards = [
    {
      icon: Gift,
      title: t("referral.referralBonus"),
      description: t("referral.referralBonusDesc"),
      amount: "₹200",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      icon: Star,
      title: t("referral.performanceBonus"),
      description: t("referral.performanceBonusDesc"),
      amount: t("referral.perMonth", { amount: "₹50" }),
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      icon: Users,
      title: t("referral.teamLeader"),
      description: t("referral.teamLeaderDesc"),
      amount: t("referral.perMonth", { amount: "₹500" }),
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
            <h1 className="text-xl font-bold text-gray-900">{t("referral.title")}</h1>
            <p className="text-sm text-gray-600">
              {t("referral.subtitle")}
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
            <h2 className="text-2xl font-bold mb-2">{t("referral.yourCode")}</h2>
            <p className="text-blue-100 mb-4">
              {t("referral.yourCodeDesc")}
            </p>
            <div className="bg-white/20 rounded-xl p-4 mb-4">
              {isDeliveryRoute && isLoading ? (
                <div className="text-lg font-semibold text-blue-100">
                  {t("referral.loading")}
                </div>
              ) : referralCode ? (
                <div className="text-3xl font-bold tracking-wider">
                  {referralCode}
                </div>
              ) : (
                <div className="text-sm text-blue-100">
                  {error ? error : t("referral.noCode")}
                </div>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleCopyCode}
                disabled={!referralCode}
                className="flex-1 flex items-center justify-center space-x-2 bg-white/20 hover:bg-white/30 rounded-xl py-3 transition-colors"
              >
                <Copy className="h-5 w-5" />
                <span>{copied ? t("referral.copied") : t("referral.copyCode")}</span>
              </button>
              <button
                onClick={handleShare}
                disabled={!referralCode}
                className="flex-1 flex items-center justify-center space-x-2 bg-white/20 hover:bg-white/30 rounded-xl py-3 transition-colors"
              >
                <Share2 className="h-5 w-5" />
                <span>{t("referral.share")}</span>
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
            {t("referral.howYouEarn")}
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
            {t("referral.howItWorks")}
          </h3>
          <div className="space-y-4">
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600">1</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{t("referral.step1Title")}</h4>
                <p className="text-sm text-gray-600">
                  {t("referral.step1Desc")}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600">2</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{t("referral.step2Title")}</h4>
                <p className="text-sm text-gray-600">
                  {t("referral.step2Desc")}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-blue-600">3</span>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">{t("referral.step3Title")}</h4>
                <p className="text-sm text-gray-600">
                  {t("referral.step3Desc")}
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
            {t("referral.yourStats")}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">0</div>
              <div className="text-sm text-gray-600">{t("referral.totalReferrals")}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">₹0</div>
              <div className="text-sm text-gray-600">{t("referral.earned")}</div>
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

export default ReferAndEarnPage;
