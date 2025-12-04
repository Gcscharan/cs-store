import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import {
  Package,
  Users,
  ShoppingCart,
  Truck,
  BarChart3,
  CreditCard,
} from "lucide-react";

interface DashboardStats {
  totalProducts: number;
  totalUsers: number;
  totalOrders: number;
  totalDeliveryBoys: number;
  recentOrders: number;
  totalRevenue: number;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { tokens, isAuthenticated } = useSelector((state: RootState) => state.auth);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalUsers: 0,
    totalOrders: 0,
    totalDeliveryBoys: 0,
    recentOrders: 0,
    totalRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch dashboard stats
  useEffect(() => {
    let isMounted = true;
    let hasRedirected = false;

    const fetchStats = async () => {
      try {
        // Don't fetch if component is unmounted or already redirected
        if (!isMounted || hasRedirected) {
          return;
        }

        setIsLoading(true);
        setError(null);

        // Don't fetch if no access token or user is not authenticated
        if (!tokens?.accessToken || !isAuthenticated) {
          console.log("AdminDashboard: No access token or not authenticated, skipping fetch");
          if (isMounted) setIsLoading(false);
          return;
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/admin/dashboard-stats`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokens.accessToken}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("API error response:", errorData);

          // Handle token expiration/revocation
          if (response.status === 401 || response.status === 403) {
            console.log("AdminDashboard: Token expired/revoked, redirecting to home");
            if (!hasRedirected) {
              hasRedirected = true;
              // Clear any remaining auth data
              localStorage.removeItem("auth");
              localStorage.removeItem("accessToken");
              localStorage.removeItem("refreshToken");
              localStorage.removeItem("user");
              // Redirect to home page, not login
              window.location.href = "/";
            }
            return;
          }

          throw new Error(
            `Failed to fetch stats: ${errorData.error || response.statusText}`
          );
        }

        const data = await response.json();
        if (isMounted) setStats(data);
      } catch (err) {
        console.error("Error fetching dashboard stats:", err);
        if (isMounted) setError("Failed to load dashboard stats. Please try again later.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchStats();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [tokens, isAuthenticated]);

  const menuItems = [
    {
      id: "products",
      title: "Products Management",
      description: "Create, edit, and manage products",
      icon: Package,
      color: "bg-blue-500",
      hoverColor: "hover:bg-blue-600",
      path: "/admin/products",
    },
    {
      id: "users",
      title: "Users Management",
      description: "View and manage user accounts",
      icon: Users,
      color: "bg-green-500",
      hoverColor: "hover:bg-green-600",
      path: "/admin/users",
    },
    {
      id: "orders",
      title: "Orders Management",
      description: "View and manage customer orders",
      icon: ShoppingCart,
      color: "bg-yellow-500",
      hoverColor: "hover:bg-yellow-600",
      path: "/admin/orders",
    },
    {
      id: "delivery-boys",
      title: "Delivery Boy Management",
      description: "Manage delivery personnel and operations",
      icon: Truck,
      color: "bg-purple-500",
      hoverColor: "hover:bg-purple-600",
      path: "/admin/delivery-boys",
    },
    {
      id: "analytics",
      title: "Sales Analytics",
      description: "View sales reports and analytics",
      icon: BarChart3,
      color: "bg-indigo-500",
      hoverColor: "hover:bg-indigo-600",
      path: "/admin/analytics",
    },
    {
      id: "payments",
      title: "Payment Logs",
      description: "Monitor all payment transactions",
      icon: CreditCard,
      color: "bg-emerald-500",
      hoverColor: "hover:bg-emerald-600",
      path: "/admin/payments",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main content */}
      <div className="w-full">
        {/* Dashboard content */}
        <main className="p-6">
          {/* Error message */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-red-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="mt-2 text-sm font-medium text-red-800 hover:text-red-900 underline"
                    >
                      Refresh Page
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Package className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Total Products
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? "..." : stats.totalProducts}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Users className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Total Users
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? "..." : stats.totalUsers}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <ShoppingCart className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Total Orders
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? "..." : stats.totalOrders}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Truck className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">
                    Delivery Boys
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {isLoading ? "..." : stats.totalDeliveryBoys}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Management sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(item.path)}
                >
                  <div className="flex items-center mb-4">
                    <div className={`p-3 ${item.color} rounded-lg`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 ml-4">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-gray-600 mb-4">{item.description}</p>
                  <button
                    className={`w-full py-2 px-4 ${item.color} ${item.hoverColor} text-white rounded-md transition-colors`}
                  >
                    Manage
                  </button>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
