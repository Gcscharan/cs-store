import { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { setAuth, logout } from "../store/slices/authSlice";
import { useRefreshTokenMutation } from "../store/api";
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
  const dispatch = useDispatch();
  const { user, tokens } = useSelector((state: RootState) => state.auth);
  const [refreshTokenMutation] = useRefreshTokenMutation();

  const refreshToken = async (): Promise<string | null> => {
    try {
      if (!tokens?.refreshToken) {
        console.log("🔑 No refresh token available");
        return null;
      }

      console.log("🔑 Attempting to refresh token...");
      const result = await refreshTokenMutation(tokens.refreshToken).unwrap();

      if (result.accessToken) {
        console.log("🔑 Token refreshed successfully");
        dispatch(
          setAuth({
            user: user!,
            tokens: {
              accessToken: result.accessToken,
              refreshToken: result.refreshToken || tokens.refreshToken,
            },
          })
        );
        return result.accessToken;
      }

      return null;
    } catch (error) {
      console.error("🔑 Token refresh failed:", error);
      dispatch(logout());
      return null;
    }
  };

  const handlePayment = async () => {
    try {
      setIsLoading(true);

      // Check if user is authenticated
      if (!user || !tokens?.accessToken) {
        toast.error("Please log in to continue");
        onError("User not authenticated");
        return;
      }

      // Check if address is selected
      if (!orderData.address) {
        toast.error("Please select a delivery address");
        onError("Delivery address required");
        return;
      }

      // Check if token is expired and refresh if needed
      let accessToken = tokens.accessToken;
      try {
        const payload = JSON.parse(atob(accessToken.split(".")[1]));
        const currentTime = Math.floor(Date.now() / 1000);
        if (payload.exp < currentTime) {
          console.log("🔑 Token expired, refreshing...");
          const newToken = await refreshToken();
          if (!newToken) {
            throw new Error("Failed to refresh token");
          }
          accessToken = newToken;
        }
      } catch (error) {
        console.log("🔑 Invalid token, refreshing...");
        const newToken = await refreshToken();
        if (!newToken) {
          throw new Error("Failed to refresh token");
        }
        accessToken = newToken;
      }

      // Create order and get Razorpay order ID
      const orderResponse = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items: orderData.items,
          address: orderData.address,
          totalAmount: orderData.totalAmount,
        }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || "Failed to create order");
      }

      const orderData_response = await orderResponse.json();

      const razorpayOptions = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_RREROYUEXDmjIA",
        amount: orderData.totalAmount * 100, // Convert to paise
        currency: "INR",
        name: "CS Store",
        description: "Secure Payment for Your Order",
        order_id: orderData_response.razorpayOrderId,
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: user?.phone || "",
        },
        theme: {
          color: "#2E86DE",
        },
        // Enable all payment methods
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: true,
          paylater: true,
        },
        // Additional options for better UX
        modal: {
          ondismiss: function () {
            toast.error("Payment cancelled by user");
            onError("Payment cancelled by user");
          },
          escape: true,
          handleback: true,
        },
        // Enable retry for failed payments
        retry: {
          enabled: true,
          max_count: 3,
        },
        // Enable callback URL for webhook (optional)
        callback_url: `${
          import.meta.env.VITE_API_URL || "http://localhost:5001"
        }/api/payment/callback`,
        handler: async (response: any) => {
          try {
            // Verify payment
            const verificationResult = await verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature
            );

            toast.success("Payment Successful ✅");
            onSuccess(verificationResult.payment);
          } catch (error) {
            console.error("Payment verification failed:", error);
            toast.error("Payment Failed ❌ Please try again");
            onError("Payment verification failed");
          }
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
      disabled={isLoading}
      className={`w-full py-3 px-6 rounded-lg font-semibold text-white transition-colors ${
        isLoading
          ? "bg-gray-400 cursor-not-allowed"
          : "bg-primary-600 hover:bg-primary-700"
      }`}
    >
      {isLoading ? (
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          Processing...
        </div>
      ) : (
        `Pay ₹${orderData.totalAmount}`
      )}
    </button>
  );
};

export default RazorpayCheckout;
