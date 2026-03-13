import React, { useState, useEffect } from "react";
import { authFetch } from "../utils/authClient";
import { toApiUrl } from "../config/runtime";
import toast from "react-hot-toast";
import {
  Settings,
  MapPin,
  Truck,
  CreditCard,
  AlertTriangle,
  Save,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Info,
} from "lucide-react";

interface SettingsData {
  storeName: string;
  storeEmail: string;
  supportPhone: string;
  warehouseLat: number;
  warehouseLng: number;
  warehousePincode: string;
  localRadiusKm: number;
  hubs: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    radiusKm: number;
  }>;
  routeCapacityMin: number;
  routeCapacityMax: number;
  killswitchEnabled: boolean;
  razorpayKeyId: string;
  razorpayConfigured: boolean;
}

const AdminSettingsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<SettingsData>({
    storeName: "",
    storeEmail: "",
    supportPhone: "",
    warehouseLat: 17.094,
    warehouseLng: 80.598,
    warehousePincode: "521235",
    localRadiusKm: 35,
    hubs: [],
    routeCapacityMin: 20,
    routeCapacityMax: 30,
    killswitchEnabled: false,
    razorpayKeyId: "",
    razorpayConfigured: false,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const response = await authFetch(toApiUrl("/admin/settings"), {
        method: "GET",
      });

      if (response.ok) {
        const data = await response.json();
        setSettings({
          storeName: data.storeName || "",
          storeEmail: data.storeEmail || "",
          supportPhone: data.supportPhone || "",
          warehouseLat: data.warehouseLat || 17.094,
          warehouseLng: data.warehouseLng || 80.598,
          warehousePincode: data.warehousePincode || "521235",
          localRadiusKm: data.localRadiusKm || 35,
          hubs: data.hubs || [],
          routeCapacityMin: data.routeCapacityMin || 20,
          routeCapacityMax: data.routeCapacityMax || 30,
          killswitchEnabled: data.killswitchEnabled || false,
          razorpayKeyId: data.razorpayKeyId || "",
          razorpayConfigured: data.razorpayConfigured || false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGeneral = async () => {
    setIsSaving(true);
    try {
      const response = await authFetch(toApiUrl("/admin/settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeName: settings.storeName,
          storeEmail: settings.storeEmail,
          supportPhone: settings.supportPhone,
        }),
      });

      if (response.ok) {
        toast.success("Settings saved successfully");
      } else {
        throw new Error("Failed to save");
      }
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleKillswitch = async () => {
    try {
      const response = await authFetch(toApiUrl("/admin/tracking/killswitch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !settings.killswitchEnabled }),
      });

      if (response.ok) {
        setSettings((prev) => ({
          ...prev,
          killswitchEnabled: !prev.killswitchEnabled,
        }));
        toast.success(
          `Tracking ${!settings.killswitchEnabled ? "disabled" : "enabled"}`
        );
      } else {
        throw new Error("Failed to toggle");
      }
    } catch (error) {
      toast.error("Failed to update killswitch");
    }
  };

  const handleForceRecompute = async () => {
    try {
      const response = await authFetch(toApiUrl("/admin/routes/compute"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (response.ok) {
        toast.success("Route recomputation triggered");
      } else {
        throw new Error("Failed to recompute");
      }
    } catch (error) {
      toast.error("Failed to trigger recomputation");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Settings className="w-8 h-8 text-orange-500" />
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
      </div>

      {/* General Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-500" />
          General Settings
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Store Name
            </label>
            <input
              type="text"
              value={settings.storeName}
              onChange={(e) =>
                setSettings({ ...settings, storeName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Store Email
            </label>
            <input
              type="email"
              value={settings.storeEmail}
              onChange={(e) =>
                setSettings({ ...settings, storeEmail: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Support Phone
            </label>
            <input
              type="tel"
              value={settings.supportPhone}
              onChange={(e) =>
                setSettings({ ...settings, supportPhone: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSaveGeneral}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Delivery Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-gray-500" />
          Delivery Settings
        </h2>
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
              <Info className="w-4 h-4" />
              <span>Warehouse Location (from environment)</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Latitude:</span>
                <span className="ml-2 font-mono">{settings.warehouseLat}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Longitude:</span>
                <span className="ml-2 font-mono">{settings.warehouseLng}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Pincode:</span>
                <span className="ml-2 font-mono">{settings.warehousePincode}</span>
              </div>
              <div>
                <span className="text-sm text-gray-500">Local Radius:</span>
                <span className="ml-2 font-mono">{settings.localRadiusKm} km</span>
              </div>
            </div>
          </div>

          {/* Delivery Hubs */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <Truck className="w-4 h-4" />
              <span>Delivery Hubs (from environment)</span>
            </div>
            {settings.hubs.length > 0 ? (
              <div className="space-y-2">
                {settings.hubs.map((hub) => (
                  <div
                    key={hub.id}
                    className="flex items-center justify-between bg-white rounded p-2 text-sm"
                  >
                    <span className="font-medium">{hub.name}</span>
                    <span className="text-gray-500">
                      {hub.lat.toFixed(4)}, {hub.lng.toFixed(4)} • {hub.radiusKm}km
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No hubs configured</p>
            )}
          </div>

          {/* Route Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Route Capacity Min
              </label>
              <input
                type="number"
                value={settings.routeCapacityMin}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    routeCapacityMin: parseInt(e.target.value) || 20,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Route Capacity Max
              </label>
              <input
                type="number"
                value={settings.routeCapacityMax}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    routeCapacityMax: parseInt(e.target.value) || 30,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tracking Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Truck className="w-5 h-5 text-gray-500" />
          Tracking Settings
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Killswitch</p>
            <p className="text-sm text-gray-500">
              Disable live tracking for all delivery boys
            </p>
          </div>
          <button
            onClick={handleToggleKillswitch}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              settings.killswitchEnabled
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {settings.killswitchEnabled ? (
              <>
                <ToggleRight className="w-5 h-5" />
                Disabled
              </>
            ) : (
              <>
                <ToggleLeft className="w-5 h-5" />
                Enabled
              </>
            )}
          </button>
        </div>
      </div>

      {/* Payment Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-gray-500" />
          Payment Settings
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
            <div>
              <p className="font-medium text-gray-900">Razorpay</p>
              <p className="text-sm text-gray-500">
                {settings.razorpayConfigured ? "Configured" : "Not configured"}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                settings.razorpayConfigured
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {settings.razorpayConfigured ? "Active" : "Inactive"}
            </span>
          </div>
          {settings.razorpayKeyId && (
            <div className="text-sm text-gray-600">
              <span className="text-gray-500">Key ID:</span>
              <span className="ml-2 font-mono">
                {settings.razorpayKeyId.slice(0, 8)}•••••••
              </span>
            </div>
          )}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Webhook URL</p>
            <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
              /api/webhooks/razorpay
            </code>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
        <h2 className="text-lg font-semibold text-red-700 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Danger Zone
        </h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900">Force Route Recomputation</p>
            <p className="text-sm text-gray-500">
              Recompute all delivery routes (may take several minutes)
            </p>
          </div>
          <button
            onClick={handleForceRecompute}
            className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            <RefreshCw className="w-4 h-4" />
            Recompute
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
