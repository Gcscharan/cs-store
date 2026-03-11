import React, { useState } from "react";
import { MapPin, Check, X, Navigation, Loader2, AlertCircle, MapPinOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isPincodeDeliverable } from "../utils/pincodeValidation";
import { useGeolocation } from "../hooks/useGeolocation";
import { useLanguage } from "../contexts/LanguageContext";

interface Address {
  id: string;
  label: string;
  city: string;
  state: string;
  pincode: string;
  addressLine: string;
  isDefault?: boolean;
}

interface ChooseLocationProps {
  isOpen: boolean;
  onClose: () => void;
  onAddressSelect: (addressId: string) => void;
  addresses: Address[];
  defaultAddressId?: string | null;
}

const ChooseLocation: React.FC<ChooseLocationProps> = ({
  isOpen,
  onClose,
  onAddressSelect,
  addresses,
  defaultAddressId,
}) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  // DEBUG: Log props received
  console.log("[ChooseLocation] Props received:", {
    isOpen,
    addressesCount: addresses?.length,
    addresses,
    defaultAddressId,
  });
  const [isDeliverableError, setIsDeliverableError] = useState<string>("");
  const {
    loading: isDetectingLocation,
    error: geoError,
    permissionState,
    requestPosition,
  } = useGeolocation();

  const handleAddressClick = (addressId: string) => {
    onAddressSelect(addressId);
    onClose();
  };

  const handleUseCurrentLocation = async () => {
    setIsDeliverableError("");

    const position = await requestPosition();

    if (!position) {
      return;
    }

    const { latitude, longitude } = position.coords;

    try {
      const response = await fetch(
        `/api/location/reverse-geocode?lat=${latitude}&lng=${longitude}`
      );
      const data = await response.json();

      if (data.success && data.data && data.data.pincode) {
        const detectedPincode = data.data.pincode;
        const isDeliverable = isPincodeDeliverable(detectedPincode);

        if (!isDeliverable) {
          setIsDeliverableError(
            t("location.deliveryNotAvailable", { pincode: detectedPincode })
          );
          return;
        }

        const locationData = {
          addressLine: data.data.address || "",
          city: data.data.city || "",
          state: data.data.state || "",
          pincode: detectedPincode,
          lat: latitude,
          lng: longitude,
        };

        localStorage.setItem("autofillAddress", JSON.stringify(locationData));
        onClose();
        navigate("/addresses");
      } else {
        console.warn("Location data incomplete from API");
      }
    } catch (err) {
      console.error("Reverse geocoding failed:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-800">
              {t("location.chooseLocation")}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Saved Addresses */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">
              {t("location.savedAddresses")}
            </h4>
            {addresses.length > 0 ? (
              <div className="space-y-2">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    onClick={() => handleAddressClick(addr.id)}
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      defaultAddressId === addr.id
                        ? "border-blue-200 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <MapPin
                        className={`h-5 w-5 flex-shrink-0 ${
                          defaultAddressId === addr.id
                            ? "text-blue-600"
                            : "text-gray-400"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {addr.label}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {addr.city}, {addr.state} - {addr.pincode}
                        </p>
                      </div>
                      {defaultAddressId === addr.id && (
                        <Check className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">{t("location.noSavedAddresses")}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {t("location.addNewToStart")}
                </p>
              </div>
            )}
          </div>

          {/* Use My Current Location Button */}
          <div className="pt-4 border-t border-gray-200 space-y-3">
            <button
              onClick={handleUseCurrentLocation}
              disabled={isDetectingLocation}
              className="w-full p-4 bg-white border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-700 hover:text-blue-700 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDetectingLocation ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>{t("location.detectingLocation")}</span>
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" />
                  <span>{t("location.useCurrentLocation")}</span>
                </>
              )}
            </button>

            {/* Permission Denied - Special UI */}
            {permissionState === "denied" && !isDetectingLocation && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <MapPinOff className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      📍 {t("location.accessDisabled")}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      {t("location.enableInSettings")}
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      {t("location.chromeSettingsPath")}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Geolocation Error - Soft Warning */}
            {geoError && geoError.type !== "permission_denied" && !isDetectingLocation && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">{geoError.message}</p>
                </div>
              </div>
            )}

            {/* Deliverability Error */}
            {isDeliverableError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{isDeliverableError}</p>
              </div>
            )}

            {/* Add New Address Button */}
            <button
              onClick={() => {
                onClose();
                navigate("/addresses");
              }}
              className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                />
              </svg>
              <span>{t("location.addNewAddress")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChooseLocation;
