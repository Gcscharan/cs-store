import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { useToast } from "./AccessibleToast";
import { addAddress, Address } from "../utils/addressManager";

interface PincodeAddressFormProps {
  onAddressAdded: (address: Address) => void;
  onClose: () => void;
}

const PincodeAddressForm: React.FC<PincodeAddressFormProps> = ({
  onAddressAdded,
  onClose,
}) => {
  const { success, error: showError } = useToast();

  // Pincode validation state
  const [pincode, setPincode] = useState("");
  const [pincodeValid, setPincodeValid] = useState<boolean | null>(null);
  const [pincodeMessage, setPincodeMessage] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // Check for autofill data on component mount
  React.useEffect(() => {
    const autofillData = localStorage.getItem("autofillAddress");
    if (autofillData) {
      try {
        const locationData = JSON.parse(autofillData);
        setPincode(locationData.pincode);
        setCity(locationData.city);
        setState(locationData.state);
        setPincodeValid(true);
        setPincodeMessage("✅ Delivery is available to this location.");
        // Clear the autofill data
        localStorage.removeItem("autofillAddress");
      } catch (error) {
        console.error("Error parsing autofill data:", error);
      }
    }
  }, []);

  // Address form state
  const [addressForm, setAddressForm] = useState({
    houseNo: "",
    landmark: "",
    label: "Home",
  });

  // Handle pincode validation
  const handlePincodeChange = async (value: string) => {
    // Only allow numeric input
    const numericValue = value.replace(/\D/g, "");
    setPincode(numericValue);

    if (numericValue.length === 6) {
      setIsValidating(true);
      setPincodeValid(null);
      setPincodeMessage("Checking delivery availability...");

      try {
        const res = await fetch(`/api/pincode/check/${numericValue}`);
        const data = await res.json();

        if (res.ok && data.deliverable) {
          setPincodeValid(true);
          setPincodeMessage("✅ Delivery is available to this location.");
          setCity(data.district || "Unknown City");
          setState(data.state || "Unknown State");
        } else {
          setPincodeValid(false);
          setPincodeMessage("❌ Delivery is not available to this location.");
          setCity("");
          setState("");
        }
      } catch (err) {
        console.error("Pincode check failed:", err);
        setPincodeValid(false);
        setPincodeMessage("❌ Unable to check delivery. Please try again.");
        setCity("");
        setState("");
      } finally {
        setIsValidating(false);
      }
    } else if (numericValue.length > 0) {
      setPincodeValid(false);
      setPincodeMessage("Please enter a complete 6-digit pincode.");
      setCity("");
      setState("");
    } else {
      setPincodeValid(null);
      setPincodeMessage("");
      setCity("");
      setState("");
    }
  };

  // Handle address form input changes
  const handleAddressFormChange = (field: string, value: string) => {
    setAddressForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Handle save new address
  const handleSaveAddress = () => {
    if (!pincodeValid) {
      showError("Invalid pincode", "Please enter a valid pincode first.");
      return;
    }

    if (!city.trim()) {
      showError("Missing information", "Please enter city name.");
      return;
    }

    if (!state.trim()) {
      showError("Missing information", "Please enter state name.");
      return;
    }

    if (!addressForm.houseNo.trim()) {
      showError(
        "Missing information",
        "Please enter house number/street address."
      );
      return;
    }

    const newAddress = {
      label: addressForm.label,
      addressLine: `${addressForm.houseNo}${
        addressForm.landmark ? `, ${addressForm.landmark}` : ""
      }`,
      city,
      state,
      pincode,
      lat: 0,
      lng: 0,
      isDefault: false,
    };

    const savedAddress = addAddress(newAddress);
    onAddressAdded(savedAddress);
    onClose();

    // Reset form
    setPincode("");
    setPincodeValid(null);
    setPincodeMessage("");
    setCity("");
    setState("");
    setAddressForm({ houseNo: "", landmark: "", label: "Home" });

    success("Address saved", "Your new address has been saved successfully.");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Add New Address
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Pincode Validation Section */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Check Delivery Availability
            </h3>

            <div className="max-w-md">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pincode *
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => handlePincodeChange(e.target.value)}
                onBlur={(e) => handlePincodeChange(e.target.value)}
                placeholder="Enter 6-digit pincode"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {pincodeMessage && (
                <div className="mt-2 flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      pincodeValid ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></div>
                  <p
                    className={`text-sm ${
                      pincodeValid ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {pincodeMessage}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Address Form Section */}
          {pincodeValid && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-6"
            >
              <h3 className="text-lg font-semibold text-gray-900">
                Address Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pincode (read-only) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={pincode}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                  />
                </div>

                {/* City (editable) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    City *
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Enter city name"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      city.trim() ? "border-green-300" : "border-gray-300"
                    }`}
                  />
                  {city.trim() && (
                    <p className="mt-1 text-xs text-green-600 flex items-center">
                      <Check className="h-3 w-3 mr-1" />
                      City entered
                    </p>
                  )}
                </div>

                {/* State (editable) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State *
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="Enter state name"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      state.trim() ? "border-green-300" : "border-gray-300"
                    }`}
                  />
                  {state.trim() && (
                    <p className="mt-1 text-xs text-green-600 flex items-center">
                      <Check className="h-3 w-3 mr-1" />
                      State entered
                    </p>
                  )}
                </div>

                {/* Label */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Label
                  </label>
                  <select
                    value={addressForm.label}
                    onChange={(e) =>
                      handleAddressFormChange("label", e.target.value)
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Home">Home</option>
                    <option value="Office">Office</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* House No / Street */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    House No / Street Address *
                  </label>
                  <input
                    type="text"
                    value={addressForm.houseNo}
                    onChange={(e) =>
                      handleAddressFormChange("houseNo", e.target.value)
                    }
                    placeholder="Enter house number and street address"
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      addressForm.houseNo.trim()
                        ? "border-green-300"
                        : "border-gray-300"
                    }`}
                  />
                  {addressForm.houseNo.trim() && (
                    <p className="mt-1 text-xs text-green-600 flex items-center">
                      <Check className="h-3 w-3 mr-1" />
                      Address entered
                    </p>
                  )}
                </div>

                {/* Landmark (optional) */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    value={addressForm.landmark}
                    onChange={(e) =>
                      handleAddressFormChange("landmark", e.target.value)
                    }
                    placeholder="Near landmark, building name, etc."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Help Text */}
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  💡 <strong>Tip:</strong> City and State are automatically
                  filled when you enter a valid pincode, but you can edit them
                  if needed. All fields marked with * are required.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAddress}
                  disabled={
                    !pincodeValid ||
                    !city.trim() ||
                    !state.trim() ||
                    !addressForm.houseNo.trim()
                  }
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  Save Address
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PincodeAddressForm;
