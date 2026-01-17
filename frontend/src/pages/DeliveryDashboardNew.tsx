import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { toApiUrl } from "../config/runtime";
import { useOrderWebSocket } from "../hooks/useOrderWebSocket";
import { toast } from "react-hot-toast";
import DeliveryBottomNav from "../components/DeliveryBottomNav";
import HomeTab from "../components/delivery/HomeTab";
import EarningsTab from "../components/delivery/EarningsTab";
import NotificationsTab from "../components/delivery/NotificationsTab";
import MoreTab from "../components/delivery/MoreTab";
import { Truck } from "lucide-react";

const DeliveryDashboardNew: React.FC = () => {
  const navigate = useNavigate();
  const { tokens, isAuthenticated, user } = useSelector(
    (state: RootState) => state.auth
  );

  const [deliveryBoy, setDeliveryBoy] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [gateError, setGateError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("home");

  // Check authentication and role
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "delivery") {
      navigate("/delivery/login");
      return;
    }
    fetchDeliveryBoyInfo();
  }, [isAuthenticated, user, navigate]);

  // Real-time order status updates via WebSocket
  const handleOrderStatusChanged = useCallback((payload: any) => {
    console.log("🔄 [Delivery UI] Received order status update:", payload);
    
    // Refresh delivery info to get updated orders
    fetchDeliveryBoyInfo();

    // Show toast notification
    toast.success(
      `Order #${payload.orderId.substring(0, 8)} status changed to ${payload.to}`,
      { duration: 3000 }
    );
  }, []);

  useOrderWebSocket({
    userId: user?.id,
    userRole: 'delivery',
    onOrderStatusChanged: handleOrderStatusChanged,
    enabled: isAuthenticated && user?.role === 'delivery',
  });

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

      const response = await fetch(toApiUrl("/delivery/status"), {
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
        toApiUrl(`/delivery/orders/${orderId}/${action}`),
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

  if (gateError) {
    return (
      <div className="min-h-screen bg-gray-50">
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
      <DeliveryBottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
};

export default DeliveryDashboardNew;
