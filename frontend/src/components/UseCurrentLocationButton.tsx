import React, { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { useToast } from "./AccessibleToast";
import { isPincodeDeliverable } from "../utils/pincodeValidation";

interface LocationData {
  pincode: string;
  city: string;
  state: string;
  address: string;
  lat: number;
  lng: number;
}

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
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { error: showError, success: showSuccess } = useToast();

  const handleUseCurrentLocation = async () => {
    console.log("🔵 Button clicked - Starting location detection");
    setIsLoading(true);
    setErrorMessage(""); // Clear previous error

    try {
      // Check if geolocation is supported
      if (!navigator.geolocation) {
        console.error("❌ Geolocation not supported");
        showError("Geolocation is not supported by your browser");
        setIsLoading(false);
        return;
      }

      console.log("✅ Geolocation supported, requesting position...");

      // Request user's location
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            console.log("📍 GPS Coordinates:", { latitude, longitude });

            // Call backend reverse geocoding API
            const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
            const apiUrl = `${baseUrl}/api/location/reverse-geocode?lat=${latitude}&lng=${longitude}`;
            console.log("🌐 Calling API:", apiUrl);

            const response = await fetch(apiUrl);
            console.log("📡 API Response status:", response.status);

            if (!response.ok) {
              const errorText = await response.text();
              console.error("❌ API Error:", errorText);
              throw new Error("Failed to get address from coordinates");
            }

            const result = await response.json();
            console.log("📦 API Result:", result);

            if (!result.success || !result.data) {
              console.error("❌ Invalid API response:", result);
              throw new Error("Invalid response from geocoding service");
            }

            const locationData: LocationData = result.data;
            console.log("🏠 Location Data:", locationData);

            // Validate pincode BEFORE opening the form
            if (!locationData.pincode) {
              console.error("❌ No pincode in location data");
              setErrorMessage("Could not detect pincode from your location");
              setIsLoading(false);
              return;
            }

            console.log("🔍 Validating pincode:", locationData.pincode);

            // Check if the pincode is deliverable (AP/TS only)
            const isDeliverable = isPincodeDeliverable(locationData.pincode);
            console.log("✅ Is deliverable?", isDeliverable);

            if (!isDeliverable) {
              console.log("❌ Pincode not deliverable - showing error");
              
              // Display error message with pincode
              setErrorMessage(
                `(${locationData.pincode}) Unable to deliver to this location because our services are only in Andhra Pradesh and Telangana`
              );
              
              setIsLoading(false);
              return;
            }

            // Pincode is valid and deliverable - show success and open form
            console.log("✅ Pincode deliverable - opening form");
            showSuccess(
              `Location detected: ${locationData.city}, ${locationData.state}`
            );

            // Auto-fill the form with detected data
            onLocationDetected({
              name: "", // User will fill this
              address: locationData.address,
              city: locationData.city,
              state: locationData.state,
              pincode: locationData.pincode,
              phone: "", // User will fill this
              label: "HOME", // Default label
            });

            setIsLoading(false);
            console.log("✅ Form opened with auto-filled data");
          } catch (error) {
            console.error("❌ Error fetching address:", error);
            showError("Failed to get address from your location");
            setIsLoading(false);
          }
        },
        (error) => {
          // Handle geolocation errors
          console.error("Geolocation error:", error);

          if (error.code === error.PERMISSION_DENIED) {
            showError("Please enable GPS/location access and try again");
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            showError("Location information is unavailable");
          } else if (error.code === error.TIMEOUT) {
            showError("Location request timed out");
          } else {
            showError("An error occurred while getting your location");
          }

          setIsLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } catch (error) {
      console.error("Error:", error);
      showError("An unexpected error occurred");
      setIsLoading(false);
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
                Detecting your location...
              </span>
            </>
          ) : (
            <>
              <MapPin className="w-5 h-5 text-blue-600" />
              <span className="text-gray-900 font-medium">
                📍 Use My Current Location
              </span>
            </>
          )}
        </div>
        {!isLoading && !errorMessage && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            Auto-detect and fill your address using GPS
          </p>
        )}
      </button>

      {/* Error Message Display */}
      {errorMessage && (
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
              {errorMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default UseCurrentLocationButton;
