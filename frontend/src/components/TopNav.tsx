import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { setSearchQuery } from "../store/slices/uiSlice";
import { motion } from "framer-motion";
import { getDisplayName } from "../utils/nameUtils";
import { ChevronDown, Search } from "lucide-react";

const TopNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const cart = useSelector((state: RootState) => state.cart);
  const { user, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );
  const { searchQuery } = useSelector((state: RootState) => state.ui);

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isDropdownSticky, setIsDropdownSticky] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch(setSearchQuery(e.target.value));
  };

  const handleSearch = () => {
    // Handle search functionality
    console.log("Searching for:", searchQuery);
  };

  const handleLogoClick = () => {
    const isAdmin = !!(user?.isAdmin || user?.role === "admin");
    const targetPath = isAdmin ? "/admin" : "/";
    if (location.pathname === targetPath) {
      window.location.reload();
    } else {
      navigate(targetPath);
    }
  };

  const handleProfileDropdownToggle = () => {
    if (isDropdownSticky) {
      // If sticky, close it
      setIsDropdownSticky(false);
      setShowProfileDropdown(false);
    } else {
      // If not sticky, make it sticky
      setIsDropdownSticky(true);
      setShowProfileDropdown(true);
    }
  };

  const handleProfileMouseEnter = () => {
    if (!isDropdownSticky) {
      setShowProfileDropdown(true);
    }
  };

  const handleProfileMouseLeave = () => {
    if (!isDropdownSticky) {
      setShowProfileDropdown(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isDropdownSticky) {
        const target = event.target as Element;
        if (!target.closest(".profile-dropdown")) {
          setIsDropdownSticky(false);
          setShowProfileDropdown(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownSticky]);

  const isCartPage = location.pathname === "/cart";
  const isAdminPage = location.pathname.startsWith("/admin");
  const isAdmin = !!(user?.isAdmin || user?.role === "admin");

  const cartUniqueCount = cart.items.length;

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white shadow-sm sticky top-0 z-50"
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={handleLogoClick}
            className="flex items-center space-x-2 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg p-1"
            aria-label="Go to Home page"
          >
            <div className="text-2xl">🏪</div>
            <span className="text-xl font-bold text-gray-900">CS Store</span>
            {isAdmin && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full ml-2">
                Admin
              </span>
            )}
          </button>

          {/* Search Bar - Hide for admin pages */}
          {!isAdminPage && (
            <div className="flex-1 max-w-md mx-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                  className={`w-full px-4 py-2 pl-10 pr-12 border rounded-lg transition-all duration-200 ${
                    isSearchFocused
                      ? "border-primary-500 ring-2 ring-primary-200"
                      : "border-gray-300 focus:border-primary-500"
                  }`}
                />
                <button
                  onClick={handleSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200 cursor-pointer"
                  type="button"
                  aria-label="Search"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4">
            {/* Admin Navigation */}
            {isAdmin && isAdminPage ? (
              <div className="flex items-center space-x-2">
                <Link
                  to="/admin"
                  className="flex items-center space-x-2 p-2 text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <div className="text-2xl">📊</div>
                  <span className="hidden md:block text-sm font-medium">
                    Dashboard
                  </span>
                </Link>
                <Link
                  to="/admin-profile"
                  className="flex items-center space-x-2 p-2 text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <div className="text-2xl">👤</div>
                  <span className="hidden md:block text-sm font-medium">
                    Profile
                  </span>
                </Link>
              </div>
            ) : (
              <>
                {/* Cart Icon - Hide for admin users */}
                {!isCartPage && !isAdmin && (
                  <Link
                    to="/cart"
                    className="relative p-2 text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    <div className="text-2xl">🛒</div>
                    {isAuthenticated && cartUniqueCount > 0 && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold"
                      >
                        {cartUniqueCount}
                      </motion.div>
                    )}
                  </Link>
                )}

                {/* Profile - Show profile for all users */}
                {isAuthenticated ? (
                  <div
                    className="relative profile-dropdown"
                    onMouseEnter={handleProfileMouseEnter}
                    onMouseLeave={handleProfileMouseLeave}
                  >
                    <button
                      onClick={handleProfileDropdownToggle}
                      className="flex items-center space-x-2 p-2 text-gray-600 hover:text-primary-600 transition-colors"
                    >
                      <div className="relative">
                        <div className="text-2xl">👤</div>
                        {/* Profile Dropdown Menu - positioned relative to icon */}
                        {showProfileDropdown && (
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                            <div className="py-2">
                              <Link
                                to="/account"
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-center"
                              >
                                My Account
                              </Link>
                              <Link
                                to="/orders"
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-center"
                              >
                                My Orders
                              </Link>
                              <Link
                                to="/addresses"
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors text-center"
                              >
                                My Addresses
                              </Link>
                              <hr className="my-1" />
                              <button
                                onClick={() => {
                                  // Add logout functionality here
                                  console.log("Logout clicked");
                                }}
                                className="block w-full text-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                Logout
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="hidden md:flex items-center space-x-1">
                        <span className="text-sm font-medium">
                          {getDisplayName(user?.name)}
                        </span>
                        <ChevronDown
                          className={`h-3 w-3 text-gray-500 transition-transform duration-200 ${
                            showProfileDropdown ? "rotate-180" : "rotate-0"
                          }`}
                          strokeWidth={2.5}
                        />
                      </div>
                    </button>
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="flex items-center space-x-2 p-2 text-gray-600 hover:text-primary-600 transition-colors"
                  >
                    <div className="text-2xl">👤</div>
                    <span className="hidden md:block text-sm font-medium">
                      Login
                    </span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};

export default TopNav;
