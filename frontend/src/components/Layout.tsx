import React, { ReactNode } from "react";
import { SkipLink } from "./KeyboardNavigation";
import { ToastProvider, useToast } from "./AccessibleToast";
import {
  Search,
  User,
  ShoppingCart,
  Store,
  ChevronDown,
  MoreVertical,
  MapPin,
} from "lucide-react";
import { useState, useEffect } from "react";
import BottomNav from "./BottomNav";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { useLogout } from "../hooks/useLogout";
import { logout } from "../store/slices/authSlice";
import { useOtpModal } from "../contexts/OtpModalContext";
import { getDisplayName } from "../utils/nameUtils";
import { useGetSearchSuggestionsQuery, useGetAddressesQuery, useSetDefaultAddressMutation, useGetProfileQuery } from "../store/api";
import SearchSuggestions from "./SearchSuggestions";
import ChooseLocation from "./ChooseLocation";
import CartConfirmationBar from "./CartConfirmationBar";
import GlobalCartConfirmationBar from "./GlobalCartConfirmationBar";
import { CartFeedbackProvider } from "../contexts/CartFeedbackContext";

interface LayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  hideBottomNav?: boolean;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  title = "CS Store",
  description = "E-commerce platform",
  hideBottomNav = false,
}) => {
  const currentLocation = useLocation();

  // Hide bottom navigation on cart page
  const shouldHideBottomNav =
    hideBottomNav || currentLocation.pathname === "/cart";
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [showLoginDropdown, setShowLoginDropdown] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isDropdownSticky, setIsDropdownSticky] = useState(false);
  const [showMoreDropdown, setShowMoreDropdown] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);
  const performLogout = useLogout();
  
  // Fetch addresses from MongoDB
  const { data: addressesData, refetch: refetchAddresses } = useGetAddressesQuery(undefined, {
    skip: !auth.isAuthenticated,
  });
  
  // Fetch user profile data for displaying name
  const { data: profileData } = useGetProfileQuery(undefined, {
    skip: !auth.isAuthenticated,
  });
  
  const [setDefaultAddressMutation] = useSetDefaultAddressMutation();
  
  const addresses = addressesData?.addresses || [];
  const defaultAddressId = addressesData?.defaultAddressId || null;
  const defaultAddress = addresses.find((addr: any) => addr.id === defaultAddressId);
  
  const cart = useSelector((state: RootState) => state.cart);
  const { error: showError } = useToast();
  
  // Simple cart feedback state
  const [cartPulse, setCartPulse] = useState(false);
  
  // Cart confirmation bar state (local)
  const [confirmationBar, setConfirmationBar] = useState({
    isVisible: false,
    productName: '',
    productImage: ''
  });

  // Global confirmation bar state (slides from top)
  const [globalConfirmationBar, setGlobalConfirmationBar] = useState({
    isVisible: false,
    productName: '',
    productImage: '',
    cartCount: 0,
    cartTotal: 0
  });

  // Function to trigger local cart confirmation
  const triggerCartConfirmation = (productName: string, productImage?: string) => {
    setConfirmationBar({
      isVisible: true,
      productName,
      productImage: productImage || ''
    });
    
    // Trigger cart pulse animation
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 600);
  };

  // Function to trigger global confirmation bar (advanced Amazon-style)
  const triggerGlobalConfirmation = (productName: string, productImage?: string, cartCount?: number, cartTotal?: number) => {
    setGlobalConfirmationBar({
      isVisible: true,
      productName,
      productImage: productImage || '',
      cartCount: cartCount || cart.itemCount || 0,
      cartTotal: cartTotal || cart.total || 0
    });
    
    // Trigger cart pulse animation
    setCartPulse(true);
    setTimeout(() => setCartPulse(false), 600);
  };

  const closeConfirmation = () => {
    setConfirmationBar(prev => ({ ...prev, isVisible: false }));
  };

  const closeGlobalConfirmation = () => {
    setGlobalConfirmationBar(prev => ({ ...prev, isVisible: false }));
  };

  // Handle search functionality
  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      // Show message when no input is provided
      showError("Please enter a product name to search");
    }
  };
  const { showOtpModal } = useOtpModal();

  const isAdmin = auth.user?.isAdmin;
  const isDelivery = auth.user?.role === "delivery";
  const isAdminPage = location.pathname.startsWith("/admin");
  const isDeliveryPage = location.pathname.startsWith("/delivery");

  useEffect(() => {
    document.title = title;
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute("content", description);
    }
  }, [title, description]);

  // Don't render header/footer for delivery pages
  if (isDeliveryPage) {
    return <main id="main-content">{children}</main>;
  }

  // Sync search bar with URL parameters when on search page
  useEffect(() => {
    if (location.pathname === "/search") {
      const urlParams = new URLSearchParams(location.search);
      const query = urlParams.get("q");
      if (query && query !== searchQuery) {
        setSearchQuery(query);
      }
    }
  }, [location.pathname, location.search]);

  // Debounce search query for suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --------------------------------------
// 📌 FIX: Use the correct suggestions API
// --------------------------------------
const { data: suggestionList, isLoading: loadingSuggestions } = useGetSearchSuggestionsQuery(
  { q: debouncedSearchQuery },
  { skip: debouncedSearchQuery.trim().length === 0 }
);

const suggestions = suggestionList || [];

  // Global functions for search bar management
  useEffect(() => {
    (window as any).clearSearchBar = () => {
      setSearchQuery("");
    };

    (window as any).updateSearchQuery = (query: string) => {
      setSearchQuery(query);
    };

    return () => {
      delete (window as any).clearSearchBar;
      delete (window as any).updateSearchQuery;
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (showLoginDropdown && !target.closest(".login-dropdown")) {
        setShowLoginDropdown(false);
      }

      if (showProfileDropdown && !target.closest(".profile-dropdown")) {
        setShowProfileDropdown(false);
      }

      if (showMoreDropdown && !target.closest(".more-dropdown")) {
        setShowMoreDropdown(false);
      }

      if (
        showProfileDropdown &&
        !target.closest(".profile-dropdown") &&
        !target.closest(".admin-dropdown")
      ) {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showLoginDropdown, showProfileDropdown, showMoreDropdown]);

  // Note: Search functionality moved to button click and Enter key handling

  const handleLogoClick = () => {
    // If already on Home page, reload the page
    if (location.pathname === "/") {
      window.location.reload();
    } else {
      // Navigate to Home page if on any other page
      navigate("/");
    }
  };

  const handleAccount = () => {
    navigate("/account");
  };

  const handleLoginDropdownToggle = () => {
    setShowLoginDropdown(!showLoginDropdown);
  };

  const handleLoginOptionClick = (action: () => void) => {
    action();
    setShowLoginDropdown(false);
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

  const handleProfileOptionClick = (action: () => void) => {
    action();
    setShowProfileDropdown(false);
  };

  const handleLogout = async () => {
  try {
    console.log("[Logout] dispatching logout, currentPath:", window.location.pathname);
    setShowProfileDropdown(false);

    // Dispatch logout to clear redux state
    dispatch(logout());

    // Extra cleanup: ensure all auth keys removed
    try {
      localStorage.removeItem("auth");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      localStorage.removeItem("isLoggingOut"); // Clear logout flag too
    } catch (e) {
      console.warn("logout: failed to clean localStorage", e);
    }

    // Use router navigation (replace so user can't go back to protected pages)
    try {
      console.log("[Logout] attempting SPA navigate to /");
      navigate("/", { replace: true });
      // small delay to ensure navigate takes effect in older browsers
      setTimeout(() => {
        if (window.location.pathname !== "/") {
          // fallback to hard redirect (safe)
          console.log("[Logout] SPA navigate failed, using fallback");
          window.location.assign("/");
        }
      }, 120);
    } catch (navErr) {
      console.warn("SPA navigate failed, falling back to location.assign", navErr);
      window.location.assign("/");
    }
  } catch (err) {
    console.error("Logout failed:", err);
    // still try to force redirect to home
    window.location.assign("/");
  }
};

  const handleMoreDropdownToggle = () => {
    setShowMoreDropdown(!showMoreDropdown);
  };

  const handleLocationClick = () => {
    setShowLocationModal(true);
  };

  const handleAddressSelect = async (addressId: string) => {
    try {
      // Update default address in MongoDB
      await setDefaultAddressMutation(addressId).unwrap();

      // Refetch addresses to get fresh data
      await refetchAddresses();

      const selectedAddr = addresses.find((addr: any) => addr.id === addressId);
      if (selectedAddr) {
        showError(
          `Location updated to ${selectedAddr.city}, ${selectedAddr.state}`
        );
      }
    } catch (error) {
      console.error("Error updating default address:", error);
      showError("Failed to update location. Please try again.");
    }
  };

  const handleMoreOptionClick = (action: () => void) => {
    action();
    setShowMoreDropdown(false);
  };

  const handleSearchClick = () => {
    // If there's a search query, perform the search
    if (searchQuery.trim()) {
      handleSearch();
    } else {
      // If no search query, just navigate to search page
      navigate("/search");
    }
  };

  const handleCartClick = () => {
    navigate("/cart");
  };

  return (
    <ToastProvider>
      <style>{`
        /* ✨ MAGICAL STAR GLOW ANIMATION */
        @keyframes sparkle {
          0% {
            transform: scale(0) rotate(0deg);
            opacity: 0;
          }
          50% {
            transform: scale(1) rotate(180deg);
            opacity: 1;
          }
          100% {
            transform: scale(0) rotate(360deg);
            opacity: 0;
          }
        }
        
        /* Amazon-Style Professional Cart Pulse Animation */
        .cart-pulse-active {
          animation: cart-jiggle-flash 0.6s ease-in-out;
        }
        
        /* Cart icon color flash during pulse */
        .cart-pulse-active .cart-icon {
          animation: cart-icon-flash 0.6s ease-in-out;
        }
        
        /* Jiggle + Glow Animation */
        @keyframes cart-jiggle-flash {
          0% {
            transform: scale(1) translateX(0);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          15% {
            transform: scale(1.05) translateX(-2px);
            box-shadow: 0 0 12px rgba(34, 197, 94, 0.4), 0 0 20px rgba(34, 197, 94, 0.2);
          }
          30% {
            transform: scale(1.05) translateX(2px);
            box-shadow: 0 0 16px rgba(34, 197, 94, 0.6), 0 0 28px rgba(34, 197, 94, 0.3);
          }
          45% {
            transform: scale(1.05) translateX(-1px);
            box-shadow: 0 0 12px rgba(34, 197, 94, 0.4), 0 0 20px rgba(34, 197, 94, 0.2);
          }
          60% {
            transform: scale(1.02) translateX(1px);
            box-shadow: 0 0 8px rgba(34, 197, 94, 0.3), 0 0 15px rgba(34, 197, 94, 0.15);
          }
          100% {
            transform: scale(1) translateX(0);
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
        }
        
        /* Cart Icon Color Flash - Works for both blue and gray icons */
        @keyframes cart-icon-flash {
          0% {
            color: currentColor; /* Preserve original color */
          }
          25% {
            color: rgb(34, 197, 94) !important; /* Bright green flash */
          }
          50% {
            color: rgb(34, 197, 94) !important; /* Hold green */
          }
          75% {
            color: rgb(16, 185, 129) !important; /* Slightly darker green */
          }
          100% {
            color: currentColor; /* Back to original color */
          }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50">
        {/* Skip Links for Accessibility */}
        <SkipLink href="#main-content">Skip to main content</SkipLink>
        <SkipLink href="#navigation">Skip to navigation</SkipLink>

        {/* Document Head - Using useEffect to set document title */}

        {/* Main Layout */}
        <div className="flex flex-col min-h-screen">
          {/* Flipkart-style Header */}
          <header
            id="navigation"
            className="bg-white shadow-sm border-b border-gray-200 z-sticky"
            role="banner"
          >
            <div className="w-full px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Logo and Address Section */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleLogoClick}
                    className="flex items-center space-x-2 text-2xl font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    aria-label="CS Store Home"
                  >
                    <span>CS Store</span>
                  </button>

                  {/* Address Section - Hidden on homepage, checkout page, and admin pages */}
                  {location.pathname !== "/" &&
                    location.pathname !== "/checkout" &&
                    !location.pathname.startsWith("/admin") && (
                      <button
                        onClick={handleLocationClick}
                        className="hidden md:flex items-center space-x-2 text-sm text-gray-600 px-4 hover:bg-gray-50 rounded-lg py-2 transition-colors"
                      >
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4 text-gray-600" />
                          <span className="font-medium">Deliver to</span>
                        </div>
                        <div className="flex items-center space-x-1 text-gray-800 font-medium">
                          <span>
                            {defaultAddress
                              ? `${defaultAddress.name || 'User'}, ${defaultAddress.city}`
                              : "Add Address"}
                          </span>
                          <ChevronDown className="h-3 w-3" />
                        </div>
                      </button>
                    )}
                </div>

                {/* Centered Content - Search Bar or Admin Title */}
                {isAdminPage ? (
                  // Admin pages - show Admin Dashboard title in center
                  <div className="flex-1 flex items-center justify-center">
                    <h1 className="text-xl font-bold text-gray-900">
                      Admin Dashboard
                    </h1>
                  </div>
                ) : location.pathname !== "/account" &&
                  location.pathname !== "/categories" &&
                  !isDeliveryPage ? (
                  // Other pages - show search bar
                  <div className="flex-1 max-w-4xl mx-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search for Products, Brands and More"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowSearchSuggestions(true);
                        }}
                        onFocus={() => {
                          if (
                            searchQuery.length >= 1 &&
                            suggestions.length > 0
                          ) {
                            setShowSearchSuggestions(true);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(
                            () => setShowSearchSuggestions(false),
                            200
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleSearch();
                            setShowSearchSuggestions(false);
                          } else if (e.key === "Escape") {
                            setShowSearchSuggestions(false);
                          }
                        }}
                        className="w-full px-4 py-3 h-12 pr-12 border border-gray-300 bg-white text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
                      />
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSearch();
                          setShowSearchSuggestions(false);
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 text-gray-500 hover:text-gray-700 transition-colors duration-200 cursor-pointer"
                        type="button"
                        aria-label="Search"
                      >
                        <Search className="h-5 w-5" />
                      </button>

                      {/* Search Suggestions Dropdown - Flipkart Style */}
                      {showSearchSuggestions && searchQuery.length >= 1 && (
                        <SearchSuggestions
                          suggestions={suggestions}
                          searchQuery={searchQuery}
                          onClose={() => {
                            setShowSearchSuggestions(false);
                            setSearchQuery("");
                          }}
                          isLoading={loadingSuggestions}
                        />
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Right side content - different for Categories page, admin users, and delivery users */}
                {location.pathname === "/categories" &&
                !isAdmin &&
                !isDelivery ? (
                  // Categories page - only Search and Cart icons (hide for admin and delivery users)
                  <div className="flex items-center space-x-3">
                    {/* Search Icon */}
                    <button
                      onClick={handleSearchClick}
                      className="p-3 bg-gray-100 hover:bg-gray-200 rounded-full transition-all duration-200 shadow-sm hover:shadow-md hover:scale-110"
                      aria-label="Search products"
                    >
                      <Search className="h-5 w-5 text-gray-600" />
                    </button>

                    {/* Cart Icon with Badge */}
                    <button
                      onClick={handleCartClick}
                      className={`relative p-3 bg-blue-100 hover:bg-blue-200 rounded-full transition-all duration-200 shadow-sm hover:shadow-md hover:scale-110 ${
                        cartPulse ? 'cart-pulse-active' : ''
                      }`}
                      aria-label={`View cart with ${cart.itemCount ?? 0} items`}
                    >
                      <ShoppingCart className="h-5 w-5 text-blue-600 cart-icon" />
                      {auth.isAuthenticated && cart.itemCount > 0 && (
                        <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold shadow-lg">
                          {cart.itemCount > 99 ? "99+" : cart.itemCount}
                        </div>
                      )}
                    </button>
                  </div>
                ) : isAdmin && isAdminPage ? (
                  // Admin pages - show profile and logout buttons
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => navigate("/admin-profile")}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Profile
                    </button>
                    <button
                      onClick={async () => {
                        await performLogout();
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                ) : isDelivery && isDeliveryPage ? (
                  // Delivery pages - no header content
                  <div className="flex items-center space-x-2">
                    {/* Delivery action icons moved to bottom */}
                  </div>
                ) : (
                  // Other pages - Flipkart-style right side buttons
                  <div className="flex items-center space-x-8">
                    {auth.isAuthenticated ? (
                      // User is logged in - show account menu
                      <div className="flex items-center space-x-8">
                        {/* Profile Dropdown */}
                        <div
                          className="relative profile-dropdown"
                          onMouseEnter={handleProfileMouseEnter}
                          onMouseLeave={handleProfileMouseLeave}
                        >
                          <button
                            onClick={handleProfileDropdownToggle}
                            className="flex flex-col items-center space-y-1 text-gray-700 hover:text-blue-600 transition-colors duration-200 px-2 py-1"
                            aria-label="Account"
                          >
                            <User className="h-6 w-6" />
                            <div className="flex items-center space-x-1">
                              <span className="text-xs font-medium whitespace-nowrap">
                                {getDisplayName(profileData?.name) || "Account"}
                              </span>
                              <ChevronDown
                                className={`h-3 w-3 text-gray-500 transition-transform duration-200 ${
                                  showProfileDropdown
                                    ? "rotate-180"
                                    : "rotate-0"
                                }`}
                                strokeWidth={2.5}
                              />
                            </div>
                          </button>
                          {/* Profile Dropdown Menu - positioned relative to parent */}
                          {showProfileDropdown && (
                            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                              <div className="p-4">
                                {/* Post-Login Menu - Only show when authenticated */}
                                <div className="space-y-2">
                                  <button
                                    onClick={() =>
                                      handleProfileOptionClick(handleAccount)
                                    }
                                    className="w-full text-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 rounded"
                                  >
                                    My Profile
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleProfileOptionClick(() =>
                                        navigate("/orders")
                                      )
                                    }
                                    className="w-full text-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 rounded"
                                  >
                                    My Orders
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleProfileOptionClick(() =>
                                        navigate("/addresses")
                                      )
                                    }
                                    className="w-full text-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 rounded"
                                  >
                                    My Addresses
                                  </button>
                                  <div className="border-t border-gray-200 my-2"></div>
                                  <button
                                    onClick={() =>
                                      handleProfileOptionClick(handleLogout)
                                    }
                                    className="w-full text-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200 rounded"
                                  >
                                    Logout
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={handleCartClick}
                          className={`relative flex flex-col items-center space-y-1 text-gray-700 hover:text-blue-600 transition-colors duration-200 px-2 py-1 ${
                            cartPulse ? 'cart-pulse-active' : ''
                          }`}
                          aria-label={`View cart with ${
                            cart.itemCount ?? 0
                          } items`}
                        >
                          <ShoppingCart className="h-6 w-6 cart-icon" />
                          <span className="text-xs font-medium">Cart</span>
                          {cart.itemCount > 0 && (
                            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center font-bold">
                              {cart.itemCount > 99 ? "99+" : cart.itemCount}
                            </div>
                          )}
                        </button>
                        {/* More Options Dropdown */}
                        <div className="relative more-dropdown">
                          <button
                            onClick={handleMoreDropdownToggle}
                            className="flex flex-col items-center space-y-1 text-gray-700 hover:text-blue-600 transition-colors duration-200 px-2 py-1"
                            aria-label="More options"
                          >
                            <MoreVertical className="h-6 w-6" />
                            <span className="text-xs font-medium">More</span>
                          </button>

                          {/* More Options Dropdown Menu */}
                          {showMoreDropdown && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                              <div className="py-2">
                                <button
                                  onClick={() =>
                                    handleMoreOptionClick(() =>
                                      navigate("/notification-preferences")
                                    )
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                                >
                                  Notification Preferences
                                </button>
                                <button
                                  onClick={() =>
                                    handleMoreOptionClick(() =>
                                      navigate("/customer-care")
                                    )
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                                >
                                  24x7 Customer Care
                                </button>
                                <button
                                  onClick={() =>
                                    handleMoreOptionClick(() => {
                                      // Navigate to download app page
                                      navigate("/download-app");
                                    })
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 flex items-center space-x-2"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                                  </svg>
                                  <span>Download App</span>
                                </button>
                                <div className="border-t border-gray-200 my-1"></div>
                                <button
                                  onClick={() =>
                                    handleMoreOptionClick(() =>
                                      navigate("/about-us")
                                    )
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                                >
                                  About Us
                                </button>
                                <button
                                  onClick={() =>
                                    handleMoreOptionClick(() =>
                                      navigate("/careers")
                                    )
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                                >
                                  Careers
                                </button>
                                <button
                                  onClick={() =>
                                    handleMoreOptionClick(() =>
                                      navigate("/contact-us")
                                    )
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                                >
                                  Contact Us
                                </button>
                                <div className="border-t border-gray-200 my-1"></div>
                                <button
                                  onClick={() =>
                                    handleMoreOptionClick(() =>
                                      navigate("/become-seller")
                                    )
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 transition-colors duration-200 font-medium"
                                >
                                  Become a Seller
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      // User is not logged in - show Flipkart-style buttons
                      <div className="flex items-center space-x-8">
                        {/* Login Dropdown */}
                        <div className="relative login-dropdown">
                          <button
                            onClick={handleLoginDropdownToggle}
                            className="flex flex-col items-center space-y-1 text-gray-700 hover:text-blue-600 transition-colors duration-200 px-2 py-1"
                            aria-label="Login"
                          >
                            <User className="h-6 w-6" />
                            <div className="flex items-center space-x-1">
                              <span className="text-xs font-medium">Login</span>
                              <ChevronDown className="h-3 w-3" />
                            </div>
                          </button>

                          {/* Login Dropdown Menu */}
                          {showLoginDropdown && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                              <div className="p-4">
                                <div className="text-center mb-4">
                                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                                    Welcome
                                  </h3>
                                  <p className="text-sm text-gray-600">
                                    To access account and manage orders
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    setShowLoginDropdown(false);
                                    showOtpModal("/account/profile");
                                  }}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors duration-200 mb-2"
                                >
                                  LOGIN / SIGNUP
                                </button>
                                <div className="border-t border-gray-200 my-2"></div>
                                <div className="space-y-1">
                                  <button
                                    onClick={() => {
                                      setShowLoginDropdown(false);
                                      showOtpModal("/account/profile");
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 rounded"
                                  >
                                    Profile
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowLoginDropdown(false);
                                      showOtpModal("/account/orders");
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 rounded"
                                  >
                                    Orders
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowLoginDropdown(false);
                                      showOtpModal("/account/gift-cards");
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 rounded"
                                  >
                                    Gift Cards
                                  </button>
                                  <button
                                    onClick={() => {
                                      setShowLoginDropdown(false);
                                      showOtpModal("/account/rewards");
                                    }}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 rounded"
                                  >
                                    Rewards
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleLoginOptionClick(() =>
                                        navigate("/help-support")
                                      )
                                    }
                                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 rounded"
                                  >
                                    Help & Support
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handleCartClick}
                          className={`relative flex flex-col items-center space-y-1 text-gray-700 hover:text-blue-600 transition-colors duration-200 px-2 py-1 ${
                            cartPulse ? 'cart-pulse-active' : ''
                          }`}
                          aria-label="View cart"
                        >
                          <ShoppingCart className="h-6 w-6 cart-icon" />
                          <span className="text-xs font-medium">Cart</span>
                        </button>
                        <button
                          onClick={() => navigate("/become-seller")}
                          className="flex flex-col items-center space-y-1 text-gray-700 hover:text-blue-600 transition-colors duration-200 px-2 py-1"
                          aria-label="Become a Seller"
                        >
                          <Store className="h-6 w-6" />
                          <span className="text-xs font-medium whitespace-nowrap">
                            Become a Seller
                          </span>
                        </button>

                        {/* More Options Dropdown */}
                        <div className="relative more-dropdown">
                          <button
                            onClick={handleMoreDropdownToggle}
                            className="flex flex-col items-center space-y-1 text-gray-700 hover:text-blue-600 transition-colors duration-200 px-2 py-1"
                            aria-label="More options"
                          >
                            <MoreVertical className="h-6 w-6" />
                            <span className="text-xs font-medium">More</span>
                          </button>

                          {/* More Options Dropdown Menu */}
                          {showMoreDropdown && (
                            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                              <div className="py-2">
                                <button
                                  onClick={() =>
                                    handleMoreOptionClick(() =>
                                      navigate("/notification-preferences")
                                    )
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                                >
                                  Notification Preferences
                                </button>
                                <button
                                  onClick={() =>
                                    handleMoreOptionClick(() =>
                                      navigate("/customer-care")
                                    )
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
                                >
                                  24x7 Customer Care
                                </button>
                                <button
                                  onClick={() =>
                                    handleMoreOptionClick(() => {
                                      // Navigate to download app page
                                      navigate("/download-app");
                                    })
                                  }
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200 flex items-center space-x-2"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                                  </svg>
                                  <span>Download App</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main
            id="main-content"
            className={`flex-1 z-base ${
              auth.isAuthenticated || isDelivery ? "pb-16" : "pb-4"
            }`}
            role="main"
            tabIndex={-1}
          >
            <CartFeedbackProvider 
              triggerCartConfirmation={triggerCartConfirmation}
              triggerGlobalConfirmation={triggerGlobalConfirmation}
            >
              {children}
            </CartFeedbackProvider>
          </main>

          {/* Bottom Navigation */}
          {!shouldHideBottomNav && <BottomNav />}
        </div>

        {/* Location Selection Modal */}
        <ChooseLocation
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onAddressSelect={handleAddressSelect}
          addresses={addresses}
          defaultAddressId={defaultAddressId}
        />

        {/* Cart Confirmation Bar */}
        <CartConfirmationBar
          isVisible={confirmationBar.isVisible}
          productName={confirmationBar.productName}
          productImage={confirmationBar.productImage}
          onClose={closeConfirmation}
        />

        {/* Global Cart Confirmation Bar - Slides from Top */}
        <GlobalCartConfirmationBar
          isVisible={globalConfirmationBar.isVisible}
          productName={globalConfirmationBar.productName}
          productImage={globalConfirmationBar.productImage}
          currentCartCount={globalConfirmationBar.cartCount}
          cartTotal={globalConfirmationBar.cartTotal}
          onClose={closeGlobalConfirmation}
        />

      </div>
    </ToastProvider>
  );
};

export default Layout;
