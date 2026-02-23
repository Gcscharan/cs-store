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
import RoleProtectedRoute from "./components/RoleProtectedRoute";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary";
import AdminRoute from "./components/AdminRoute";
import { ReactNode, lazy } from "react";
import CartInitializer from "./components/CartInitializer";
import AuthInitializer from "./components/AuthInitializer";
import { authRedirect } from "./utils/authRedirect";

const loadHomePage = () =>
  import(/* webpackChunkName: "page-home" */ "./pages/HomePage");
const HomePage = lazy(loadHomePage);
if (typeof window !== "undefined") {
  loadHomePage();
}

const DashboardPage = lazy(() =>
  import(/* webpackChunkName: "page-dashboard" */ "./pages/DashboardPage")
);
const ProductsPage = lazy(() =>
  import(/* webpackChunkName: "page-products" */ "./pages/ProductsPage")
);
const ProductDetailPage = lazy(() =>
  import(
    /* webpackChunkName: "page-product-detail" */ "./pages/ProductDetailPage"
  )
);
const CartPage = lazy(() => import(/* webpackChunkName: "page-cart" */ "./pages/CartPage"));
const CheckoutPage = lazy(() =>
  import(/* webpackChunkName: "page-checkout" */ "./pages/CheckoutPage")
);
const OrderSuccessPage = lazy(() =>
  import(/* webpackChunkName: "page-order-success" */ "./pages/OrderSuccessPage")
);
const OrdersPage = lazy(() =>
  import(/* webpackChunkName: "page-orders" */ "./pages/OrdersPage")
);
const OrderDetailsPage = lazy(() =>
  import(/* webpackChunkName: "page-order-details" */ "./pages/OrderDetailsPage")
);
const OrderTrackingPage = lazy(() =>
  import(/* webpackChunkName: "page-order-tracking" */ "./pages/OrderTrackingPage")
);
const ProfilePage = lazy(() =>
  import(/* webpackChunkName: "page-profile" */ "./pages/ProfilePage")
);
const AddressesPage = lazy(() =>
  import(/* webpackChunkName: "page-addresses" */ "./pages/AddressesPage")
);
const SignupPage = lazy(() =>
  import(/* webpackChunkName: "page-signup" */ "./pages/SignupPage")
);
const LoginPage = lazy(() =>
  import(/* webpackChunkName: "page-login" */ "./pages/LoginPage")
);
const MenuPage = lazy(() => import(/* webpackChunkName: "page-menu" */ "./pages/MenuPage"));
const AdminDashboard = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./pages/AdminDashboard")
);
const AdminProductsPage = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./pages/AdminProductsPage")
);
const ProductCreatePage = lazy(() =>
  import(
    /* webpackChunkName: "page-admin" */ "./pages/Admin/ProductCreatePage"
  )
);
const AdminUsersPage = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./pages/AdminUsersPage")
);
const AdminOrdersPage = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./pages/AdminOrdersPage")
);
const AdminOrderDetailsPage = lazy(() =>
  import(
    /* webpackChunkName: "page-admin" */ "./pages/AdminOrderDetailsPage"
  )
);
const AdminRoutesPage = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./pages/AdminRoutesPage")
);
const AdminRoutesPreviewPage = lazy(() =>
  import(
    /* webpackChunkName: "page-admin" */ "./pages/AdminRoutesPreviewPage"
  )
);
const AdminRecentRoutesPage = lazy(() =>
  import(
    /* webpackChunkName: "page-admin" */ "./pages/AdminRecentRoutesPage"
  )
);
const AdminRouteDetailPage = lazy(() =>
  import(
    /* webpackChunkName: "page-admin" */ "./pages/AdminRouteDetailPage"
  )
);
const AdminRouteMapPage = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./pages/AdminRouteMapPage")
);
const AdminDeliveryBoysPage = lazy(() =>
  import(
    /* webpackChunkName: "page-admin" */ "./pages/AdminDeliveryBoysPage"
  )
);
const AdminAnalyticsPage = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./pages/AdminAnalyticsPage")
);
const AdminProfilePage = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./pages/AdminProfilePage")
);
const PaymentLogs = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./components/PaymentLogs")
);
const PaymentsRecoveryPage = lazy(() =>
  import(
    /* webpackChunkName: "page-admin-ops" */ "./admin/ops/payments/recovery/PaymentsRecoveryPage"
  )
);
const FinanceReportsPage = lazy(() =>
  import(
    /* webpackChunkName: "page-admin-ops" */ "./admin/ops/finance/FinanceReportsPage"
  )
);
const DeliveryDashboard = lazy(() =>
  import(
    /* webpackChunkName: "page-delivery" */ "./pages/DeliveryDashboard"
  )
);
const DeliverySignup = lazy(() =>
  import(/* webpackChunkName: "page-delivery" */ "./pages/DeliverySignup")
);
const DeliveryLogin = lazy(() =>
  import(/* webpackChunkName: "page-delivery" */ "./pages/DeliveryLogin")
);
const DeliveryProfilePage = lazy(() =>
  import(
    /* webpackChunkName: "page-delivery" */ "./pages/DeliveryProfilePage"
  )
);
const DeliverySelfiePage = lazy(() =>
  import(
    /* webpackChunkName: "page-delivery" */ "./pages/DeliverySelfiePage"
  )
);
const DeliveryEmergencyPage = lazy(() =>
  import(
    /* webpackChunkName: "page-delivery" */ "./pages/DeliveryEmergencyPage"
  )
);
const DeliveryHelpCenterPage = lazy(() =>
  import(
    /* webpackChunkName: "page-delivery" */ "./pages/DeliveryHelpCenterPage"
  )
);
const WaysToEarnPage = lazy(() =>
  import(/* webpackChunkName: "page-delivery" */ "./pages/WaysToEarnPage")
);
const ReferAndEarnPage = lazy(() =>
  import(
    /* webpackChunkName: "page-delivery" */ "./pages/ReferAndEarnPage"
  )
);
const HelpSupportPage = lazy(() =>
  import(
    /* webpackChunkName: "page-delivery" */ "./pages/HelpSupportPage"
  )
);
const MessageCenterPage = lazy(() =>
  import(
    /* webpackChunkName: "page-delivery" */ "./pages/MessageCenterPage"
  )
);
const DeliverySettingsPage = lazy(() =>
  import(
    /* webpackChunkName: "page-delivery" */ "./pages/DeliverySettingsPage"
  )
);
const CategoriesPage = lazy(() =>
  import(/* webpackChunkName: "page-misc" */ "./pages/CategoriesPage")
);
const AccountPage = lazy(() =>
  import(/* webpackChunkName: "page-account" */ "./pages/AccountPage")
);
const EditProfilePage = lazy(() =>
  import(/* webpackChunkName: "page-account" */ "./pages/EditProfilePage")
);
const NotificationsPage = lazy(() =>
  import(
    /* webpackChunkName: "page-account" */ "./pages/NotificationsPage"
  )
);
const OAuthCallbackPage = lazy(() =>
  import(
    /* webpackChunkName: "page-misc" */ "./pages/OAuthCallbackPage"
  )
);
const OnboardingPage = lazy(() =>
  import(/* webpackChunkName: "page-misc" */ "./pages/OnboardingPage")
);
const TestOtpPage = lazy(() =>
  import(/* webpackChunkName: "page-misc" */ "./pages/TestOtpPage")
);
const DebugPage = lazy(() =>
  import(/* webpackChunkName: "page-misc" */ "./pages/DebugPage")
);
const ComingSoonPage = lazy(() =>
  import(/* webpackChunkName: "page-misc" */ "./pages/ComingSoonPage")
);
const DownloadAppPage = lazy(() =>
  import(/* webpackChunkName: "page-misc" */ "./pages/DownloadAppPage")
);
const SearchResultsPage = lazy(() =>
  import(
    /* webpackChunkName: "page-products" */ "./pages/SearchResultsPage"
  )
);
const ContactUsPage = lazy(() =>
  import(/* webpackChunkName: "page-misc" */ "./pages/ContactUsPage")
);
const AboutUsPage = lazy(() =>
  import(/* webpackChunkName: "page-misc" */ "./pages/AboutUsPage")
);
const CareersPage = lazy(() =>
  import(/* webpackChunkName: "page-misc" */ "./pages/CareersPage")
);
const CSStoreStoriesPage = lazy(() =>
  import(
    /* webpackChunkName: "page-misc" */ "./pages/CSStoreStoriesPage"
  )
);
const CorporateInformationPage = lazy(() =>
  import(
    /* webpackChunkName: "page-misc" */ "./pages/CorporateInformationPage"
  )
);
const CustomerCarePage = lazy(() =>
  import(
    /* webpackChunkName: "page-misc" */ "./pages/CustomerCarePage"
  )
);
const NotificationPreferencesPage = lazy(() =>
  import(
    /* webpackChunkName: "page-misc" */ "./pages/NotificationPreferencesPage"
  )
);
const SettingsPage = lazy(() =>
  import(/* webpackChunkName: "page-account" */ "./pages/SettingsPage")
);
const PrivacyPolicyPage = lazy(() =>
  import(/* webpackChunkName: "page-misc" */ "./pages/PrivacyPolicyPage")
);
const TermsConditionsPage = lazy(() =>
  import(/* webpackChunkName: "page-misc" */ "./pages/TermsConditionsPage")
);
const CancellationReturnsPage = lazy(() =>
  import(
    /* webpackChunkName: "page-misc" */ "./pages/CancellationReturnsPage"
  )
);

// Centralized auth guard using Redux auth state (authoritative)
function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading, user, authState } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  const role = user?.isAdmin || user?.role === "admin" ? "admin" : (user?.role || "customer");
  const canonical = authRedirect({
    authState: (authState ?? null) as any,
    pathname: location.pathname,
    role: role as any,
    isProtected: true,
  });

  // 1) While loading, show spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (canonical) {
    return <Navigate to={canonical} state={{ from: location }} replace />;
  }

  // 2) If not authenticated, redirect to login (preserve intended destination)
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3) Admins bypass profile check
  if (user?.isAdmin || user?.role === "admin") {
    return <>{children}</>;
  }

  // All checks passed: render children
  return <>{children}</>;
}

// Component to handle authentication-based routing with role and profile checks
function AuthRouter() {
  const { user, authState, loading } = useSelector((state: RootState) => state.auth);
  const location = useLocation();

  if (!loading) {
    const role = user?.isAdmin || user?.role === "admin" ? "admin" : (user?.role || "customer");

    const isPublicRoute =
      location.pathname === "/" ||
      location.pathname === "/signup" ||
      location.pathname === "/login" ||
      location.pathname === "/download-app" ||
      location.pathname === "/contact-us" ||
      location.pathname === "/privacy" ||
      location.pathname === "/terms" ||
      location.pathname === "/cancellation" ||
      location.pathname === "/about-us" ||
      location.pathname === "/careers" ||
      location.pathname.startsWith("/cs-store-stories") ||
      location.pathname === "/corporate-information" ||
      location.pathname.startsWith("/auth/callback");

    const redirect = authRedirect({
      authState: (authState ?? null) as any,
      pathname: location.pathname,
      role: role as any,
      isProtected: !isPublicRoute,
    });

    if (redirect && redirect !== location.pathname) {
      return <Navigate to={redirect} replace />;
    }
  }

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
            <LoginPage />
          </Layout>
        }
      />

      <Route
        path="/privacy"
        element={
          <Layout>
            <PrivacyPolicyPage />
          </Layout>
        }
      />

      <Route
        path="/terms"
        element={
          <Layout>
            <TermsConditionsPage />
          </Layout>
        }
      />

      <Route
        path="/cancellation"
        element={
          <Layout>
            <CancellationReturnsPage />
          </Layout>
        }
      />

      {/* Dashboard route for logged-in users */}
      <Route
        path="/dashboard"
        element={
          // AuthGuard is the single entry for auth redirect decisions.
          <AuthGuard>
            <Layout hideBottomNav={true}>
              <DashboardPage />
            </Layout>
          </AuthGuard>
        }
      />

      {/* All other routes - don't check profile completion here */}
      <Route path="/*" element={<OtherRoutes />} />
    </Routes>
  );
}

// Component for all other routes
function OtherRoutes() {
  const { authState } = useSelector((state: RootState) => state.auth);

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
          path="/checkout"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/order-success/:orderId"
          element={
            <ProtectedRoute>
              <OrderSuccessPage />
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
        <Route
          path="/onboarding/complete-profile"
          element={
            <ProtectedRoute>
              <OnboardingPage />
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
          path="/admin/routes"
          element={
            <AdminRoute>
              <AdminRoutesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/routes/recent"
          element={
            <AdminRoute>
              <AdminRecentRoutesPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/routes/preview"
          element={
            <AdminRoute>
              <AdminRoutesPreviewPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/routes/:routeId"
          element={
            <AdminRoute>
              <AdminRouteDetailPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/routes/:routeId/map"
          element={
            <AdminRoute>
              <AdminRouteMapPage />
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
          path="/admin/ops/payments/recovery"
          element={
            <AdminRoute>
              <PaymentsRecoveryPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/ops/finance"
          element={
            <AdminRoute>
              <FinanceReportsPage />
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
        {/* Delivery Partner Routes - Protected for delivery role only */}
        <Route path="/delivery/signup" element={<DeliverySignup />} />
        <Route path="/delivery/login" element={<DeliveryLogin />} />
        <Route 
          path="/delivery" 
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <DeliveryDashboard />
            </RoleProtectedRoute>
          } 
        />
        <Route 
          path="/delivery/dashboard" 
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <DeliveryDashboard />
            </RoleProtectedRoute>
          } 
        />
        <Route
          path="/delivery/profile"
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <DeliveryProfilePage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/delivery/earnings-info"
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <WaysToEarnPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/delivery/refer"
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <ReferAndEarnPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/delivery/support"
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <HelpSupportPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/delivery/messages"
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <MessageCenterPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/delivery/settings"
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <DeliverySettingsPage />
            </RoleProtectedRoute>
          }
        />
        <Route 
          path="/delivery-selfie" 
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <DeliverySelfiePage />
            </RoleProtectedRoute>
          } 
        />
        <Route 
          path="/delivery-profile" 
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <DeliveryProfilePage />
            </RoleProtectedRoute>
          } 
        />
        <Route 
          path="/delivery/emergency" 
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <DeliveryEmergencyPage />
            </RoleProtectedRoute>
          } 
        />
        <Route
          path="/delivery/help-center"
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <DeliveryHelpCenterPage />
            </RoleProtectedRoute>
          }
        />
        <Route 
          path="/delivery-settings" 
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]} unauthenticatedRedirectTo="/delivery/login">
              <DeliverySettingsPage />
            </RoleProtectedRoute>
          } 
        />
        <Route 
          path="/ways-to-earn" 
          element={
            <RoleProtectedRoute allowedRoles={["customer", "admin", "delivery"]} unauthenticatedRedirectTo="/login">
              <WaysToEarnPage />
            </RoleProtectedRoute>
          } 
        />
        <Route 
          path="/refer-and-earn" 
          element={
            <RoleProtectedRoute allowedRoles={["customer", "admin", "delivery"]} unauthenticatedRedirectTo="/login">
              <ReferAndEarnPage />
            </RoleProtectedRoute>
          } 
        />
        <Route path="/help-support" element={<HelpSupportPage />} />
        <Route 
          path="/message-center" 
          element={
            <RoleProtectedRoute allowedRoles={["customer", "admin", "delivery"]}>
              <MessageCenterPage />
            </RoleProtectedRoute>
          } 
        />
        <Route 
          path="/delivery-settings" 
          element={
            <RoleProtectedRoute allowedRoles={["delivery"]}>
              <DeliverySettingsPage />
            </RoleProtectedRoute>
          } 
        />
        {/* Redirect old admin-login route to main login */}
        <Route path="/admin-login" element={<Navigate to="/login" replace />} />
        {/* Admin login route */}
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />
        <Route path="/categories" element={<CategoriesPage />} />
        {/* Account Routes - Protected for customer role only (not delivery) */}
        <Route
          path="/account"
          element={
            <RoleProtectedRoute allowedRoles={["customer", "admin"]}>
              <AccountPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/account/profile"
          element={
            <RoleProtectedRoute allowedRoles={["customer", "admin"]}>
              <AccountPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/account/profile/edit"
          element={
            <RoleProtectedRoute allowedRoles={["customer", "admin"]}>
              <EditProfilePage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/account/settings"
          element={
            <RoleProtectedRoute allowedRoles={["customer", "admin"]}>
              <SettingsPage />
            </RoleProtectedRoute>
          }
        />
        <Route
          path="/account/notifications"
          element={
            <RoleProtectedRoute allowedRoles={["customer", "admin"]}>
              <NotificationsPage />
            </RoleProtectedRoute>
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
            <Navigate to={authState ? "/dashboard" : "/login"} replace />
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
                      background: "#363636",
                      color: "#fff",
                    },
                    success: {
                      duration: 3000,
                      iconTheme: {
                        primary: "#4ade80",
                        secondary: "#fff",
                      },
                    },
                  }}
                />

                {/* Hydrate cart from backend for authenticated users */}
                <CartInitializer />

                {/* Hydrate auth/profileCompleted from backend for authenticated users */}
                <AuthInitializer />

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
