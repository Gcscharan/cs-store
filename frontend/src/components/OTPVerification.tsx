import React, { useState, useEffect } from "react";
import { X, Clock, RefreshCw } from "lucide-react";
import { toast } from "react-hot-toast";

interface OTPVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (paymentId: string) => void;
  orderId: string;
  cardNumber: string;
  cardHolderName: string;
  amount: number;
}

const OTPVerification: React.FC<OTPVerificationProps> = ({
  isOpen,
  onClose,
  onSuccess,
  orderId,
  cardNumber,
  cardHolderName,
  amount,
}) => {
  const [otp, setOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes in seconds
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [paymentId, setPaymentId] = useState("");

  // Timer countdown
  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, timeLeft]);

  // Generate OTP when modal opens
  useEffect(() => {
    if (isOpen && !paymentId) {
      generateOTP();
    }
  }, [isOpen, paymentId]);

  const generateOTP = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("accessToken");

      const response = await fetch("/api/otp/payment/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId,
          cardNumber: cardNumber.replace(/\s/g, ""),
          cardHolderName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setPaymentId(data.paymentId);
        setTimeLeft(600);
        toast.success("OTP sent to your registered mobile number");
      } else {
        toast.error(data.message || "Failed to generate OTP");
      }
    } catch (error) {
      console.error("Generate OTP error:", error);
      toast.error("Failed to generate OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setIsLoading(true);
      const token = localStorage.getItem("accessToken");

      const response = await fetch("/api/otp/payment/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentId,
          otp,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Payment verified successfully!");
        onSuccess(paymentId);
        onClose();
      } else {
        toast.error(data.message || "Invalid OTP");
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      toast.error("Failed to verify OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const resendOTP = async () => {
    try {
      setIsResending(true);
      const token = localStorage.getItem("accessToken");

      const response = await fetch("/api/otp/payment/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTimeLeft(600);
        toast.success("OTP resent successfully");
      } else {
        toast.error(data.message || "Failed to resend OTP");
      }
    } catch (error) {
      console.error("Resend OTP error:", error);
      toast.error("Failed to resend OTP");
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Verify Payment
          </h2>
          <p className="text-gray-600">
            Enter the 6-digit OTP sent to your mobile number
          </p>
        </div>

        {/* Payment Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Card ending in</span>
            <span className="font-medium">****{cardNumber.slice(-4)}</span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Amount</span>
            <span className="font-bold text-lg">₹{amount}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">Card Holder</span>
            <span className="font-medium">{cardHolderName}</span>
          </div>
        </div>

        {/* OTP Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Enter OTP
          </label>
          <input
            type="text"
            value={otp}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "").slice(0, 6);
              setOtp(value);
            }}
            placeholder="000000"
            className="w-full px-4 py-3 text-center text-2xl font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            maxLength={6}
          />
        </div>

        {/* Timer */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>
              OTP expires in{" "}
              <span className="font-bold text-red-600">
                {formatTime(timeLeft)}
              </span>
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={verifyOTP}
            disabled={isLoading || otp.length !== 6 || timeLeft <= 0}
            className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "Verifying..." : "Verify & Pay"}
          </button>

          <button
            onClick={resendOTP}
            disabled={isResending || timeLeft > 540} // Can resend after 1 minute
            className="w-full py-2 px-4 text-blue-600 font-medium rounded-lg hover:bg-blue-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <RefreshCw
              className={`h-4 w-4 ${isResending ? "animate-spin" : ""}`}
            />
            <span>{isResending ? "Resending..." : "Resend OTP"}</span>
          </button>
        </div>

        {/* Security Note */}
        <div className="mt-6 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p className="text-xs text-yellow-800 text-center">
            🔒 This is a secure payment. Never share your OTP with anyone.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OTPVerification;
