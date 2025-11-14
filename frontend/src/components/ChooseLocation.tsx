import React, { useState } from "react";
import { MapPin, Check, X, Navigation, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isPincodeDeliverable } from "../utils/pincodeValidation";

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
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string>("");

  const handleAddressClick = (addressId: string) => {
    onAddressSelect(addressId);
    onClose();
  };

  const handleUseCurrentLocation = async () => {
    setIsDetectingLocation(true);
    setLocationError("");

    try {
      if (!navigator.geolocation) {
        setLocationError("Geolocation is not supported by your browser");
        setIsDetectingLocation(false);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;

          try {
            // Use existing reverse geocoding API
            const response = await fetch(
              `/api/location/reverse-geocode?lat=${latitude}&lng=${longitude}`
            );
            const data = await response.json();

            if (data.success && data.data && data.data.pincode) {
              const detectedPincode = data.data.pincode;

              // Validate if pincode is serviceable
              const isDeliverable = isPincodeDeliverable(detectedPincode);

              if (!isDeliverable) {
                setLocationError(
                  `Delivery not available for pincode ${detectedPincode}. Please enter a different address.`
                );
                setIsDetectingLocation(false);
                return;
              }

              // Store location data for auto-fill
              const locationData = {
                addressLine: data.data.address || "",
                city: data.data.city || "",
                state: data.data.state || "",
                pincode: detectedPincode,
                lat: latitude,
                lng: longitude,
              };

              localStorage.setItem(
                "autofillAddress",
                JSON.stringify(locationData)
              );

              // Close modal and navigate to addresses page
              onClose();
              navigate("/addresses");
            } else {
              setLocationError(
                "Could not determine your location. Please try again or enter address manually."
              );
            }
          } catch (error) {
            console.error("Reverse geocoding failed:", error);
            setLocationError(
              "Failed to detect your location. Please try again or enter address manually."
            );
          }

          setIsDetectingLocation(false);
        },
        (error) => {
          let errorMessage = "Could not access your location. ";

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += "Please allow location access and try again.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage += "Location request timed out.";
              break;
            default:
              errorMessage += "Please enter address manually.";
              break;
          }

          setLocationError(errorMessage);
          setIsDetectingLocation(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    } catch (error) {
      console.error("Location detection failed:", error);
      setLocationError(
        "Failed to detect your location. Please try again or enter address manually."
      );
      setIsDetectingLocation(false);
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
              Choose your location
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
              Saved Addresses
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
                <p className="text-sm">No saved addresses yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Add a new location below to get started
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
                  <span>Detecting your location...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" />
                  <span>Use My Current Location</span>
                </>
              )}
            </button>

            {/* Location Error Message */}
            {locationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{locationError}</p>
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
              <span>Add New Address</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChooseLocation;
