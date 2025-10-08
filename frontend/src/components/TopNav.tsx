import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { setSearchQuery } from "../store/slices/uiSlice";
import { motion } from "framer-motion";

const TopNav = () => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { cart } = useSelector((state: RootState) => state);
  const { user, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );
  const { searchQuery } = useSelector((state: RootState) => state.ui);

  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchQuery(e.target.value));
  };

  const isCartPage = location.pathname === "/cart";

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white shadow-sm sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="text-2xl">🏪</div>
            <span className="text-xl font-bold text-gray-900">CPS Store</span>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                className={`w-full px-4 py-2 pl-10 pr-4 border rounded-lg transition-all duration-200 ${
                  isSearchFocused
                    ? "border-primary-500 ring-2 ring-primary-200"
                    : "border-gray-300 focus:border-primary-500"
                }`}
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                🔍
              </div>
            </div>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Cart Icon */}
            {!isCartPage && (
              <Link
                to="/cart"
                className="relative p-2 text-gray-600 hover:text-primary-600 transition-colors"
              >
                <div className="text-2xl">🛒</div>
                {cart.itemCount > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold"
                  >
                    {cart.itemCount}
                  </motion.div>
                )}
              </Link>
            )}

            {/* Profile */}
            {isAuthenticated ? (
              <div className="flex items-center space-x-2">
                <Link
                  to="/profile"
                  className="flex items-center space-x-2 p-2 text-gray-600 hover:text-primary-600 transition-colors"
                >
                  <div className="text-2xl">👤</div>
                  <span className="hidden md:block text-sm font-medium">
                    {user?.name}
                  </span>
                </Link>
              </div>
            ) : (
              <Link
                to="/profile"
                className="flex items-center space-x-2 p-2 text-gray-600 hover:text-primary-600 transition-colors"
              >
                <div className="text-2xl">👤</div>
                <span className="hidden md:block text-sm font-medium">
                  Login
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default TopNav;
