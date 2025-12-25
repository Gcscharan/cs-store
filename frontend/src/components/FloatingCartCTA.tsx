import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { motion, AnimatePresence } from "framer-motion";

const FloatingCartCTA = () => {
  const location = useLocation();
  const cart = useSelector((state: RootState) => state.cart);
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const cartUniqueCount = cart.items.length;

  // Removed minimum order requirement - delivery charges will apply for all orders

  // Don't show on cart page, if cart is empty, or if user is not authenticated
  if (
    location.pathname === "/cart" ||
    cartUniqueCount === 0 ||
    !isAuthenticated
  ) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0 }}
        className="fixed bottom-20 right-4 z-30 md:bottom-4"
      >
        <Link
          to="/cart"
          className="p-4 rounded-full shadow-lg transition-colors flex items-center space-x-2 bg-blue-600 text-white hover:bg-blue-700"
        >
          <div className="text-2xl">🛒</div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {cartUniqueCount} items
            </span>
            <span className="text-xs opacity-90">₹{cart.total.toFixed(2)}</span>
            {cart.total < 500 && (
              <span className="text-xs opacity-75">
                +₹{(500 - cart.total).toFixed(0)} for free delivery
              </span>
            )}
          </div>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingCartCTA;
