import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Provider } from "react-redux";
import { store } from "./store";

// Pages
import HomePage from "./pages/HomePage";
import ProductsPage from "./pages/ProductsPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import CheckoutPage from "./pages/CheckoutPage";
import OrderTrackingPage from "./pages/OrderTrackingPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";
import MenuPage from "./pages/MenuPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminDeliveryMap from "./pages/AdminDeliveryMap";
import DeliveryDashboard from "./pages/DeliveryDashboard";

// Components
import Layout from "./components/Layout";
import TopNav from "./components/TopNav";
import BottomNav from "./components/BottomNav";
import FloatingCartCTA from "./components/FloatingCartCTA";
import AccessibilityAudit from "./components/AccessibilityAudit";

function App() {
  return (
    <Provider store={store}>
      <Router>
        <Layout title="CPS Store - Village E-commerce Platform">
          <div className="relative">
            <TopNav />

            <main className="pb-20 z-base">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/orders/:id/track" element={<OrderTrackingPage />} />
                <Route path="/orders" element={<OrdersPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route
                  path="/admin/delivery-map"
                  element={<AdminDeliveryMap />}
                />
                <Route path="/delivery" element={<DeliveryDashboard />} />
              </Routes>
            </main>

            <BottomNav />
            <FloatingCartCTA />
            
            {/* Development-only accessibility audit */}
            {process.env.NODE_ENV === "development" && <AccessibilityAudit />}
          </div>
        </Layout>
      </Router>
    </Provider>
  );
}

export default App;
