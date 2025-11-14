import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { logout } from "../store/slices/authSlice";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import HomeTab from "../components/delivery/HomeTab";
import EarningsTab from "../components/delivery/EarningsTab";
import NotificationsTab from "../components/delivery/NotificationsTab";
import MoreTab from "../components/delivery/MoreTab";
import { Truck } from "lucide-react";

const DeliveryDashboardNew: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { tokens, isAuthenticated, user } = useSelector(
    (state: RootState) => state.auth
  );

  const [deliveryBoy, setDeliveryBoy] = useState<any>(null);
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
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to fetch delivery info");
      }

      const data = await response.json();
      setDeliveryBoy(data.deliveryBoy);
    } catch (err) {
      console.error("Error fetching delivery boy info:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusUpdate = async (isOnline: boolean) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch("http://localhost:5001/api/delivery/status", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({ isOnline }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to update status");
      }

      console.log(`Status updated to ${isOnline ? "online" : "offline"}`);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleOrderAction = async (
    orderId: string,
    action: "accept" | "decline"
  ) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(
        `http://localhost:5001/api/delivery/orders/${orderId}/${action}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} order`);
      }

      console.log(`Order ${action}ed successfully`);
    } catch (err) {
      console.error(`Error ${action}ing order:`, err);
    }
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case "home":
        return (
          <HomeTab
            onStatusUpdate={handleStatusUpdate}
            onOrderAction={handleOrderAction}
          />
        );
      case "earnings":
        return <EarningsTab />;
      case "notifications":
        return <NotificationsTab />;
      case "more":
        return <MoreTab />;
      default:
        return (
          <HomeTab
            onStatusUpdate={handleStatusUpdate}
            onOrderAction={handleOrderAction}
          />
        );
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
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg mr-3">
                <Truck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Delivery Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  {activeTab === "home" && "Manage your deliveries"}
                  {activeTab === "earnings" && "View your earnings"}
                  {activeTab === "notifications" && "Stay updated"}
                  {activeTab === "more" && "More options"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {deliveryBoy && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {deliveryBoy.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {deliveryBoy.vehicleType} • {deliveryBoy.availability}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {renderActiveTab()}

      {/* Bottom Navigation */}
      <DeliveryBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default DeliveryDashboardNew;
