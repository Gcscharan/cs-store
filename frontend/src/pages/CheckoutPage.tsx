import React, { useState } from "react";
import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { clearCart } from "../store/slices/cartSlice";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import ChooseLocation from "../components/ChooseLocation";
import DeliveryFeeDisplay from "../components/DeliveryFeeDisplay";
import {
  calculatePriceBreakdown,
  formatPrice,
  formatDeliveryFee,
} from "../utils/priceCalculator";
import {
  calculateDeliveryFee,
} from "../utils/deliveryFeeCalculator";
import toast from "react-hot-toast";
import { MapPin, Shield } from "lucide-react";
import api, {
  useClearCartMutation,
  useGetAddressesQuery,
  useSetDefaultAddressMutation,
} from "../store/api";
import RazorpayCheckout from "../components/RazorpayCheckout";
import { createRazorpayOrder, openRazorpayCheckout } from "../utils/razorpay";

const CheckoutPage = () => {
  const cart = useSelector((state: RootState) => state.cart);
  const { user, isAuthenticated, tokens } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [clearCartMutation] = useClearCartMutation();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isPincodeServiceable, setIsPincodeServiceable] = useState<boolean | null>(null);
  
  // Fetch addresses using RTK Query (same as navbar and Layout)
  const { data: addressesData, refetch: refetchAddresses } = useGetAddressesQuery(undefined, {
    skip: !isAuthenticated,
  });
  const [setDefaultAddressMutation] = useSetDefaultAddressMutation();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"cod" | "upi" | "razorpay">("upi");
  const [upiVpa, setUpiVpa] = useState("");
  const [createdUpiOrderId, setCreatedUpiOrderId] = useState<string | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);
  const [razorpayAttempt, setRazorpayAttempt] = useState(1);
  const [isRazorpayPolling, setIsRazorpayPolling] = useState(false);

  // Helper function to clear both Redux cart and backend MongoDB cart
  const clearCartCompletely = async () => {
    try {
      // Clear Redux state (in-memory only, no localStorage)
      dispatch(clearCart());
      
      // Clear backend MongoDB cart if user is authenticated
      if (isAuthenticated) {
        await clearCartMutation(undefined).unwrap();
        console.log("✅ Backend MongoDB cart cleared successfully");
      }
    } catch (error) {
      console.error("Error clearing backend cart:", error);
      // Even if backend fails, Redux state will still be cleared
    }
  };

  const pollOrderUntilPaid = async (args: {
    orderId: string;
    accessToken: string;
    timeoutMs?: number;
    intervalMs?: number;
  }): Promise<boolean> => {
    const timeoutMs = Number(args.timeoutMs || 60_000);
    const intervalMs = Number(args.intervalMs || 2_000);
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      const res = await fetch(`/api/orders/${args.orderId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
        },
      });

      const data = await res.json().catch(() => ({} as any));
      if (res.ok) {
        const ps = String((data as any)?.order?.paymentStatus || "").toUpperCase();
        if (ps === "PAID") return true;
      }

      await new Promise((r) => setTimeout(r, intervalMs));
    }

    return false;
  };

  const handleRazorpayPayment = async () => {
    try {
      if (!canAttemptCheckout) {
        toast.error("Please select a valid delivery address");
        return;
      }

      const accessToken = tokens?.accessToken;
      if (!accessToken) {
        toast.error("Please log in to continue");
        navigate("/login");
        return;
      }

      if (razorpayAttempt > 3) {
        toast.error("Max payment attempts exceeded");
        return;
      }

      setIsPlacingOrder(true);

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ paymentMethod: "razorpay" }),
      });

      const orderData = await orderRes.json().catch(() => ({} as any));
      if (!orderRes.ok) {
        const message = String((orderData as any)?.message || (orderData as any)?.error || "Failed to create order");
        throw new Error(message);
      }

      const dbOrderId = String((orderData as any)?.order?._id || "");
      if (!dbOrderId) {
        throw new Error("Failed to create order");
      }

      const intent = await createRazorpayOrder({
        orderId: dbOrderId,
        accessToken,
        idempotencyKey: `order_${dbOrderId}_attempt_${razorpayAttempt}`,
      });

      await openRazorpayCheckout({
        checkoutPayload: intent.checkoutPayload,
        prefill: {
          name: (user as any)?.name,
          email: (user as any)?.email,
          contact: (user as any)?.phone,
        },
        onSuccess: async () => {
          try {
            setIsRazorpayPolling(true);
            toast.success("Processing payment…");

            const ok = await pollOrderUntilPaid({
              orderId: dbOrderId,
              accessToken,
            });

            if (ok) {
              await clearCartCompletely();
              toast.success("Payment confirmed");
              navigate(`/orders/${dbOrderId}`);
            } else {
              toast.error("Payment processing. If amount is debited it will be confirmed shortly.");
              navigate("/orders");
            }
          } finally {
            setIsRazorpayPolling(false);
          }
        },
        onDismiss: () => {
          setRazorpayAttempt((n) => n + 1);
          toast.error("Payment cancelled or failed");
        },
        onFailure: () => {
          setRazorpayAttempt((n) => n + 1);
        },
      });
    } catch (error: any) {
      console.error("Razorpay payment error:", error);
      toast.error(error.message || "Failed to process payment", { duration: 5000 });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const upiVpaRegex = /^[\w.-]{2,}@[\w.-]{2,}$/;

  // Removed minimum order requirement - delivery charges will apply for all orders

  // Get default address using RTK Query (same as navbar and Layout)
  const userAddress = React.useMemo(() => {
    // Get addresses and defaultAddressId from RTK Query cache
    const addresses = addressesData?.addresses || [];
    const defaultAddressId = addressesData?.defaultAddressId || null;

    // Find the default address using defaultAddressId
    if (defaultAddressId && addresses.length > 0) {
      const defaultAddr = addresses.find((addr: any) => 
        (addr._id === defaultAddressId || addr.id === defaultAddressId)
      );
      if (defaultAddr) {
        return defaultAddr;
      }
    }

    // NO FALLBACK: Only use default address - strict rule
    // If no default address exists, return null to trigger requiresAddress state
    return null;
  }, [addressesData]);

  // Calculate delivery fee using the same logic as CartPage
  const calculatedDeliveryFeeDetails = calculateDeliveryFee(
    userAddress || undefined,
    cart.total
  );

  // Use calculated delivery fee details for price calculation (same as CartPage)
  const priceBreakdown = calculatePriceBreakdown(
    cart.items,
    calculatedDeliveryFeeDetails
  );

  const requiresAddress = calculatedDeliveryFeeDetails.requiresAddress;

  const hasValidCoordinates =
    !!userAddress &&
    typeof (userAddress as any).lat === "number" &&
    typeof (userAddress as any).lng === "number" &&
    (userAddress as any).lat !== 0 &&
    (userAddress as any).lng !== 0 &&
    !isNaN((userAddress as any).lat) &&
    !isNaN((userAddress as any).lng);

  const canAttemptCheckout =
    !!userAddress &&
    !requiresAddress &&
    !!(userAddress as any).pincode &&
    !!String((userAddress as any).city || "").trim() &&
    !!String((userAddress as any).state || "").trim() &&
    !!String(((userAddress as any).addressLine || (userAddress as any).address) || "").trim() &&
    !!String((userAddress as any).name || "").trim() &&
    !!String((userAddress as any).phone || "").trim() &&
    hasValidCoordinates &&
    isPincodeServiceable === true;

  React.useEffect(() => {
    let cancelled = false;
    const pincode = String((userAddress as any)?.pincode || "");

    if (!/^\d{6}$/.test(pincode)) {
      setIsPincodeServiceable(null);
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const res = await fetch(`/api/pincode/check/${pincode}`);
        const data = await res.json().catch(() => ({}));
        const deliverable = !!(data as any)?.deliverable;
        if (!cancelled) {
          setIsPincodeServiceable(deliverable);
        }
      } catch {
        if (!cancelled) {
          setIsPincodeServiceable(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [(userAddress as any)?.pincode]);

  const checkPincodeDeliverable = async (pincode: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/pincode/check/${pincode}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return false;
      return !!(data as any)?.deliverable;
    } catch {
      return false;
    }
  };

  const handleCODOrder = async () => {
    try {
      // Validate address before attempting order
      if (!canAttemptCheckout) {
        if (!hasValidCoordinates) {
          toast.error(
            "Address coordinates are missing. Please update your delivery address with complete location details.",
            { duration: 5000 }
          );
        } else {
          toast.error("Please select a valid delivery address");
        }
        return;
      }

      // Additional explicit coordinate check before API call
      if (!hasValidCoordinates) {
        toast.error(
          "Your delivery address is missing GPS coordinates. Please delete and recreate your address with complete details.",
          { duration: 6000 }
        );
        return;
      }

      const isDeliverable = await checkPincodeDeliverable(String((userAddress as any).pincode));
      if (!isDeliverable) {
        toast.error("Pincode not serviceable");
        return;
      }

      const accessToken = tokens?.accessToken;
      if (!accessToken) {
        toast.error("Please log in to continue");
        navigate("/login");
        return;
      }

      setIsPlacingOrder(true);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ paymentMethod: "cod" }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        // Backend may return error in 'message' or 'error' field
        const errorMessage = errorData.message || errorData.error || "Failed to place order";
        
        // Handle specific error cases with actionable messages
        if (errorMessage.includes("coordinates") || errorMessage.includes("Address coordinates")) {
          throw new Error(
            "Your delivery address is missing location coordinates. Please update your address with complete details (street name, landmark, area)."
          );
        }
        
        throw new Error(errorMessage);
      }

      await clearCartCompletely();
      toast.success("Order placed with Cash on Delivery");

      dispatch(api.util.invalidateTags(["Notification", "NotificationUnreadCount"]));
      navigate("/orders");
    } catch (error: any) {
      console.error("COD order error:", error);
      toast.error(error.message || "Failed to place order", { duration: 5000 });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleCreateUpiOrder = async () => {
    try {
      // Validate address before attempting order
      if (!canAttemptCheckout) {
        if (!hasValidCoordinates) {
          toast.error(
            "Address coordinates are missing. Please update your delivery address with complete location details.",
            { duration: 5000 }
          );
        } else {
          toast.error("Please select a valid delivery address");
        }
        return;
      }

      // Additional explicit coordinate check before API call
      if (!hasValidCoordinates) {
        toast.error(
          "Your delivery address is missing GPS coordinates. Please delete and recreate your address with complete details.",
          { duration: 6000 }
        );
        return;
      }

      const isDeliverable = await checkPincodeDeliverable(String((userAddress as any).pincode));
      if (!isDeliverable) {
        toast.error("Pincode not serviceable");
        return;
      }

      const accessToken = tokens?.accessToken;
      if (!accessToken) {
        toast.error("Please log in to continue");
        navigate("/login");
        return;
      }

      const vpa = upiVpa.trim();
      if (!upiVpaRegex.test(vpa)) {
        toast.error("Please enter a valid UPI ID");
        return;
      }

      setIsPlacingOrder(true);
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ paymentMethod: "upi", upiVpa: vpa }),
      });

      const data = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        const errorMessage = (data as any)?.message || (data as any)?.error || "Failed to create UPI order";
        
        // Handle specific error cases with actionable messages
        if (errorMessage.includes("coordinates") || errorMessage.includes("Address coordinates")) {
          throw new Error(
            "Your delivery address is missing location coordinates. Please update your address with complete details (street name, landmark, area)."
          );
        }
        
        throw new Error(errorMessage);
      }

      const orderId = String((data as any)?.order?._id || "");
      if (!orderId) {
        throw new Error("Failed to create UPI order");
      }

      setCreatedUpiOrderId(orderId);
      toast.success("UPI request sent. Approve it in your UPI app");
      dispatch(api.util.invalidateTags(["Notification", "NotificationUnreadCount"]));
    } catch (error: any) {
      console.error("UPI order error:", error);
      toast.error(error.message || "Failed to place order", { duration: 5000 });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleConfirmUpiPayment = async () => {
    try {
      if (!createdUpiOrderId) return;

      const accessToken = tokens?.accessToken;
      if (!accessToken) {
        toast.error("Please log in to continue");
        navigate("/login");
        return;
      }

      setIsConfirmingPayment(true);
      const response = await fetch(`/api/orders/${createdUpiOrderId}/payment-status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        throw new Error((data as any)?.message || (data as any)?.error || "Failed to confirm payment");
      }

      await clearCartCompletely();
      toast.success("Payment confirmed");
      navigate(`/orders/${createdUpiOrderId}`);
    } catch (error: any) {
      console.error("UPI confirm error:", error);
      toast.error(error.message || "Failed to confirm payment");
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  if (cart.items.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-gray-50 py-8 px-4"
      >
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🛒</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Your cart is empty
            </h3>
            <p className="text-gray-600 mb-6">Add some products to checkout</p>
            <Link
              to="/products"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gray-50"
    >
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Secure checkout
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Delivery & Payment */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-orange-500" />
                  Delivery Address
                </h2>
              </div>

              <div className="py-4">
                {/* Warning banner for invalid coordinates */}
                {userAddress && !hasValidCoordinates && (
                  <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <div className="text-2xl flex-shrink-0">⚠️</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-red-900 mb-2">
                          Address Missing Location Coordinates
                        </h4>
                        <p className="text-sm text-red-800 mb-2">
                          Your delivery address does not have valid GPS coordinates. Orders cannot be placed without location coordinates.
                        </p>
                        <p className="text-sm text-red-700 font-medium">
                          📍 <strong>How to fix:</strong> Delete this address and create a new one with complete details including street name, landmark, and area. This allows the system to accurately determine your location.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <MapPin className="h-5 w-5 text-orange-500 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 mb-2">
                        {userAddress.label || "Delivery Address"}
                      </h4>
                      <div className="text-sm text-gray-700 space-y-1">
                        <p className="font-medium">
                          {userAddress.addressLine ||
                            `${userAddress.city}, ${userAddress.state}`}
                        </p>
                        <p>
                          {userAddress.city}, {userAddress.state} -
                          {userAddress.pincode}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={() => setShowLocationModal(true)}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
                  >
                    Change Address
                  </button>
                  <button className="text-orange-500 hover:text-orange-600 text-sm font-medium">
                    Add delivery instructions
                  </button>
                </div>
              </div>
            </div>

            {/* Payment Method Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Payment method
              </h2>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="payment"
                      value="upi"
                      data-testid="payment-method-upi"
                      checked={selectedPaymentMethod === "upi"}
                      onChange={() => setSelectedPaymentMethod("upi")}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500"
                    />
                    <div className="text-2xl">📱</div>
                    <div>
                      <div className="font-medium text-gray-900">UPI</div>
                      <div className="text-sm text-gray-500">Pay using your UPI ID</div>
                    </div>
                  </div>
                </div>

                {selectedPaymentMethod === "upi" && (
                  <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
                    <input
                      type="text"
                      data-testid="upi-id-input"
                      placeholder="example@bank"
                      value={upiVpa}
                      onChange={(e) => setUpiVpa(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-600 mt-2">You will receive a payment request in your UPI app</p>

                    {createdUpiOrderId ? (
                      <button
                        onClick={handleConfirmUpiPayment}
                        disabled={isConfirmingPayment}
                        data-testid="upi-confirm-button"
                        className={`mt-4 w-full py-3 px-4 font-medium rounded-lg transition-colors ${
                          isConfirmingPayment
                            ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                            : "bg-amber-500 text-white hover:bg-amber-600"
                        }`}
                      >
                        {isConfirmingPayment ? "Confirming..." : "I've Paid"}
                      </button>
                    ) : (
                      <button
                        onClick={handleCreateUpiOrder}
                        disabled={!canAttemptCheckout || isPlacingOrder}
                        data-testid="upi-create-order-button"
                        className={`mt-4 w-full py-3 px-4 font-medium rounded-lg transition-colors ${
                          !canAttemptCheckout || isPlacingOrder
                            ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                            : "bg-amber-500 text-white hover:bg-amber-600"
                        }`}
                      >
                        {isPlacingOrder ? "Creating order..." : `Pay ₹${priceBreakdown.total}`}
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="payment"
                      value="razorpay"
                      checked={selectedPaymentMethod === "razorpay"}
                      onChange={() => setSelectedPaymentMethod("razorpay")}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500"
                    />
                    <div className="text-2xl">💳</div>
                    <div>
                      <div className="font-medium text-gray-900">Card / UPI (Razorpay)</div>
                      <div className="text-sm text-gray-500">Secure checkout via Razorpay</div>
                    </div>
                  </div>
                </div>

                {selectedPaymentMethod === "razorpay" && (
                  <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                    <RazorpayCheckout
                      disabled={!canAttemptCheckout || isPlacingOrder || isRazorpayPolling}
                      label={isRazorpayPolling ? "Processing…" : `Pay ₹${priceBreakdown.total}`}
                      onClick={handleRazorpayPayment}
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      Do not close this page until payment is confirmed.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      data-testid="payment-method-cod"
                      checked={selectedPaymentMethod === "cod"}
                      onChange={() => setSelectedPaymentMethod("cod")}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500"
                    />
                    <div className="text-2xl">💰</div>
                    <div>
                      <div className="font-medium text-gray-900">Cash on Delivery</div>
                      <div className="text-sm text-gray-500">Pay when the order arrives</div>
                    </div>
                  </div>
                </div>

                {selectedPaymentMethod === "cod" && (
                  <button
                    onClick={handleCODOrder}
                    disabled={!canAttemptCheckout || isPlacingOrder}
                    data-testid="cod-place-order-button"
                    className={`w-full py-3 px-4 font-medium rounded-lg transition-colors ${
                      !canAttemptCheckout || isPlacingOrder
                        ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                        : "bg-amber-500 text-white hover:bg-amber-600"
                    }`}
                  >
                    {isPlacingOrder ? "Placing order..." : "Place Order"}
                  </button>
                )}
              </div>

              {/* Delivery Fee Debug Section */}
              {!requiresAddress && calculatedDeliveryFeeDetails.distance !== null && (
              <div className="mt-6 p-4 bg-yellow-50 border-2 border-yellow-300 rounded-lg">
                <h3 className="text-sm font-bold text-yellow-900 mb-3 flex items-center">
                  🐛 Delivery Fee Debug Information
                </h3>
                <div className="space-y-2 text-xs text-gray-800">
                  <div className="bg-white p-2 rounded">
                    <p className="font-semibold text-blue-700">📍 Admin Warehouse:</p>
                    <p className="ml-4">Location: Tiruvuru (Boya Bazar), Andhra Pradesh</p>
                    <p className="ml-4">Coordinates: 17.0956, 80.6089</p>
                    <p className="ml-4">Pincode: 521235</p>
                  </div>
                  
                  <div className="bg-white p-2 rounded">
                    <p className="font-semibold text-green-700">📍 Your Default Address:</p>
                    <p className="ml-4">Location: {userAddress?.city}, {userAddress?.state}</p>
                    <p className="ml-4">Coordinates: {userAddress?.lat || 'N/A'}, {userAddress?.lng || 'N/A'}</p>
                    <p className="ml-4">Pincode: {userAddress?.pincode}</p>
                  </div>
                  
                  <div className="bg-white p-2 rounded">
                    <p className="font-semibold text-purple-700">📏 Distance Calculation:</p>
                    <p className="ml-4">Distance: {calculatedDeliveryFeeDetails.distance.toFixed(2)} km</p>
                    <p className="ml-4">Method: Haversine Formula (straight-line)</p>
                  </div>
                  
                  <div className="bg-white p-2 rounded">
                    <p className="font-semibold text-orange-700">💰 Pricing Breakdown:</p>
                    <p className="ml-4">Cart Subtotal: ₹{cart.total.toFixed(2)}</p>
                    <p className="ml-4">
                      {(!userAddress?.lat || !userAddress?.lng || userAddress.lat === 0 || userAddress.lng === 0) ? (
                        <span className="text-red-600 font-bold">❌ CANNOT CALCULATE (Invalid coordinates)</span>
                      ) : calculatedDeliveryFeeDetails.isFreeDelivery ? (
                        <span className="text-green-600 font-bold">✅ FREE DELIVERY (Cart ≥ ₹2000)</span>
                      ) : calculatedDeliveryFeeDetails.distance <= 2 ? (
                        <>Pricing Tier: Up to 2 km → ₹25</>
                      ) : calculatedDeliveryFeeDetails.distance <= 6 ? (
                        <>Pricing Tier: 2-6 km → ₹{Math.round(35 + ((calculatedDeliveryFeeDetails.distance - 2) / 4) * 25)} (progressive)</>
                      ) : (
                        <>Pricing Tier: Beyond 6 km → ₹60 + ({(calculatedDeliveryFeeDetails.distance - 6).toFixed(2)} km × ₹8) = ₹{Math.round(60 + (calculatedDeliveryFeeDetails.distance - 6) * 8)}</>
                      )}
                    </p>
                    <p className="ml-4 font-bold text-red-600 text-base mt-1">
                      Final Delivery Fee: ₹{calculatedDeliveryFeeDetails.finalFee}
                    </p>
                  </div>
                  
                  <div className="bg-red-50 p-2 rounded border border-red-200">
                    <p className="font-semibold text-red-700">⚠️ Issue Detection:</p>
                    {!userAddress?.lat || !userAddress?.lng || calculatedDeliveryFeeDetails.distance === 0 ? (
                      <div className="ml-4 text-red-600 space-y-1">
                        <p><strong>❌ CRITICAL ERROR:</strong> Your address has invalid GPS coordinates!</p>
                        <p className="text-xs">• Coordinates: {userAddress?.lat || 'N/A'}, {userAddress?.lng || 'N/A'}</p>
                        <p className="text-xs">• This causes incorrect delivery fee calculation</p>
                        <p className="text-xs font-bold">• Charging penalty fee of ₹500</p>
                        <p className="text-xs bg-yellow-100 p-1 rounded mt-1">
                          🔧 <strong>Fix:</strong> Delete this address and create a new one with complete details (street name, landmark, area) so the system can locate it accurately
                        </p>
                      </div>
                    ) : userAddress?.pincode === "521235" && calculatedDeliveryFeeDetails.finalFee > 100 ? (
                      <p className="ml-4 text-red-600">
                        <strong>⚠️ WARNING:</strong> Your address pincode matches warehouse (521235) but distance is {calculatedDeliveryFeeDetails.distance.toFixed(2)} km. 
                        This suggests incorrect coordinates are stored for your address!
                      </p>
                    ) : (
                      <p className="ml-4 text-green-600">✓ Calculation looks normal</p>
                    )}
                  </div>
                </div>
              </div>
              )}

              {/* Payment Security Info */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Shield className="h-5 w-5 text-green-600" />
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">
                      Secure Payment
                    </h4>
                    <p className="text-xs text-gray-600">
                      Your payment is secured with 256-bit SSL encryption
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Fee Display */}
            {userAddress && userAddress.pincode && !requiresAddress && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <DeliveryFeeDisplay
                  pincode={userAddress.pincode}
                  cartValue={cart.total}
                />
              </div>
            )}

            {/* Review Items Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Review items and shipping
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Need help? Check our{" "}
                <span className="text-orange-500 cursor-pointer">
                  help pages
                </span>{" "}
                or{" "}
                <span className="text-orange-500 cursor-pointer">
                  contact us 24x7
                </span>
                .
              </p>
              <p className="text-sm text-gray-600 leading-relaxed">
                When your order is placed, we'll send you an e-mail message acknowledging receipt of your order.
                If you choose UPI, you'll receive a payment request in your UPI app. If you choose Cash on Delivery,
                you can pay when you receive your item.
              </p>
              <div className="mt-4 space-x-4">
                <span className="text-orange-500 cursor-pointer text-sm">
                  See CS Store's Return Policy.
                </span>
                <span className="text-orange-500 cursor-pointer text-sm">
                  Back to cart
                </span>
              </div>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" data-testid="order-summary">
                {/* Order Summary */}
                <div className="mt-8 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Price ({priceBreakdown.itemCount} items):
                    </span>
                    <span className="font-medium">
                      {formatPrice(priceBreakdown.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Discount:</span>
                    <span className="font-medium text-green-600">
                      - {formatPrice(priceBreakdown.discount)}
                    </span>
                  </div>
                  {!requiresAddress ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Delivery:</span>
                      <span className="font-medium">
                        {formatDeliveryFee(calculatedDeliveryFeeDetails)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-amber-700">
                      Add delivery address to calculate delivery fee
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Order Total:</span>
                      <span>{formatPrice(priceBreakdown.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Security Badge */}
                <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-gray-500">
                  <Shield className="h-4 w-4" />
                  <span>Secured by CS Store</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Choose Location Modal */}
        <ChooseLocation
          isOpen={showLocationModal}
          onClose={() => setShowLocationModal(false)}
          onAddressSelect={async (addressId: string) => {
            try {
              await setDefaultAddressMutation(addressId).unwrap();
              await refetchAddresses();
              toast.success("Default address updated");
              setShowLocationModal(false);
            } catch (error) {
              console.error("Failed to update default address:", error);
              toast.error("Failed to update address");
            }
          }}
          addresses={addressesData?.addresses || []}
          defaultAddressId={addressesData?.defaultAddressId || null}
        />
      </div>
    </motion.div>
  );
};

export default CheckoutPage;
