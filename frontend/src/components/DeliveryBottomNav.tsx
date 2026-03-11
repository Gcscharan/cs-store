import React from "react";
import { motion } from "framer-motion";
import { Home, DollarSign, Bell, MoreHorizontal } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

interface DeliveryBottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const DeliveryBottomNav: React.FC<DeliveryBottomNavProps> = ({
  activeTab,
  setActiveTab,
}) => {
  const { t } = useLanguage();

  const navItems = [
    {
      id: "home",
      label: t("delivery.home"),
      icon: Home,
      ariaLabel: t("delivery.homeAria"),
    },
    {
      id: "earnings",
      label: t("delivery.earnings"),
      icon: DollarSign,
      ariaLabel: t("delivery.earningsAria"),
    },
    {
      id: "notifications",
      label: t("delivery.notifications"),
      icon: Bell,
      ariaLabel: t("delivery.notificationsAria"),
    },
    {
      id: "more",
      label: t("delivery.more"),
      icon: MoreHorizontal,
      ariaLabel: t("delivery.moreAria"),
    },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-white shadow-lg flex justify-around py-2 border-t border-gray-200 z-50"
      role="navigation"
      aria-label="Delivery navigation"
    >
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        const IconComponent = item.icon;

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isActive ? "text-blue-600" : "text-gray-600 hover:text-blue-600"
            }`}
            aria-label={item.ariaLabel}
            aria-current={isActive ? "page" : undefined}
          >
            <IconComponent
              className={`h-6 w-6 ${
                isActive ? "text-blue-600" : "text-gray-600"
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-medium mt-1">{item.label}</span>
          </button>
        );
      })}
    </motion.nav>
  );
};

export default DeliveryBottomNav;
