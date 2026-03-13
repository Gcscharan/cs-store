import { Provider } from "react-redux";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "./store";
import { store } from "./store";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from "./contexts/LanguageContext";
import { OtpModalProvider } from "./contexts/OtpModalContext";
import { CurrencyProvider } from "./contexts/CurrencyContext";
import Layout from "./components/Layout";
import AuthGate from "./components/AuthGate";
import GlobalErrorBoundary from "./components/GlobalErrorBoundary";
import { lazy } from "react";
import CartInitializer from "./components/CartInitializer";
import AuthInitializer from "./components/AuthInitializer";
import { registerTokenGetter, registerTokenSetter, registerLogoutAction } from "./config/api";
import { registerAuthClientDispatch } from "./utils/authClient";
import { registerAuthUtilsStoreAccess } from "./utils/authUtils";
import { setTokens, logout } from "./store/slices/authSlice";

const loadHomePage = () =>
  import(/* webpackChunkName: "page-home" */ "./pages/HomePage");
const HomePage = lazy(loadHomePage);
if (typeof window !== "undefined") {
  loadHomePage();
}

// Register token getter for axios interceptor
try {
  registerTokenGetter(() => {
    try {
      const state = store.getState() as RootState;
      return {
        accessToken: state.auth?.tokens?.accessToken || null,
        refreshToken: state.auth?.tokens?.refreshToken || null,
      };
    } catch {
      return { accessToken: null, refreshToken: null };
    }
  });
} catch {}

// Register token setter for axios interceptor (dispatches to Redux)
try {
  registerTokenSetter((tokens) => {
    try {
      store.dispatch(setTokens(tokens));
    } catch {}
  });
} catch {}

// Register logout action for axios interceptor
try {
  registerLogoutAction(() => {
    try {
      store.dispatch(logout());
    } catch {}
  });
} catch {}

// Legacy: Register auth client dispatch for authClient.ts utilities
try {
  registerAuthClientDispatch((action) => {
    try {
      store.dispatch(action as any);
    } catch {
    }
  });
} catch {
}

// Legacy: Register auth utils store access
try {
  registerAuthUtilsStoreAccess({
    dispatch: (action) => {
      try {
        store.dispatch(action as any);
      } catch {
      }
    },
    getState: () => {
      try {
        return store.getState();
      } catch {
        return null;
      }
    },
  });
} catch {
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
const AdminFinancePage = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./pages/AdminFinancePage")
);
const AdminProfilePage = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./pages/AdminProfilePage")
);
const AdminSettingsPage = lazy(() =>
  import(/* webpackChunkName: "page-admin" */ "./pages/AdminSettingsPage")
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

// AuthRouter - Main routing component using centralized AuthGate
function AuthRouter() {
  const { status } = useSelector((state: RootState) => state.auth);

  // Show loading while auth initializes
  if (status === "LOADING") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* ========== PUBLIC ROUTES ========== */}
      <Route
        path="/"
        element={
          <Layout>
            <HomePage />
          </Layout>
        }
      />
      <Route
        path="/login"
        element={
          <Layout>
            <LoginPage />
          </Layout>
        }
      />
      <Route path="/signup" element={<Layout><SignupPage /></Layout>} />
      <Route path="/privacy" element={<Layout><PrivacyPolicyPage /></Layout>} />
      <Route path="/terms" element={<Layout><TermsConditionsPage /></Layout>} />
      <Route path="/cancellation" element={<Layout><CancellationReturnsPage /></Layout>} />
      <Route path="/products" element={<Layout><ProductsPage /></Layout>} />
      <Route path="/search" element={<Layout><SearchResultsPage /></Layout>} />
      <Route path="/product/:id" element={<Layout><ProductDetailPage /></Layout>} />
      <Route path="/menu" element={<Layout><MenuPage /></Layout>} />
      <Route path="/download-app" element={<Layout><DownloadAppPage /></Layout>} />
      <Route path="/contact-us" element={<Layout><ContactUsPage /></Layout>} />
      <Route path="/customer-care" element={<Layout><CustomerCarePage /></Layout>} />
      <Route path="/about-us" element={<Layout><AboutUsPage /></Layout>} />
      <Route path="/careers" element={<Layout><CareersPage /></Layout>} />
      <Route path="/cs-store-stories" element={<Layout><CSStoreStoriesPage /></Layout>} />
      <Route path="/corporate-information" element={<Layout><CorporateInformationPage /></Layout>} />
      <Route path="/categories" element={<Layout><CategoriesPage /></Layout>} />
      <Route path="/help-support" element={<Layout><HelpSupportPage /></Layout>} />
      <Route path="/become-seller" element={<Layout><ComingSoonPage /></Layout>} />

      {/* ========== OAUTH & ONBOARDING ========== */}
      <Route path="/auth/callback" element={<OAuthCallbackPage />} />
      <Route
        path="/onboarding/complete-profile"
        element={
          <AuthGate requireAuth allowOnboarding>
            <Layout><OnboardingPage /></Layout>
          </AuthGate>
        }
      />

      {/* ========== CUSTOMER PROTECTED ROUTES ========== */}
      <Route
        path="/dashboard"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout hideBottomNav={true}><DashboardPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/cart"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><CartPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/checkout"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><CheckoutPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/order-success/:orderId"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><OrderSuccessPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/orders"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><OrdersPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/orders/:orderId"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><OrderDetailsPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/order/:id"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><OrderTrackingPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/profile"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><ProfilePage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/addresses"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><AddressesPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/notification-preferences"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><NotificationPreferencesPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/settings"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><SettingsPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/account"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><AccountPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/account/profile"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><AccountPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/account/profile/edit"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><EditProfilePage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/account/settings"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><SettingsPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/account/notifications"
        element={
          <AuthGate requireAuth requiredRole="customer">
            <Layout><NotificationsPage /></Layout>
          </AuthGate>
        }
      />

      {/* ========== ADMIN ROUTES ========== */}
      <Route
        path="/admin"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminDashboard />
          </AuthGate>
        }
      />
      <Route
        path="/admin/products"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminProductsPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/products/new"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <ProductCreatePage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminUsersPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminOrdersPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/orders/:orderId"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminOrderDetailsPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/routes"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminRoutesPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/routes/recent"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminRecentRoutesPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/routes/preview"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminRoutesPreviewPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/routes/:routeId"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminRouteDetailPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/routes/:routeId/map"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminRouteMapPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/delivery-boys"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminDeliveryBoysPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/analytics"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminAnalyticsPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/finance"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminFinancePage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/payments"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <PaymentLogs />
          </AuthGate>
        }
      />
      <Route
        path="/admin/ops/payments/recovery"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <PaymentsRecoveryPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/ops/finance"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <FinanceReportsPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminSettingsPage />
          </AuthGate>
        }
      />
      <Route
        path="/admin-profile"
        element={
          <AuthGate requireAuth requiredRole="admin">
            <AdminProfilePage />
          </AuthGate>
        }
      />

      {/* ========== DELIVERY PARTNER ROUTES ========== */}
      <Route path="/delivery/signup" element={<DeliverySignup />} />
      <Route path="/delivery/login" element={<DeliveryLogin />} />
      <Route
        path="/delivery"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <DeliveryDashboard />
          </AuthGate>
        }
      />
      <Route
        path="/delivery/dashboard"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <DeliveryDashboard />
          </AuthGate>
        }
      />
      <Route
        path="/delivery/profile"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <DeliveryProfilePage />
          </AuthGate>
        }
      />
      <Route
        path="/delivery/earnings-info"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <WaysToEarnPage />
          </AuthGate>
        }
      />
      <Route
        path="/delivery/refer"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <ReferAndEarnPage />
          </AuthGate>
        }
      />
      <Route
        path="/delivery/support"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <HelpSupportPage />
          </AuthGate>
        }
      />
      <Route
        path="/delivery/messages"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <MessageCenterPage />
          </AuthGate>
        }
      />
      <Route
        path="/delivery/settings"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <DeliverySettingsPage />
          </AuthGate>
        }
      />
      <Route
        path="/delivery-selfie"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <DeliverySelfiePage />
          </AuthGate>
        }
      />
      <Route
        path="/delivery-profile"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <DeliveryProfilePage />
          </AuthGate>
        }
      />
      <Route
        path="/delivery/emergency"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <DeliveryEmergencyPage />
          </AuthGate>
        }
      />
      <Route
        path="/delivery/help-center"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <DeliveryHelpCenterPage />
          </AuthGate>
        }
      />
      <Route
        path="/delivery-settings"
        element={
          <AuthGate requireAuth requiredRole="delivery">
            <DeliverySettingsPage />
          </AuthGate>
        }
      />

      {/* ========== SHARED AUTH ROUTES ========== */}
      <Route
        path="/ways-to-earn"
        element={
          <AuthGate requireAuth>
            <Layout><WaysToEarnPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/refer-and-earn"
        element={
          <AuthGate requireAuth>
            <Layout><ReferAndEarnPage /></Layout>
          </AuthGate>
        }
      />
      <Route
        path="/message-center"
        element={
          <AuthGate requireAuth>
            <Layout><MessageCenterPage /></Layout>
          </AuthGate>
        }
      />

      {/* ========== DEBUG ROUTES ========== */}
      <Route path="/test-otp" element={<TestOtpPage />} />
      <Route path="/debug" element={<DebugPage />} />

      {/* ========== LEGACY REDIRECTS ========== */}
      <Route path="/admin-login" element={<Navigate to="/login" replace />} />
      <Route path="/admin/login" element={<Navigate to="/login" replace />} />

      {/* ========== CATCH-ALL ========== */}
      <Route
        path="*"
        element={<Navigate to={status !== "UNAUTHENTICATED" ? "/dashboard" : "/login"} replace />}
      />
    </Routes>
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

                {/* AuthInitializer wraps entire app - stabilizes auth before any routes */}
                <AuthInitializer>
                  {/* Hydrate cart from backend for authenticated users */}
                  <CartInitializer />

                  <Routes>
                    {/* Main app routes with centralized AuthGate */}
                    <Route path="/*" element={<AuthRouter />} />
                  </Routes>
                </AuthInitializer>
              </Router>
            </OtpModalProvider>
          </LanguageProvider>
        </CurrencyProvider>
      </GlobalErrorBoundary>
    </Provider>
  );
}

export default App;
