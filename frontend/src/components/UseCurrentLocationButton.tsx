import React, { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { useToast } from "./AccessibleToast";
import { isPincodeDeliverable } from "../utils/pincodeValidation";
import { toApiUrl } from "../config/runtime";
import { useGeolocation } from "../hooks/useGeolocation";
import { useLanguage } from "../contexts/LanguageContext";

interface UseCurrentLocationButtonProps {
  onLocationDetected: (locationData: {
    name: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    label: string;
  }) => void;
}

const UseCurrentLocationButton: React.FC<UseCurrentLocationButtonProps> = ({
  onLocationDetected,
}) => {
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { error: showError, success: showSuccess } = useToast();
  const { t } = useLanguage();
  const {
    loading: isLoading,
    error: geoError,
    permissionState,
    requestPosition,
  } = useGeolocation();

  const handleUseCurrentLocation = async () => {
    setErrorMessage("");

    const position = await requestPosition();

    if (!position) {
      if (geoError) {
        setErrorMessage(geoError.message);
      }
      return;
    }
    const { latitude, longitude } = position.coords;

    try {
      const apiUrl = toApiUrl(`/location/reverse-geocode?lat=${latitude}&lng=${longitude}`);
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(t("location.errors.failedGeocode"));
      }

      const result = await response.json();

      if (!result.success || !result.data) {
        throw new Error(t("location.errors.invalidResponse"));
      }

      const locationData = result.data;

      if (!locationData.pincode) {
        setErrorMessage(t("location.errors.noPincode"));
        return;
      }

      const isDeliverable = isPincodeDeliverable(locationData.pincode);

      if (!isDeliverable) {
        setErrorMessage(
          t("location.errors.notDeliverable", { pincode: locationData.pincode })
        );
        return;
      }

      showSuccess(t("location.detectedSuccess", { city: locationData.city, state: locationData.state }));

      onLocationDetected({
        name: "",
        address: locationData.address,
        city: locationData.city,
        state: locationData.state,
        pincode: locationData.pincode,
        phone: "",
        label: "HOME",
      });
    } catch (error) {
      console.error("Error fetching address:", error);
      showError(t("location.errors.failedLocation"));
    }
  };

  return (
    <div>
      <button
        onClick={handleUseCurrentLocation}
        disabled={isLoading}
        className={`w-full border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors ${
          isLoading ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        <div className="flex items-center justify-center gap-3">
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-gray-700 font-medium">
                {t("location.detectingLocation")}
              </span>
            </>
          ) : (
            <>
              <MapPin className="w-5 h-5 text-blue-600" />
              <span className="text-gray-900 font-medium">
                📍 {t("location.useCurrentLocation")}
              </span>
            </>
          )}
        </div>
        {!isLoading && !errorMessage && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            {t("location.autoDetectHint")}
          </p>
        )}
      </button>

      {/* Error Message Display */}
      {(errorMessage || (geoError && geoError.type !== "permission_denied")) && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-red-800 font-medium">
              {errorMessage || geoError?.message}
            </p>
          </div>
        </div>
      )}

      {/* Permission Denied - Special UI */}
      {permissionState === "denied" && !isLoading && (
        <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                📍 {t("location.accessDisabled")}
              </p>
              <p className="text-xs text-amber-700 mt-1">
                {t("location.enableInSettings")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UseCurrentLocationButton;
