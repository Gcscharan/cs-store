import { useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import {
  openRazorpayCheckout,
  createRazorpayOrder,
  verifyPayment,
} from "../utils/razorpay";
import toast from "react-hot-toast";

interface RazorpayCheckoutProps {
  orderData: {
    items: any[];
    totalAmount: number;
    address: any;
  };
  onSuccess: (order: any) => void;
  onError: (error: string) => void;
}

const RazorpayCheckout = ({
  orderData,
  onSuccess,
  onError,
}: RazorpayCheckoutProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useSelector((state: RootState) => state.auth);

  const handlePayment = async () => {
    try {
      setIsLoading(true);

      // Validate minimum order amount
      if (orderData.totalAmount < 2000) {
        throw new Error(
          "Minimum order is ₹2000. Add more items or contact support."
        );
      }

      // Create Razorpay order
      const orderResponse = await createRazorpayOrder(
        orderData.totalAmount,
        "INR",
        `order_${Date.now()}`
      );

      const razorpayOptions = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
        amount: orderData.totalAmount * 100, // Convert to paise
        currency: "INR",
        name: "CPS Store",
        description: "Order Payment",
        order_id: orderResponse.razorpayOrderId,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        theme: {
          color: "#0ea5e9",
        },
        handler: async (response: any) => {
          try {
            // Verify payment
            const verificationResult = await verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            toast.success("Payment successful!");
            onSuccess(verificationResult.order);
          } catch (error) {
            console.error("Payment verification failed:", error);
            toast.error("Payment verification failed");
            onError("Payment verification failed");
          }
        },
        modal: {
          ondismiss: () => {
            toast.error("Payment cancelled");
            onError("Payment cancelled");
          },
        },
      };

      await openRazorpayCheckout(razorpayOptions);
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.message || "Payment failed");
      onError(error.message || "Payment failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={isLoading || orderData.totalAmount < 2000}
      className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
        isLoading || orderData.totalAmount < 2000
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-primary-600 hover:bg-primary-700"
      }`}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          Processing...
        </div>
      ) : orderData.totalAmount < 2000 ? (
        `Minimum order is ₹2000 (Current: ₹${orderData.totalAmount})`
      ) : (
        `Pay ₹${orderData.totalAmount}`
      )}
    </button>
  );
};

export default RazorpayCheckout;
