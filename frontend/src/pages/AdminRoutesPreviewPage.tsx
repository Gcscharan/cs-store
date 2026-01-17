import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { RootState } from "../store";
import { ArrowLeft, Truck } from "lucide-react";

type PreviewOrderItem = {
  quantity?: number;
  qty?: number;
};

type PreviewOrder = {
  orderId?: string;
  itemsQty?: number;
  grossAmount?: number;
  discountAmount?: number;
  netAmount?: number;
  lat?: number;
  lng?: number;
  // Backward-compatible fields if backend returns richer docs
  _id?: string;
  id?: string;
  items?: PreviewOrderItem[];
  totalAmount?: number;
  subtotal?: number;
};

type PreviewCluster = {
  tempClusterId: string;
  orderCount: number;
  distanceKm: number;
  estimatedTimeMin: number;
  orders: Array<string | PreviewOrder>;
  routePath?: string[];
};

type DeliveryBoyListItem = {
  user: {
    _id: string;
    name: string;
    phone?: string;
    status: string;
  };
  deliveryBoy: {
    _id: string;
    availability: "available" | "busy" | "offline";
    isActive: boolean;
    vehicleType?: string;
  };
};

const canonicalVehicleType = (v: any): string => String(v || "").trim().toUpperCase();

const AdminRoutesPreviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { tokens, isAuthenticated, user, loading: authLoading } = useSelector(
    (state: RootState) => state.auth
  );

  const [clusters, setClusters] = useState<PreviewCluster[]>([]);
  const [loading, setLoading] = useState(false);

  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoyListItem[]>([]);
  const [loadingDeliveryBoys, setLoadingDeliveryBoys] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedCluster, setSelectedCluster] = useState<PreviewCluster | null>(null);
  const [selectedDeliveryBoyId, setSelectedDeliveryBoyId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  const getOrderId = (o: string | PreviewOrder): string => {
    if (typeof o === "string") return o;
    if (o?.orderId) return String(o.orderId);
    if (o?._id) return String(o._id);
    if (o?.id) return String(o.id);
    return "";
  };

  const computeTotalItems = (orders: PreviewCluster["orders"]): number => {
    return (orders || []).reduce((sum: number, o) => {
      if (!o || typeof o === "string") return sum;
      if (typeof o.itemsQty === "number") {
        return sum + (Number.isFinite(o.itemsQty) ? o.itemsQty : 0);
      }
      const items = Array.isArray(o.items) ? o.items : [];
      const itemQty = items.reduce((s: number, it) => {
        const q = typeof it?.quantity === "number" ? it.quantity : typeof it?.qty === "number" ? it.qty : 0;
        return s + (Number.isFinite(q) ? q : 0);
      }, 0);
      return sum + itemQty;
    }, 0);
  };

  const computeGrossAmount = (orders: PreviewCluster["orders"]): number => {
    return (orders || []).reduce((sum: number, o) => {
      if (!o || typeof o === "string") return sum;
      if (typeof o.grossAmount === "number") {
        return sum + (Number.isFinite(o.grossAmount) ? o.grossAmount : 0);
      }
      const v =
        typeof o.totalAmount === "number"
          ? o.totalAmount
          : typeof o.subtotal === "number"
            ? o.subtotal
            : 0;
      return sum + (Number.isFinite(v) ? v : 0);
    }, 0);
  };

  const computeNetAmount = (orders: PreviewCluster["orders"]): number => {
    const explicitNet = (orders || []).every((o) => typeof o !== "string" && typeof (o as PreviewOrder).netAmount === "number");
    if (explicitNet) {
      return (orders || []).reduce((sum: number, o) => {
        if (!o || typeof o === "string") return sum;
        const v = typeof o.netAmount === "number" ? o.netAmount : 0;
        return sum + (Number.isFinite(v) ? v : 0);
      }, 0);
    }

    const gross = computeGrossAmount(orders);
    const discount = (orders || []).reduce((sum: number, o) => {
      if (!o || typeof o === "string") return sum;
      const d = typeof o.discountAmount === "number" ? o.discountAmount : 0;
      return sum + (Number.isFinite(d) ? d : 0);
    }, 0);
    const net = gross - discount;
    return Number.isFinite(net) ? Math.max(0, net) : 0;
  };

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const isAdmin = !!(user?.isAdmin || user?.role === "admin");
    if (!isAuthenticated || !isAdmin) {
      navigate("/login", { replace: true });
      return;
    }
    void fetchPreview();
  }, [authLoading, isAuthenticated, user, navigate]);

  const fetchPreview = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/routes/compute?mode=preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify({ vehicle: { type: "AUTO" } }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).message || (data as any).error || "Failed to compute preview clusters");
      }

      const list = Array.isArray((data as any).clusters) ? (data as any).clusters : [];
      setClusters(list);
    } catch (e: any) {
      console.error("Preview compute error:", e);
      toast.error(e?.message || "Failed to compute preview clusters");
      setClusters([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeliveryBoys = async () => {
    try {
      setLoadingDeliveryBoys(true);
      const response = await fetch("/api/admin/delivery-boys-list", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).message || (data as any).error || "Failed to fetch delivery boys");
      }

      const list = Array.isArray((data as any).deliveryBoys) ? (data as any).deliveryBoys : [];
      setDeliveryBoys(list);
    } catch (e: any) {
      console.error("Fetch delivery boys error:", e);
      toast.error(e?.message || "Failed to fetch delivery boys");
      setDeliveryBoys([]);
    } finally {
      setLoadingDeliveryBoys(false);
    }
  };

  const eligibleDeliveryBoys = useMemo(() => {
    return (deliveryBoys || []).filter((item) => {
      const u = item?.user;
      const b = item?.deliveryBoy;
      if (!u || !b) return false;

      // Strict rules from prompt
      if (canonicalVehicleType(b.vehicleType) !== "AUTO") return false;
      if (!b.isActive) return false;
      if (String(u.status || "") !== "active") return false;

      // Keep availability filter (matches prior behavior + backend will re-check)
      if (b.availability !== "available") return false;

      return true;
    });
  }, [deliveryBoys]);

  const openAssign = async (cluster: PreviewCluster) => {
    setSelectedCluster(cluster);
    setSelectedDeliveryBoyId("");
    setShowAssignModal(true);
    await fetchDeliveryBoys();
  };

  const confirmAssign = async () => {
    if (!selectedCluster) return;
    if (!selectedDeliveryBoyId) {
      toast.error("Select a delivery boy");
      return;
    }

    try {
      setIsAssigning(true);
      const response = await fetch("/api/admin/routes/assign", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokens?.accessToken}`,
        },
        body: JSON.stringify({
          deliveryBoyId: selectedDeliveryBoyId,
          orderIds: (selectedCluster.orders || []).map(getOrderId).filter(Boolean),
          routePath: selectedCluster.routePath || [],
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((data as any).message || (data as any).error || "Failed to assign route");
      }

      toast.success("Route assigned");
      setShowAssignModal(false);
      setSelectedCluster(null);
      setSelectedDeliveryBoyId("");
      navigate("/admin/routes");
    } catch (e: any) {
      console.error("Assign error:", e);
      toast.error(e?.message || "Failed to assign route");
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate("/admin/orders")}
              className="mr-4 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Routes / Clusters Preview</h1>
              <p className="text-gray-600">Preview-only (no changes until you assign)</p>
            </div>
          </div>

          <button
            onClick={() => void fetchPreview()}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800"
          >
            Recompute
          </button>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
            <p className="text-gray-600">Computing clusters…</p>
          </div>
        ) : clusters.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center">
            <p className="text-gray-900 font-semibold text-lg mb-2">No clusters</p>
            <p className="text-gray-600">No PACKED orders were found for preview.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {clusters.map((c, idx) => (
              <div key={c.tempClusterId || `cluster-${idx}`} className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Cluster</p>
                    <p className="text-xl font-bold text-gray-900">{c.tempClusterId}</p>

                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500">Orders</p>
                        <p className="font-semibold text-gray-900">{c.orderCount}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Distance</p>
                        <p className="font-semibold text-gray-900">{Number(c.distanceKm || 0).toFixed(1)} km</p>
                      </div>
                      <div>
                        <p className="text-gray-500">ETA</p>
                        <p className="font-semibold text-gray-900">{Math.round(Number(c.estimatedTimeMin || 0))} min</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Orders list</p>
                        <p className="font-semibold text-gray-900">{(c.orders || []).length}</p>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-gray-500 flex flex-wrap gap-x-3 gap-y-1">
                      <span>Items Qty: {computeTotalItems(c.orders)}</span>
                      <span className="text-gray-300">|</span>
                      <span>Gross: ₹{computeGrossAmount(c.orders).toLocaleString()}</span>
                      <span className="text-gray-300">|</span>
                      <span>Net: ₹{computeNetAmount(c.orders).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => void openAssign(c)}
                      className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Assign Delivery Boy
                      </span>
                    </button>
                  </div>
                </div>

                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {(c.routePath || (c.orders || []).map(getOrderId) || [])
                    .filter((x) => String(x).toUpperCase() !== "WAREHOUSE")
                    .map((id, i) => (
                      <div key={`${c.tempClusterId}-${id}-${i}`} className="text-sm text-gray-800">
                        {i + 1}. {String(id)}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAssignModal && selectedCluster && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Assign Delivery Boy</h3>
            <p className="text-gray-600 mb-6">
              Cluster <span className="font-semibold">{selectedCluster.tempClusterId}</span> · Orders: {selectedCluster.orderCount}
            </p>

            {loadingDeliveryBoys ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                <p className="text-gray-500 mt-2">Loading delivery boys…</p>
              </div>
            ) : eligibleDeliveryBoys.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-900 font-semibold">No eligible delivery boys</p>
                <p className="text-yellow-800 text-sm mt-1">Only AUTO + ACTIVE + AVAILABLE are shown.</p>
              </div>
            ) : (
              <div className="space-y-2 mb-6">
                {eligibleDeliveryBoys.map((item) => {
                  const u = item.user;
                  const b = item.deliveryBoy;
                  return (
                    <label
                      key={b._id}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedDeliveryBoyId === b._id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-200 hover:border-emerald-300 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryBoy"
                        value={b._id}
                        checked={selectedDeliveryBoyId === b._id}
                        onChange={(e) => setSelectedDeliveryBoyId(e.target.value)}
                        className="h-4 w-4 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{u?.name || "Unknown"}</p>
                            <p className="text-xs text-gray-500">{u?.phone || ""}</p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {canonicalVehicleType(b.vehicleType)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedCluster(null);
                  setSelectedDeliveryBoyId("");
                }}
                disabled={isAssigning}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmAssign()}
                disabled={isAssigning || !selectedDeliveryBoyId}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md disabled:opacity-50"
              >
                {isAssigning ? "Assigning…" : "Confirm Assignment"}
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-4">No order is mutated until you confirm assignment.</p>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminRoutesPreviewPage;
