import { Provider } from "react-redux";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { store } from "./store";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "./contexts/LanguageContext";
import { OtpModalProvider } from "./contexts/OtpModalContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import PaymentPage from "./pages/PaymentPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrdersPage from "./pages/OrdersPage";
import OrderDetailsPage from "./pages/OrderDetailsPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import ProfilePage from "./pages/ProfilePage";
import AddressesPage from "./pages/AddressesPage";
import SignupPage from "./pages/SignupPage";
import MenuPage from "./pages/MenuPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminProductsPage from "./pages/AdminProductsPage";
import ProductCreatePage from "./pages/Admin/ProductCreatePage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminOrderDetailsPage from "./pages/AdminOrderDetailsPage";
import AdminDeliveryBoysPage from "./pages/AdminDeliveryBoysPage";
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import PaymentLogs from "./components/PaymentLogs";
import AdminRoute from "./components/AdminRoute";
import DeliveryDashboard from "./pages/DeliveryDashboard";
import DeliverySignup from "./pages/DeliverySignup";
import DeliveryLogin from "./pages/DeliveryLogin";
import DeliveryProfilePage from "./pages/DeliveryProfilePage";
import DeliverySelfiePage from "./pages/DeliverySelfiePage";
import DeliveryEmergencyPage from "./pages/DeliveryEmergencyPage";
import DeliveryHelpCenterPage from "./pages/DeliveryHelpCenterPage";
import WaysToEarnPage from "./pages/WaysToEarnPage";
import ReferAndEarnPage from "./pages/ReferAndEarnPage";
import HelpSupportPage from "./pages/HelpSupportPage";
import MessageCenterPage from "./pages/MessageCenterPage";
import DeliverySettingsPage from "./pages/DeliverySettingsPage";
import CategoriesPage from "./pages/CategoriesPage";
import AccountPage from "./pages/AccountPage";
import EditProfilePage from "./pages/EditProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import OAuthCallbackPage from "./pages/OAuthCallbackPage";
import TestOtpPage from "./pages/TestOtpPage";
import DebugPage from "./pages/DebugPage";
import ComingSoonPage from "./pages/ComingSoonPage";
import DownloadAppPage from "./pages/DownloadAppPage";
import SearchResultsPage from "./pages/SearchResultsPage";
import ContactUsPage from "./pages/ContactUsPage";
import AboutUsPage from "./pages/AboutUsPage";
import CareersPage from "./pages/CareersPage";
import CSStoreStoriesPage from "./pages/CSStoreStoriesPage";
import CorporateInformationPage from "./pages/CorporateInformationPage";
import CustomerCarePage from "./pages/CustomerCarePage";
import NotificationPreferencesPage from "./pages/NotificationPreferencesPage";
import SettingsPage from "./pages/SettingsPage";
import { useGetProfileQuery } from "./store/api";
import { ReactNode } from "react";

// Wrapper component to check profile completion for non-admin users
function ProfileCompletionWrapper({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  // Fetch profile to check completion status
  const {
    data: profile,
    isLoading,
    isFetching,
    isUninitialized,
  } = useGetProfileQuery(undefined, {
    skip: !isAuthenticated,
  });

  // If user is admin, bypass profile check
  if (user?.isAdmin || user?.role === "admin") {
    return <>{children}</>;
  }

  // While authenticated user's profile data is not yet ready, block redirects
  const isProfileDataPending =
    isAuthenticated && (isLoading || isFetching || isUninitialized);

  if (isProfileDataPending) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Explicit, tolerant profile completion check
  const hasName = typeof profile?.name === "string" && profile.name.trim().length > 0 || 
                  typeof profile?.fullName === "string" && profile.fullName.trim().length > 0;
  const hasPhone = typeof profile?.phone === "string" && profile.phone.trim().length > 0;
  const isProfileComplete = hasName && hasPhone;

  // Route classifications
  const isOnboardingRoute = location.pathname.startsWith("/onboarding");
  const isAuthCallbackRoute = location.pathname.startsWith("/auth/callback");
  const isPublicRoute =
    location.pathname === "/" ||
    location.pathname === "/signup" ||
    location.pathname === "/login" ||
    location.pathname === "/download-app" ||
    location.pathname === "/contact-us" ||
    location.pathname === "/about-us" ||
    location.pathname === "/careers" ||
    location.pathname === "/cs-store-stories" ||
    location.pathname === "/corporate-information" ||
    location.pathname.startsWith("/auth/callback");

  // Only redirect authenticated, non-admin users with clearly incomplete profiles
  // away from non-onboarding, non-public routes
  if (
    isAuthenticated &&
    !isProfileComplete &&
    !isOnboardingRoute &&
    !isPublicRoute &&
    !isAuthCallbackRoute
  ) {
    return <Navigate to="/onboarding/complete-profile" replace />;
  }

  // Profile is complete or user is on onboarding/public/auth callback page, render children
  return <>{children}</>;
}

// Component to handle authentication-based routing with role and profile checks
function AuthRouter() {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const location = useLocation();
  
  // Check if user is in logout process (check for logout flag in localStorage)
  const isLoggingOut = typeof window !== 'undefined' && localStorage.getItem('isLoggingOut') === 'true';

  // PRIORITY 1: Check for Admin Role FIRST - bypass onboarding checks and send admins to /admin
  if (isAuthenticated && (user?.isAdmin || user?.role === "admin") && !isLoggingOut) {
    // If admin is trying to access onboarding, redirect to admin dashboard
    if (location.pathname === "/onboarding/complete-profile") {
      return <Navigate to="/admin" replace />;
    }
    // Allow admin to access admin routes, dashboard, or auth callbacks
    // Don't force redirect to admin if user explicitly wants to see user dashboard
    if (!location.pathname.startsWith("/admin") && 
        !location.pathname.startsWith("/auth/callback") && 
        location.pathname !== "/dashboard") {
      return <Navigate to="/admin" replace />;
    }
  }

  // PRIORITY 2: For non-admin authenticated users, profile completion is enforced
  // only on specific routes (e.g. /dashboard via ProfileCompletionWrapper).
  // The root ("/") route should always show the public home page instead of
  // forcing a redirect to /dashboard, so users are not locked into onboarding.

  return (
    <Routes>
      {/* Root route - always show HomePage, regardless of auth status */}
      <Route
        path="/"
        element={
          <Layout>
            <HomePage />
          </Layout>
        }
      />

      {/* Login route - always accessible */}
      <Route
        path="/login"
        element={
          <Layout>
            <HomePage />
          </Layout>
        }
      />

      {/* Dashboard route for logged-in users */}
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? (
            // Check admin first
            (user?.isAdmin || user?.role === "admin") ? (
              <Navigate to="/admin" replace />
            ) : (
              <ProfileCompletionWrapper>
                <Layout hideBottomNav={true}>
                  <DashboardPage />
                </Layout>
              </ProfileCompletionWrapper>
            )
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* All other routes - don't check profile completion here */}
      <Route path="/*" element={<OtherRoutes />} />
    </Routes>
  );
}

// Component for all other routes
function OtherRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/search" element={<SearchResultsPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route
          path="/cart"
          element={
            <ProtectedRoute>
              <CartPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment"
          element={
            <ProtectedRoute>
              <PaymentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <OrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/:orderId"
          element={
            <ProtectedRoute>
              <OrderDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/order/:id"
          element={
            <ProtectedRoute>
              <OrderTrackingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/become-seller" element={<ComingSoonPage />} />
        <Route path="/download-app" element={<DownloadAppPage />} />
        <Route path="/contact-us" element={<ContactUsPage />} />
        <Route path="/customer-care" element={<CustomerCarePage />} />
        <Route
          path="/notification-preferences"
          element={
            <ProtectedRoute redirectTo="/login">
              <NotificationPreferencesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/about-us" element={<AboutUsPage />} />
        <Route path="/careers" element={<CareersPage />} />
        <Route path="/cs-store-stories" element={<CSStoreStoriesPage />} />
        <Route
          path="/corporate-information"
          element={<CorporateInformationPage />}
        />
        <Route path="/menu" element={<MenuPage />} />
        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <AdminRoute>
              <AdminProductsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/products/new"
          element={
            <AdminRoute>
              <ProductCreatePage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <AdminRoute>
              <AdminOrdersPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/orders/:orderId"
          element={
            <AdminRoute>
              <AdminOrderDetailsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/delivery-boys"
          element={
            <AdminRoute>
              <AdminDeliveryBoysPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/analytics"
          element={
            <AdminRoute>
              <AdminAnalyticsPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <AdminRoute>
              <PaymentLogs />
            </AdminRoute>
          }
        />
        <Route
          path="/admin-profile"
          element={
            <AdminRoute>
              <AdminProfilePage />
            </AdminRoute>
          }
        />
        {/* Delivery Partner Routes */}
        <Route path="/delivery/signup" element={<DeliverySignup />} />
        <Route path="/delivery/login" element={<DeliveryLogin />} />
        <Route path="/delivery" element={<DeliveryDashboard />} />
        <Route path="/delivery/dashboard" element={<DeliveryDashboard />} />
        <Route path="/delivery-selfie" element={<DeliverySelfiePage />} />
        <Route path="/delivery-profile" element={<DeliveryProfilePage />} />
        <Route path="/delivery/emergency" element={<DeliveryEmergencyPage />} />
        <Route
          path="/delivery/help-center"
          element={<DeliveryHelpCenterPage />}
        />
        <Route path="/ways-to-earn" element={<WaysToEarnPage />} />
        <Route path="/refer-and-earn" element={<ReferAndEarnPage />} />
        <Route path="/help-support" element={<HelpSupportPage />} />
        <Route path="/message-center" element={<MessageCenterPage />} />
        <Route path="/delivery-settings" element={<DeliverySettingsPage />} />
        {/* Redirect old admin-login route to main login */}
        <Route path="/admin-login" element={<Navigate to="/login" replace />} />
        {/* Admin login route */}
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/profile"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/profile/edit"
          element={
            <ProtectedRoute>
              <EditProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/account/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/addresses"
          element={
            <ProtectedRoute>
              <AddressesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/test-otp" element={<TestOtpPage />} />
        <Route path="/debug" element={<DebugPage />} />
        {/* Catch-all route for unmatched paths - show 404 or redirect based on auth */}
        <Route 
          path="*" 
          element={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
                <p className="text-gray-600 mb-4">Page not found</p>
                <a href="/" className="text-blue-600 hover:text-blue-700 underline">
                  Go to Home
                </a>
              </div>
            </div>
          } 
        />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <Provider store={store}>
      <GlobalErrorBoundary>
        <CurrencyProvider>
          <LanguageProvider>
            <OtpModalProvider>
              <Router>
                  <Toaster
                    position="top-center"
                    toastOptions={{
                      duration: 3000,
                      style: {
                        background: '#363636',
                        color: '#fff',
                      },
                      success: {
                        duration: 3000,
                        iconTheme: {
                          primary: '#4ade80',
                          secondary: '#fff',
                        },
                      },
                    }}
                  />

                  <Routes>
                    {/* Main app routes with authentication-based routing */}
                    <Route path="/*" element={<AuthRouter />} />
                  </Routes>
                </Router>
              </OtpModalProvider>
            </LanguageProvider>
          </CurrencyProvider>
      </GlobalErrorBoundary>
    </Provider>
  );
}

export default App;
