import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { motion, AnimatePresence } from "framer-motion";

const FloatingCartCTA = () => {
  const location = useLocation();
  const { cart } = useSelector((state: RootState) => state);

  const MINIMUM_ORDER = 2000;
  const isMinimumMet = cart.total >= MINIMUM_ORDER;
  const remainingAmount = MINIMUM_ORDER - cart.total;

  // Don't show on cart page or if cart is empty
  if (location.pathname === "/cart" || cart.itemCount === 0) {
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
          className={`p-4 rounded-full shadow-lg transition-colors flex items-center space-x-2 ${
            isMinimumMet
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-orange-500 text-white hover:bg-orange-600"
          }`}
        >
          <div className="text-2xl">🛒</div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {cart.itemCount} items
            </span>
            <span className="text-xs opacity-90">₹{cart.total.toFixed(2)}</span>
            {!isMinimumMet && (
              <span className="text-xs opacity-75">
                +₹{remainingAmount.toFixed(0)} for free delivery
              </span>
            )}
          </div>
        </Link>
      </motion.div>
    </AnimatePresence>
  );
};

export default FloatingCartCTA;
