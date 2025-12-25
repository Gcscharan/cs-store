import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Truck, MapPin, Clock, CheckCircle, XCircle } from "lucide-react";
import {
  calculateDeliveryFeeForPincode,
  formatDeliveryFee,
  isValidPincode,
  DeliveryFeeResult,
} from "../utils/deliveryFeeCalculator";

interface DeliveryFeeDisplayProps {
  pincode: string;
  cartValue: number;
  onFeeChange?: (fee: number, isFree: boolean, isAvailable: boolean) => void;
  className?: string;
}

const DeliveryFeeDisplay: React.FC<DeliveryFeeDisplayProps> = ({
  pincode,
  cartValue,
  onFeeChange,
  className = "",
}) => {
  const [deliveryFee, setDeliveryFee] = useState<DeliveryFeeResult | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculateFee = async () => {
      if (!pincode || !isValidPincode(pincode)) {
        setDeliveryFee(null);
        setError("Please enter a valid 6-digit pincode");
        onFeeChange?.(0, false, false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const result = await calculateDeliveryFeeForPincode(pincode, cartValue);
        setDeliveryFee(result);
        onFeeChange?.(
          result.totalFee,
          result.isFreeDelivery,
          result.isDeliveryAvailable
        );
      } catch (err) {
        console.error("Error calculating delivery fee:", err);
        setError("Error calculating delivery fee");
        onFeeChange?.(0, false, false);
      } finally {
        setIsLoading(false);
      }
    };

    calculateFee();
  }, [pincode, cartValue, onFeeChange]);

  if (!pincode) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center text-gray-500">
          <MapPin className="h-5 w-5 mr-2" />
          <span>Enter delivery pincode to calculate delivery fee</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`bg-gray-50 rounded-lg p-4 ${className}`}>
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3"></div>
          <span className="text-gray-600">Calculating delivery fee...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}
      >
        <div className="flex items-center text-red-600">
          <XCircle className="h-5 w-5 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!deliveryFee) {
    return null;
  }

  // Create breakdown array from deliveryFee object
  const breakdown = [
    `Base Fee: ₹${deliveryFee.baseFee}`,
    `Distance Fee: ₹${deliveryFee.distanceFee}`,
    `Total: ₹${deliveryFee.totalFee}`,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center">
          <Truck className="h-5 w-5 text-blue-600 mr-2" />
          <span className="font-medium text-gray-900">Delivery Fee</span>
        </div>

        <div className="flex items-center">
          {deliveryFee.isFreeDelivery ? (
            <div className="flex items-center text-green-600">
              <CheckCircle className="h-5 w-5 mr-1" />
              <span className="font-semibold">Free Delivery</span>
            </div>
          ) : deliveryFee.isDeliveryAvailable ? (
            <div className="text-right">
              <div className="text-lg font-semibold text-gray-900">
                {formatDeliveryFee(
                  deliveryFee.totalFee,
                  deliveryFee.isFreeDelivery
                )}
              </div>
              {deliveryFee.distance !== null && deliveryFee.distance > 0 && (
                <div className="text-xs text-gray-500">
                  {deliveryFee.distance}km from warehouse
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center text-red-600">
              <XCircle className="h-5 w-5 mr-1" />
              <span className="font-semibold">Not Available</span>
            </div>
          )}
        </div>
      </div>

      {deliveryFee.isDeliveryAvailable && !deliveryFee.isFreeDelivery && (
        <div className="space-y-1 text-sm text-gray-600">
          {breakdown.map((item, index) => (
            <div key={index} className="flex justify-between">
              <span>{item.split(":")[0]}:</span>
              <span>{item.split(":")[1]}</span>
            </div>
          ))}
        </div>
      )}

      {deliveryFee.isFreeDelivery && (
        <div className="flex items-center text-green-600 text-sm">
          <Clock className="h-4 w-4 mr-1" />
          <span>Orders above ₹500 qualify for free delivery</span>
        </div>
      )}

      {!deliveryFee.isDeliveryAvailable && deliveryFee.error && (
        <div className="text-sm text-red-600">{deliveryFee.error}</div>
      )}
    </motion.div>
  );
};

export default DeliveryFeeDisplay;
