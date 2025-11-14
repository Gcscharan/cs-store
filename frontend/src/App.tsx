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
import Layout from "./components/Layout";
import LoginLayout from "./components/LoginLayout";
import ProtectedRoute from "./components/ProtectedRoute";
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
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import MenuPage from "./pages/MenuPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminProductsPage from "./pages/AdminProductsPage";
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
import AddressPage from "./pages/AddressPage";
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
import OnboardingPage from "./pages/OnboardingPage";
import CartInitializer from "./components/CartInitializer";
import ThemeInitializer from "./components/ThemeInitializer";

// Component to handle authentication-based routing
function AuthRouter() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  return (
    <Routes>
      {/* Root route - redirect based on authentication */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Layout>
              <HomePage />
            </Layout>
          )
        }
      />

      {/* Dashboard route for logged-in users */}
      <Route
        path="/dashboard"
        element={
          isAuthenticated ? (
            <Layout hideBottomNav={true}>
              <DashboardPage />
            </Layout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* All other routes */}
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
          element={<NotificationPreferencesPage />}
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
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <Provider store={store}>
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
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                },
                error: {
                  duration: 4000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                },
              }}
            />
            <ThemeInitializer />
            <CartInitializer />
            <Routes>
              {/* Login page redirects to homepage with login modal */}
              <Route
                path="/login"
                element={<Navigate to="/?showLogin=true" replace />}
              />

              {/* Onboarding route (standalone, no layout) */}
              <Route path="/onboarding/complete-profile" element={<OnboardingPage />} />

              {/* Main app routes with authentication-based routing */}
              <Route path="/*" element={<AuthRouter />} />
            </Routes>
          </Router>
        </OtpModalProvider>
      </LanguageProvider>
    </Provider>
  );
}

export default App;
