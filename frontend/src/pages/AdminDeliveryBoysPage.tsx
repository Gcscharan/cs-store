import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { toast } from "react-hot-toast";
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  Package,
  AlertTriangle,
  Filter,
  Search,
} from "lucide-react";

interface DeliveryBoy {
  user: {
    _id: string;
    name: string;
    email: string;
    phone: string;
    status: "pending" | "active" | "suspended";
    deliveryProfile?: {
      vehicleType: string;
      assignedAreas: string[];
      aadharOrId?: string;
      approvedAt?: string;
    };
    createdAt: string;
  };
  deliveryBoy: {
    _id: string;
    availability: "available" | "busy" | "offline";
    isActive: boolean;
    earnings: number;
    completedOrdersCount: number;
    currentLocation: {
      lat: number;
      lng: number;
      lastUpdatedAt: string;
    };
  } | null;
}

const AdminDeliveryBoysPage: React.FC = () => {
  const { tokens } = useSelector((state: RootState) => state.auth);
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [filteredBoys, setFilteredBoys] = useState<DeliveryBoy[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBoy, setSelectedBoy] = useState<DeliveryBoy | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  useEffect(() => {
    fetchDeliveryBoys();
  }, []);

  useEffect(() => {
    filterDeliveryBoys();
  }, [statusFilter, searchTerm, deliveryBoys]);

  const fetchDeliveryBoys = async () => {
    try {
      setIsLoading(true);

      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch("/api/admin/delivery-boys-list", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch delivery partners");
      }

      const data = await response.json();
      const list = Array.isArray(data.deliveryBoys) ? data.deliveryBoys : [];
      setDeliveryBoys(list.filter((b: any) => b && b.user && b.user._id));
    } catch (error: any) {
      console.error("Error fetching delivery boys:", error);
      toast.error(error.message || "Failed to load delivery partners");
    } finally {
      setIsLoading(false);
    }
  };

  const filterDeliveryBoys = () => {
    let filtered = [...deliveryBoys].filter((b: any) => b && b.user);

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((boy: any) => boy?.user?.status === statusFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (boy: any) =>
          String(boy?.user?.name || "").toLowerCase().includes(term) ||
          String(boy?.user?.email || "").toLowerCase().includes(term) ||
          String(boy?.user?.phone || "").includes(term)
      );
    }

    setFilteredBoys(filtered);
  };

  const handleApprove = async (userId: string) => {
    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`/api/admin/delivery-boys/${userId}/approve`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to approve delivery partner");
      }

      toast.success("Delivery partner approved successfully!");
      setShowApprovalModal(false);
      setSelectedBoy(null);
      fetchDeliveryBoys();
    } catch (error: any) {
      console.error("Error approving delivery boy:", error);
      toast.error(error.message || "Failed to approve delivery partner");
    }
  };

  const handleSuspend = async (userId: string) => {
    if (!window.confirm("Are you sure you want to suspend this delivery partner?")) {
      return;
    }

    try {
      if (!tokens?.accessToken) {
        throw new Error("No authentication token available");
      }

      const response = await fetch(`/api/admin/delivery-boys/${userId}/suspend`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens.accessToken}`,
        },
        body: JSON.stringify({
          reason: "Suspended by admin",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to suspend delivery partner");
      }

      toast.success("Delivery partner suspended");
      fetchDeliveryBoys();
    } catch (error: any) {
      console.error("Error suspending delivery boy:", error);
      toast.error(error.message || "Failed to suspend delivery partner");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "suspended":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case "available":
        return "bg-green-500";
      case "busy":
        return "bg-orange-500";
      case "offline":
        return "bg-gray-400";
      default:
        return "bg-gray-400";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Delivery Partners Management
          </h1>
          <p className="text-gray-600">
            Manage and monitor all delivery partners
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Partners</p>
                <p className="text-2xl font-bold text-gray-900">
                  {deliveryBoys.length}
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Approval</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {
                    deliveryBoys.filter((b: any) => b?.user?.status === "pending")
                      .length
                  }
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Partners</p>
                <p className="text-2xl font-bold text-green-600">
                  {deliveryBoys.filter((b: any) => b?.user?.status === "active").length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="h-4 w-4 inline mr-1" />
                Filter by Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Partners</option>
                <option value="pending">Pending Approval</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="h-4 w-4 inline mr-1" />
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, email, or phone"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Delivery Boys List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading delivery partners...</p>
          </div>
        ) : filteredBoys.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Delivery Partners Found
            </h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "No delivery partners have signed up yet"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredBoys.map((boy) => (
              <div
                key={boy.user._id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-900">
                        {boy.user.name}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                          boy.user.status
                        )}`}
                      >
                        {boy.user.status.toUpperCase()}
                      </span>
                      {boy.deliveryBoy && (
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${getAvailabilityColor(
                              boy.deliveryBoy.availability
                            )}`}
                          ></div>
                          <span className="text-xs text-gray-600 capitalize">
                            {boy.deliveryBoy.availability}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2 text-blue-600" />
                        {boy.user.email}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2 text-green-600" />
                        {boy.user.phone}
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <Package className="h-4 w-4 mr-2 text-purple-600" />
                        Vehicle: {boy.user.deliveryProfile?.vehicleType || "N/A"}
                      </div>
                      {boy.user.deliveryProfile?.assignedAreas && boy.user.deliveryProfile.assignedAreas.length > 0 && (
                        <div className="flex items-start text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-2 text-red-600 mt-0.5" />
                          <span>
                            Areas: {boy.user.deliveryProfile.assignedAreas.join(", ")}
                          </span>
                        </div>
                      )}
                    </div>

                    {boy.deliveryBoy && (
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-gray-600">Completed:</span>
                          <span className="font-semibold text-gray-900 ml-2">
                            {boy.deliveryBoy.completedOrdersCount}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Earnings:</span>
                          <span className="font-semibold text-gray-900 ml-2">
                            ₹{boy.deliveryBoy.earnings}
                          </span>
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      Joined: {new Date(boy.user.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {boy.user.status === "pending" && (
                      <button
                        onClick={() => {
                          setSelectedBoy(boy);
                          setShowApprovalModal(true);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Approve
                      </button>
                    )}

                    {boy.user.status === "active" && (
                      <button
                        onClick={() => handleSuspend(boy.user._id)}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                      >
                        <XCircle className="h-4 w-4" />
                        Suspend
                      </button>
                    )}

                    {boy.user.status === "suspended" && (
                      <button
                        onClick={() => handleApprove(boy.user._id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedBoy && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Approve Delivery Partner
            </h3>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Name:</strong> {selectedBoy.user.name}
              </p>
              <p className="text-sm text-gray-600 mb-2">
                <strong>Email:</strong> {selectedBoy.user.email}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                <strong>Vehicle:</strong>{" "}
                {selectedBoy.user.deliveryProfile?.vehicleType}
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  handleApprove(selectedBoy.user._id);
                }}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Approve & Activate
              </button>
              <button
                onClick={() => {
                  setShowApprovalModal(false);
                  setSelectedBoy(null);
                }}
                className="flex-1 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDeliveryBoysPage;
