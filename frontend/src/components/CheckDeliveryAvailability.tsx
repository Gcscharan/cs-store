import React, { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Check } from "lucide-react";
import {
  isValidPincode,
  getCityAndStateFromPincode,
} from "../utils/pincodeValidator";
import { getPincodeInfo } from "../utils/pincodeValidation";
import { useToast } from "./AccessibleToast";

interface CheckDeliveryAvailabilityProps {
  onPincodeValid?: (pincode: string, city: string, state: string) => void;
  onPincodeInvalid?: () => void;
  className?: string;
}

const CheckDeliveryAvailability: React.FC<CheckDeliveryAvailabilityProps> = ({
  onPincodeValid,
  onPincodeInvalid,
  className = "",
}) => {
  const { success: _success, error: _showError } = useToast();

  // Pincode validation state
  const [pincode, setPincode] = useState("");
  const [pincodeValid, setPincodeValid] = useState<boolean | null>(null);
  const [pincodeMessage, setPincodeMessage] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // Handle pincode validation
  const handlePincodeChange = async (value: string) => {
    // Only allow numeric input
    const numericValue = value.replace(/\D/g, "");
    setPincode(numericValue);

    if (numericValue.length === 6) {
      setIsValidating(true);

      try {
        // First check with frontend validation
        const isValid = isValidPincode(numericValue);

        if (isValid) {
          // If frontend validation passes, check with backend API
          const pincodeInfo = await getPincodeInfo(numericValue);

          if (pincodeInfo.deliverable) {
            setPincodeValid(true);
            setPincodeMessage("✅ Delivery is available to this location.");

            const { city: pincodeCity, state: pincodeState } =
              getCityAndStateFromPincode(numericValue);
            setCity(pincodeCity);
            setState(pincodeState);

            // Call the callback with valid pincode data
            onPincodeValid?.(numericValue, pincodeCity, pincodeState);
          } else {
            setPincodeValid(false);
            setPincodeMessage("❌ Delivery is not available to this location.");
            setCity("");
            setState("");
            onPincodeInvalid?.();
          }
        } else {
          setPincodeValid(false);
          setPincodeMessage("❌ Delivery is not available to this location.");
          setCity("");
          setState("");
          onPincodeInvalid?.();
        }
      } catch (error) {
        console.error("Pincode validation error:", error);
        setPincodeValid(false);
        setPincodeMessage("❌ Unable to validate pincode. Please try again.");
        setCity("");
        setState("");
        onPincodeInvalid?.();
      } finally {
        setIsValidating(false);
      }
    } else if (numericValue.length > 0) {
      setPincodeValid(false);
      setPincodeMessage("Please enter a complete 6-digit pincode.");
      setCity("");
      setState("");
      onPincodeInvalid?.();
    } else {
      setPincodeValid(null);
      setPincodeMessage("");
      setCity("");
      setState("");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-lg shadow-flipkart border border-neutral-200 p-6 ${className}`}
    >
      <h2 className="text-xl font-semibold text-neutral-900 mb-4 flex items-center">
        <MapPin className="h-5 w-5 text-primary-600 mr-2" />
        Check Delivery Availability
      </h2>

      <div className="max-w-md">
        <label className="block text-sm font-medium text-neutral-700 mb-2">
          Pincode *
        </label>
        <div className="relative">
          <input
            type="text"
            value={pincode}
            onChange={(e) => handlePincodeChange(e.target.value)}
            onBlur={(e) => handlePincodeChange(e.target.value)}
            placeholder="Enter 6-digit pincode"
            maxLength={6}
            className="w-full px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
            disabled={isValidating}
          />
          {isValidating && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-500 border-t-transparent"></div>
            </div>
          )}
        </div>

        {pincodeMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 flex items-center space-x-2"
          >
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
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
          </motion.div>
        )}

        {/* Show city and state if valid */}
        {pincodeValid && city && state && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg"
          >
            <div className="flex items-center space-x-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">
                Delivery available to {city}, {state}
              </span>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default CheckDeliveryAvailability;
