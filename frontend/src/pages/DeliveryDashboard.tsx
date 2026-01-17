import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { toApiUrl } from "../config/runtime";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import DeliveryNavbar from "../components/DeliveryNavbar";
import EnhancedHomeTab from "../components/delivery/EnhancedHomeTab";
import EnhancedEarningsTab from "../components/delivery/EnhancedEarningsTab";
import NotificationsTab from "../components/delivery/NotificationsTab";
import MoreTab from "../components/delivery/MoreTab";

const DeliveryDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { tokens, isAuthenticated, user } = useSelector(
    (state: RootState) => state.auth
  );

  const [_deliveryBoy, _setDeliveryBoy] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gateError, setGateError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("home");

  // Listen for tab change events from notifications
  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      const { tab } = event.detail;
      if (tab && ["home", "earnings", "notifications", "more"].includes(tab)) {
        setActiveTab(tab);
      }
    };

    window.addEventListener("delivery-tab-change", handleTabChange as EventListener);
    return () => {
      window.removeEventListener("delivery-tab-change", handleTabChange as EventListener);
    };
  }, []);

  // Check authentication and role
  useEffect(() => {
    console.log("🚚 DeliveryDashboard mounted", user);
    console.log("[DeliveryDashboard] Mount - Auth check:", {
      isAuthenticated,
      userRole: user?.role,
      userId: user?.id,
      path: window.location.pathname
    });
    
    if (!isAuthenticated || user?.role !== "delivery") {
      console.warn("[DeliveryDashboard] Unauthorized access attempt - redirecting to login");
      navigate("/delivery/login");
      return;
    }
    fetchDeliveryBoyInfo();
  }, [isAuthenticated, user, navigate]);

  const fetchDeliveryBoyInfo = async () => {
    try {
      setIsLoading(true);
      setGateError(null);

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(toApiUrl("/delivery/orders"), {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log("Authentication failed, redirecting to login");
          localStorage.removeItem("auth");
          window.location.href = "/delivery/login";
          return;
        }

        if (response.status === 403) {
          let errorMessage = "Access denied";
          try {
            const errorData = await response.json();
            errorMessage = errorData?.error || errorData?.message || errorMessage;
          } catch {
          }
          setGateError(errorMessage);
          return;
        }

        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch delivery info");
      }

      const data = await response.json();
      _setDeliveryBoy(data.deliveryBoy);
    } catch (err) {
      console.error("Error fetching delivery boy info:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "home":
        return <EnhancedHomeTab />;
      case "earnings":
        return <EnhancedEarningsTab />;
      case "notifications":
        return <NotificationsTab />;
      case "more":
        return <MoreTab />;
      default:
        return <EnhancedHomeTab />;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (gateError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DeliveryNavbar />
        <div className="p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 max-w-xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Account not ready</h2>
            <p className="text-gray-700 mb-4">{gateError}</p>
            <button
              onClick={fetchDeliveryBoyInfo}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
        <DeliveryBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Delivery Navbar */}
      <DeliveryNavbar />

      {/* Tab Content */}
      {renderActiveTab()}

      {/* Bottom Navigation */}
      <DeliveryBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default DeliveryDashboard;
