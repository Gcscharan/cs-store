import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { motion } from "framer-motion";

const BottomNav = () => {
  const location = useLocation();
  const { cart } = useSelector((state: RootState) => state);

  const navItems = [
    { path: "/", label: "Home", icon: "🏠" },
    { path: "/orders", label: "Orders", icon: "📦" },
    { path: "/cart", label: "Cart", icon: "🛒" },
    { path: "/profile", label: "Profile", icon: "👤" },
    { path: "/menu", label: "Menu", icon: "☰" },
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 md:hidden"
    >
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const showBadge = item.path === "/cart" && cart.itemCount > 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center py-2 px-3 rounded-lg transition-colors ${
                isActive
                  ? "text-primary-600 bg-primary-50"
                  : "text-gray-600 hover:text-primary-600"
              }`}
            >
              <div className="relative">
                <div className="text-xl">{item.icon}</div>
                {showBadge && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-semibold"
                  >
                    {cart.itemCount}
                  </motion.div>
                )}
              </div>
              <span className="text-xs font-medium mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
};

export default BottomNav;
