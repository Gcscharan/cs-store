import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
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
  const [activeTab, setActiveTab] = useState("home");

  // Check authentication and role
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "delivery") {
      navigate("/login");
      return;
    }
    fetchDeliveryBoyInfo();
  }, [isAuthenticated, user, navigate]);

  const fetchDeliveryBoyInfo = async () => {
    try {
      setIsLoading(true);

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch("http://localhost:5001/api/delivery/orders", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          console.log("Authentication failed, redirecting to login");
          localStorage.removeItem("auth");
          window.location.href = "/login";
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
