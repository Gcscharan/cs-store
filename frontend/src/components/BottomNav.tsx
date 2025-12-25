import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { motion } from "framer-motion";
import {
  Home,
  Grid3X3,
  User,
  ShoppingCart,
  BarChart3,
  Truck,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

const BottomNav = () => {
  const location = useLocation();
  const cart = useSelector((state: RootState) => state.cart);
  const { user, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );
  const { t } = useLanguage();

  const cartUniqueCount = cart.items.length;

  const isAdmin = user?.isAdmin;
  const isDelivery = user?.role === "delivery";
  const isAdminPage = location.pathname.startsWith("/admin");
  const isDeliveryPage = location.pathname.startsWith("/delivery");

  // Admin navigation items
  const adminNavItems = [
    {
      path: "/admin",
      label: "Dashboard",
      icon: BarChart3,
      ariaLabel: "Admin dashboard",
    },
    {
      path: "/admin-profile",
      label: "Profile",
      icon: User,
      ariaLabel: "Admin profile",
    },
  ];

  // Delivery boy navigation items
  const deliveryNavItems = [
    {
      path: "/delivery",
      label: "Dashboard",
      icon: Truck,
      ariaLabel: "Delivery dashboard",
    },
    {
      path: "/delivery-profile",
      label: "Account",
      icon: User,
      ariaLabel: "View your account",
    },
  ];

  // Regular user navigation items
  const userNavItems = [
    {
      path: "/",
      label: t("nav.home"),
      icon: Home,
      ariaLabel: "Navigate to home page",
    },
    {
      path: "/categories",
      label: t("nav.categories"),
      icon: Grid3X3,
      ariaLabel: "Browse product categories",
    },
    {
      path: "/account",
      label: t("nav.account"),
      icon: User,
      ariaLabel: "View your account",
    },
    {
      path: "/cart",
      label: t("nav.cart"),
      icon: ShoppingCart,
      ariaLabel: `View cart with ${cartUniqueCount} items`,
    },
  ];

  // Choose navigation items based on user role and current page
  let navItems: Array<{
    path: string;
    label: string;
    icon: any;
    ariaLabel: string;
  }>;
  if (isAdmin && isAdminPage) {
    navItems = adminNavItems;
  } else if (isDelivery && isDeliveryPage) {
    // For delivery pages, don't show bottom nav as it has its own navigation
    navItems = [];
  } else if (isDelivery) {
    navItems = deliveryNavItems;
  } else {
    navItems = userNavItems;
  }

  // Don't render bottom nav if user is not authenticated (except for delivery users)
  if (!isAuthenticated && !isDelivery) {
    return null;
  }

  return (
    <motion.nav
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-white shadow-md flex justify-around py-2 border-t z-40"
      role="navigation"
      aria-label="Main navigation"
    >
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const showBadge =
          item.path === "/cart" && isAuthenticated && cartUniqueCount > 0;
        const IconComponent = item.icon;

        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
              isActive ? "text-blue-600" : "text-gray-600 hover:text-blue-600"
            }`}
            aria-label={item.ariaLabel}
            aria-current={isActive ? "page" : undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                window.location.href = item.path;
              }
            }}
          >
            <div className="relative">
              <IconComponent
                className={`h-6 w-6 ${
                  isActive ? "text-blue-600" : "text-gray-600"
                }`}
                aria-hidden="true"
              />
              {showBadge && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-semibold"
                  aria-label={`${cartUniqueCount} items in cart`}
                >
                  {cartUniqueCount}
                </motion.div>
              )}
            </div>
            <span className="text-xs font-medium mt-1">{item.label}</span>
          </Link>
        );
      })}
    </motion.nav>
  );
};

export default BottomNav;
