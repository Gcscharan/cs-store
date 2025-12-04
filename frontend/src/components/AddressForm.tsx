import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "./AccessibleToast";
import { isValidPincode, getPincodeError } from "../utils/pincodeValidator";
import { getCurrentLocationWithAddress } from "../utils/geolocation";
import { getPincodeInfo } from "../utils/pincodeValidation";
import { MapPin, Loader2 } from "lucide-react";

interface AddressFormProps {
  onClose: () => void;
  onSave: (address: any) => void;
}

const AddressForm = ({ onClose, onSave }: AddressFormProps) => {
  const { success, error: showError } = useToast();
  const [formData, setFormData] = useState({
    label: "",
    addressLine: "",
    city: "",
    state: "",
    pincode: "",
    lat: 0,
    lng: 0,
    isDefault: false,
  });

  const [pincode, setPincode] = useState("");
  const [_address, _setAddress] = useState("");
  const [deliveryStatus, setDeliveryStatus] = useState<
    "idle" | "checking" | "available" | "unavailable"
  >("idle");
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [pincodeError, setPincodeError] = useState("");
  const [pincodeData, setPincodeData] = useState<{
    deliverable: boolean;
    state?: string;
    district?: string;
    taluka?: string;
    message?: string;
  } | null>(null);
  const [validationSource, setValidationSource] = useState<
    "manual" | "location" | null
  >(null);

  // Debounced pincode validation effect - only for manual entry
  useEffect(() => {
    // Only validate if it's manual entry and pincode is complete
    if (validationSource !== "manual" || !pincode || pincode.length < 6) {
      if (validationSource === "manual") {
        setDeliveryStatus("idle");
        setPincodeData(null);
      }
      return;
    }

    // Clear previous validation data
    setPincodeData(null);
    setDeliveryStatus("idle");

    const delay = setTimeout(async () => {
      try {
        setDeliveryStatus("checking");
        const pincodeInfo = await getPincodeInfo(pincode);

        setPincodeData(pincodeInfo);

        if (pincodeInfo.deliverable) {
          setDeliveryStatus("available");
        } else {
          setDeliveryStatus("unavailable");
        }
      } catch (error) {
        console.error("Pincode validation failed:", error);
        setDeliveryStatus("unavailable");
        setPincodeData({
          deliverable: false,
          message: "Failed to validate pincode",
        });
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(delay);
  }, [pincode, validationSource]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPincode(value);
    setFormData((prev) => ({
      ...prev,
      pincode: value,
    }));

    // Set validation source to manual
    setValidationSource("manual");

    // Clear previous validation data when user types
    setPincodeData(null);
    setDeliveryStatus("idle");
    setPincodeError("");

    // Basic format validation
    if (value.length === 6) {
      const error = getPincodeError(value);
      setPincodeError(error);
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);
      setValidationSource("location");
      setDeliveryStatus("checking");
      setPincodeData(null);
      setPincodeError("");

      // Check if geolocation is supported
      if (!navigator.geolocation) {
        setDeliveryStatus("unavailable");
        showError(
          "Geolocation not supported",
          "Your browser doesn't support location services. Please enter address manually."
        );
        return;
      }

      // Request geolocation permission and get coordinates
      const locationData = await getCurrentLocationWithAddress();

      if (!locationData) {
        setDeliveryStatus("unavailable");
        showError(
          "Location access denied",
          "Unable to get your current location. Please enable location services and try again."
        );
        return;
      }

      // Validate pincode format
      if (!isValidPincode(locationData.pincode)) {
        setDeliveryStatus("unavailable");
        const error = getPincodeError(locationData.pincode);
        showError("Invalid Location", error);
        return;
      }

      // Update form data with location information
      setFormData((prev) => ({
        ...prev,
        addressLine: locationData.address,
        city: locationData.city,
        state: locationData.state,
        pincode: locationData.pincode,
        lat: locationData.lat,
        lng: locationData.lng,
      }));

      // Update pincode state
      setPincode(locationData.pincode);
      _setAddress(locationData.address);

      // Validate delivery availability
      try {
        const pincodeInfo = await getPincodeInfo(locationData.pincode);
        setPincodeData(pincodeInfo);

        if (pincodeInfo.deliverable) {
          setDeliveryStatus("available");
          success(
            "Location detected successfully!",
            `Your location has been set to ${locationData.city}, ${locationData.state}. Delivery is available to this area.`
          );
        } else {
          setDeliveryStatus("unavailable");
          showError(
            "Delivery not available",
            `We currently don't deliver to ${locationData.city}, ${locationData.state}. Please enter a different address.`
          );
        }
      } catch (validationError) {
        console.error("Location validation failed:", validationError);
        setDeliveryStatus("unavailable");
        setPincodeData({
          deliverable: false,
          message: "Failed to validate location",
        });
        showError(
          "Validation failed",
          "Unable to validate delivery to this location. Please try again or enter address manually."
        );
      }
    } catch (error) {
      console.error("Error getting current location:", error);
      setDeliveryStatus("unavailable");

      // Provide specific error messages based on error type
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            showError(
              "Location access denied",
              "Please allow location access in your browser settings and try again."
            );
            break;
          case error.POSITION_UNAVAILABLE:
            showError(
              "Location unavailable",
              "Your location could not be determined. Please check your GPS/WiFi settings."
            );
            break;
          case error.TIMEOUT:
            showError(
              "Location timeout",
              "Location request timed out. Please try again."
            );
            break;
          default:
            showError(
              "Location error",
              "Unable to get your current location. Please enter address manually."
            );
        }
      } else {
        showError(
          "Location error",
          "Unable to get your current location. Please enter address manually."
        );
      }
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate pincode first
    if (!isValidPincode(pincode)) {
      const error = getPincodeError(pincode);
      showError("Invalid Pincode", error);
      return;
    }

    // Check if validation is still in progress
    if (deliveryStatus === "checking") {
      showError(
        "Please wait",
        "Pincode validation is in progress. Please wait for the result."
      );
      return;
    }

    // Check delivery availability
    if (deliveryStatus !== "available" || !pincodeData?.deliverable) {
      showError(
        "Unable to deliver to this location.",
        "Please enter a valid pincode from Andhra Pradesh or Telangana."
      );
      return;
    }

    if (!formData.label || !formData.addressLine || !formData.city) {
      showError(
        "Please fill in all required fields.",
        "All fields marked with * are required."
      );
      return;
    }

    onSave({
      ...formData,
      state: pincodeData?.state || formData.state,
    });

    success("Address saved", "Your address has been saved successfully.");
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Add Address
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Label */}
              <div>
                <label className="label">Label *</label>
                <input
                  type="text"
                  name="label"
                  value={formData.label}
                  onChange={handleInputChange}
                  placeholder="Home, Office, etc."
                  className="input"
                  required
                />
              </div>

              {/* Address */}
              <div>
                <label className="label">Address Line *</label>
                <textarea
                  name="addressLine"
                  value={formData.addressLine}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      addressLine: e.target.value,
                    }))
                  }
                  placeholder="Street address, building, etc."
                  className="input min-h-[80px] resize-none"
                  required
                />

                {/* Use Current Location Button */}
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLoadingLocation}
                    className="flex items-center space-x-2 px-4 py-2 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isLoadingLocation ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MapPin className="h-4 w-4" />
                    )}
                    <span>
                      {isLoadingLocation
                        ? "Detecting location..."
                        : "Use My Current Location"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Pincode */}
              <div>
                <label className="label">Pincode *</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={handlePincodeChange}
                  placeholder="6-digit pincode"
                  className="input"
                  maxLength={6}
                  required
                />
                {pincodeError && (
                  <div className="text-sm text-red-600 mt-1">
                    {pincodeError}
                  </div>
                )}
                {deliveryStatus === "checking" && (
                  <div className="text-sm text-blue-600 mt-1 flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Checking delivery availability...
                  </div>
                )}
                {deliveryStatus === "available" && pincodeData && (
                  <div className="text-sm text-green-600 mt-1">
                    ✅ Delivery available to {pincodeData.state}
                  </div>
                )}
                {deliveryStatus === "unavailable" && (
                  <div className="text-sm text-red-600 mt-1">
                    ❌ Not deliverable to this location or pincode
                  </div>
                )}
              </div>

              {/* City */}
              <div>
                <label className="label">City *</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleInputChange}
                  placeholder="City name"
                  className="input"
                  required
                />
              </div>

              {/* State (auto-filled from pincode) */}
              {pincodeData?.state && deliveryStatus === "available" && (
                <div>
                  <label className="label">State</label>
                  <input
                    type="text"
                    value={pincodeData.state}
                    className="input bg-gray-100"
                    readOnly
                  />
                </div>
              )}

              {/* Default Address */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={formData.isDefault}
                  onChange={handleInputChange}
                  className="rounded"
                />
                <label className="text-sm text-gray-700">
                  Set as default address
                </label>
              </div>

              {/* Submit Button */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    deliveryStatus === "checking" ||
                    deliveryStatus === "unavailable" ||
                    deliveryStatus === "idle"
                  }
                  className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {deliveryStatus === "checking"
                    ? "Validating..."
                    : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AddressForm;
