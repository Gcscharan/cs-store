import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import {
  CreditCard,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Shield,
  Lock,
} from "lucide-react";
import { useToast } from "../components/AccessibleToast";
import { createRazorpayOrder, openRazorpayCheckout } from "../utils/razorpay";
import { formatPrice } from "../utils/priceCalculator";

interface PaymentData {
  cartTotal: number;
  priceBreakdown: {
    subtotal: number;
    discount: number;
    deliveryFee: number;
    total: number;
    itemCount: number;
    isFreeDelivery: boolean;
    savings: number;
  };
  userInfo: {
    name: string;
    email: string;
    phone: string;
  };
  orderDetails: {
    items: any[];
    address: any;
  };
}

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { success, error: showError } = useToast();
  const { user } = useSelector((state: RootState) => state.auth);
  const { items: _cartItems } = useSelector((state: RootState) => state.cart);

  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "processing" | "success" | "failed"
  >("idle");

  // Use price breakdown from cart page (passed via paymentData)
  const priceBreakdown = paymentData?.priceBreakdown || null;

  useEffect(() => {
    // Get payment data from location state
    if (location.state?.paymentData) {
      setPaymentData(location.state.paymentData);
    } else {
      // If no payment data, redirect back to checkout
      showError(
        "Invalid Payment Data",
        "Please complete the address selection first."
      );
      navigate("/checkout");
    }
  }, [location.state, navigate, showError]);

  const handleRazorpayPayment = async () => {
    if (!paymentData || !user) {
      showError(
        "Authentication required",
        "Please log in to proceed with payment."
      );
      return;
    }

    setIsProcessingPayment(true);
    setPaymentStatus("processing");

    try {
      const order = await createRazorpayOrder(
        paymentData.cartTotal,
        "INR",
        `order_${Date.now()}`
      );

      await openRazorpayCheckout(
        order,
        paymentData.userInfo,
        (paymentId: string, orderId: string) => {
          // Payment successful
          setPaymentStatus("success");
          success(
            "Payment Successful!",
            "Your order has been placed successfully."
          );
          setIsProcessingPayment(false);
          // Navigate to order confirmation page
          setTimeout(() => {
            navigate("/orders", {
              state: {
                paymentId,
                orderId,
                orderDetails: paymentData.orderDetails,
              },
            });
          }, 2000);
        },
        (error: string) => {
          // Payment failed
          setPaymentStatus("failed");
          showError("Payment Failed", error);
          setIsProcessingPayment(false);
        }
      );
    } catch (error) {
      console.error("Payment error:", error);
      setPaymentStatus("failed");
      showError(
        "Payment Error",
        "Failed to process payment. Please try again."
      );
      setIsProcessingPayment(false);
    }
  };

  const formatAddress = (address: any) => {
    if (!address) return "";
    return `${address.houseNo}, ${address.landmark || ""}, ${address.city}, ${
      address.state
    } - ${address.pincode}`
      .replace(/, ,/g, ",")
      .replace(/^,|,$/g, "");
  };

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-gray-50  flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 ">Loading payment details...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gray-50  py-8"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/checkout")}
            className="flex items-center space-x-2 text-gray-600  hover:text-gray-900  mb-4"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Checkout</span>
          </button>

          <h1 className="text-3xl font-bold text-gray-900 ">
            Complete Your Payment
          </h1>
          <p className="text-gray-600  mt-2">
            Secure payment powered by Razorpay
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Payment Section */}
          <div className="lg:col-span-2">
            <div className="bg-white  rounded-lg shadow-sm border border-gray-200  p-6 mb-6">
              <h2 className="text-xl font-semibold text-gray-900  mb-6">
                Choose Payment Method
              </h2>

              {/* Payment Status */}
              {paymentStatus === "success" && (
                <div className="mb-6 p-4 bg-green-50  border border-green-200  rounded-lg">
                  <div className="flex items-center">
                    <CheckCircle className="h-5 w-5 text-green-600  mr-3" />
                    <div>
                      <h3 className="text-green-800  font-medium">
                        Payment Successful!
                      </h3>
                      <p className="text-green-700  text-sm">
                        Your order has been confirmed. Redirecting to order
                        details...
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {paymentStatus === "failed" && (
                <div className="mb-6 p-4 bg-red-50  border border-red-200  rounded-lg">
                  <div className="flex items-center">
                    <XCircle className="h-5 w-5 text-red-600  mr-3" />
                    <div>
                      <h3 className="text-red-800  font-medium">
                        Payment Failed
                      </h3>
                      <p className="text-red-700  text-sm">
                        Please try again or choose a different payment method.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Razorpay Payment Button */}
              <button
                onClick={handleRazorpayPayment}
                disabled={isProcessingPayment || paymentStatus === "success"}
                className="w-full flex items-center justify-center space-x-3 p-4 border-2 border-blue-500 bg-blue-50  rounded-lg hover:bg-blue-100  transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessingPayment ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600 " />
                ) : (
                  <CreditCard className="h-5 w-5 text-blue-600 " />
                )}
                <span className="text-blue-900  font-medium text-lg">
                  {isProcessingPayment
                    ? "Processing Payment..."
                    : paymentStatus === "success"
                    ? "Payment Successful"
                    : "Pay with Razorpay"}
                </span>
              </button>

              {/* Payment Methods Info */}
              <div className="mt-6 p-4 bg-blue-50  rounded-lg">
                <p className="text-sm text-blue-800  font-medium mb-3">
                  Available Payment Methods:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center space-x-2 text-blue-700 ">
                    <span className="text-lg">💳</span>
                    <span>Cards</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-700 ">
                    <span className="text-lg">📱</span>
                    <span>UPI</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-700 ">
                    <span className="text-lg">🏦</span>
                    <span>Net Banking</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-700 ">
                    <span className="text-lg">💰</span>
                    <span>Wallets</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-700 ">
                    <span className="text-lg">📊</span>
                    <span>EMI</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-700 ">
                    <span className="text-lg">⏰</span>
                    <span>Pay Later</span>
                  </div>
                </div>
              </div>

              {/* Security Info */}
              <div className="mt-6 p-4 bg-gray-50  rounded-lg">
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-green-600 " />
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 ">
                      Secure Payment
                    </h4>
                    <p className="text-xs text-gray-600 ">
                      Your payment is secured by Razorpay with 256-bit SSL
                      encryption
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white  rounded-lg shadow-sm border border-gray-200  p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900  mb-4">
                Order Summary
              </h3>

              {/* Delivery Address */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900  mb-2">
                  Delivery Address
                </h4>
                <p className="text-sm text-gray-600 ">
                  {formatAddress(paymentData.orderDetails.address)}
                </p>
              </div>

              {/* Order Items */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-900  mb-3">
                  Items ({paymentData.orderDetails.items.length})
                </h4>
                <div className="space-y-2">
                  {paymentData.orderDetails.items.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-600 ">
                        {item.name} x {item.quantity}
                      </span>
                      <span className="text-gray-900 ">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown - Uses same values from cart page */}
              {priceBreakdown && (
                <div className="mb-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-900">
                      {formatPrice(priceBreakdown.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount:</span>
                    <span className="text-green-600">
                      - {formatPrice(priceBreakdown.discount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Delivery:</span>
                    <span className="text-gray-900">
                      {priceBreakdown.isFreeDelivery
                        ? "FREE"
                        : formatPrice(priceBreakdown.deliveryFee)}
                    </span>
                  </div>
                </div>
              )}

              {/* Total */}
              <div className="border-t border-gray-200  pt-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-gray-900 ">Total</span>
                  <span className="text-gray-900 ">
                    {priceBreakdown
                      ? formatPrice(priceBreakdown.total)
                      : formatPrice(paymentData.cartTotal)}
                  </span>
                </div>
              </div>

              {/* Security Badge */}
              <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-gray-500 ">
                <Lock className="h-4 w-4" />
                <span>Secured by Razorpay</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default PaymentPage;
