import React, { useState } from "react";
import { motion } from "framer-motion";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { clearCart } from "../store/slices/cartSlice";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import RazorpayCheckout from "../components/RazorpayCheckout";
import RealtimeOTPVerification from "../components/RealtimeOTPVerification";
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
import {
  validateCard,
  formatCardNumber,
  detectCardType,
  type CardValidationResult,
} from "../utils/cardValidation";
import toast from "react-hot-toast";
import { CreditCard, MapPin, Shield } from "lucide-react";
import { openRazorpayCheckout, verifyPayment } from "../utils/razorpayHandler";
import { useClearCartMutation, useGetAddressesQuery, useSetDefaultAddressMutation } from "../store/api";

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

  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState("razorpay");
  const [showCardDetails, setShowCardDetails] = useState(false);
  const [showUPIDetails, setShowUPIDetails] = useState(false);
  const [showNetBankingDetails, setShowNetBankingDetails] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [otp, setOtp] = useState("");
  const [isVerifyingOTP, setIsVerifyingOTP] = useState(false);
  const [order, setOrder] = useState<any>(null);

  const [cardFormData, setCardFormData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardHolderName: "",
    saveCard: false,
  });
  const [cardValidation, setCardValidation] = useState<CardValidationResult>({
    isValid: false,
    cardType: "Unknown",
    errors: [],
  });
  const [detectedCardType, setDetectedCardType] = useState<any>(null);
  const [fieldErrors, setFieldErrors] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardHolderName: "",
  });

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

  // Real-time card validation
  const validateCardFields = () => {
    const validation = validateCard(
      cardFormData.cardNumber,
      cardFormData.expiryDate,
      cardFormData.cvv,
      cardFormData.cardHolderName
    );

    setCardValidation(validation);

    // Set individual field errors
    const errors = {
      cardNumber: "",
      expiryDate: "",
      cvv: "",
      cardHolderName: "",
    };

    validation.errors.forEach((error) => {
      if (error.toLowerCase().includes("card number"))
        errors.cardNumber = error;
      else if (error.toLowerCase().includes("month/year"))
        errors.expiryDate = error;
      else if (error.toLowerCase().includes("cvv")) errors.cvv = error;
      else if (error.toLowerCase().includes("card holder"))
        errors.cardHolderName = error;
    });

    setFieldErrors(errors);
  };

  // Card number formatting function
  const formatCardNumberInput = (value: string) => {
    return formatCardNumber(value);
  };

  // Expiry date formatting function
  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  // Handle card form input changes
  const handleCardFormChange = (field: string, value: string | boolean) => {
    setCardFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Validate card holder name changes
    if (field === "cardHolderName") {
      setTimeout(validateCardFields, 100);
    }
  };

  // Use the validation utility's detectCardType function
  // (The detectCardType from cardValidation utility is already imported)

  // Handle card number input
  const handleCardNumberChange = (value: string) => {
    const formatted = formatCardNumberInput(value);
    handleCardFormChange("cardNumber", formatted);

    // Detect card type
    const cardType = detectCardType(formatted);
    setDetectedCardType(cardType);

    // Validate after a short delay
    setTimeout(validateCardFields, 100);
  };

  // Handle expiry date input
  const handleExpiryDateChange = (value: string) => {
    const formatted = formatExpiryDate(value);
    handleCardFormChange("expiryDate", formatted);

    // Validate after a short delay
    setTimeout(validateCardFields, 100);
  };

  // Handle CVV input (only numbers, max 4 digits)
  const handleCVVChange = (value: string) => {
    const v = value.replace(/[^0-9]/gi, "").substring(0, 4);
    handleCardFormChange("cvv", v);

    // Validate after a short delay
    setTimeout(validateCardFields, 100);
  };

  // Handle card payment submission
  const handleCardPayment = async () => {
    try {
      // Validate card form using our validation utility
      validateCardFields();

      if (!cardValidation.isValid) {
        toast.error("Please fix the card details before proceeding");
        return;
      }

      // Additional basic validation
      if (
        !cardFormData.cardNumber ||
        !cardFormData.expiryDate ||
        !cardFormData.cvv ||
        !cardFormData.cardHolderName
      ) {
        toast.error("Please fill in all card details");
        return;
      }

      // Validate card number (basic validation)
      const cardNumber = cardFormData.cardNumber.replace(/\s/g, "");
      if (cardNumber.length < 13 || cardNumber.length > 19) {
        toast.error("Please enter a valid card number");
        return;
      }

      // Validate expiry date
      if (cardFormData.expiryDate.length !== 5) {
        toast.error("Please enter a valid expiry date (MM/YY)");
        return;
      }

      // Validate CVV
      if (cardFormData.cvv.length < 3) {
        toast.error("Please enter a valid CVV");
        return;
      }

      // Create order for card payment
      const orderData = {
        items: cart.items.map((item) => ({
          // Use frontend cart id as product reference in this temporary order
          product: (item as any).id || (item as any).productId,
          quantity: item.quantity,
          price: item.price,
        })),
        address: userAddress,
        totalAmount: priceBreakdown.total,
        paymentMethod: "card",
        paymentStatus: "pending",
      };

      // Create a temporary order object for OTP verification
      const tempOrder = {
        _id: `temp_${Date.now()}`, // Temporary ID
        ...orderData,
      };

      setOrder(tempOrder);

      // Generate OTP and show input box
      await generateOTP();
      setShowOTPInput(true);
    } catch (error) {
      console.error("Card payment error:", error);
      toast.error("Payment failed. Please try again.");
    }
  };

  // Generate OTP
  const generateOTP = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL || "http://localhost:5001"
        }/api/otp/payment/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId: order?._id || `temp_${Date.now()}`,
            cardNumber: cardFormData.cardNumber.replace(/\s/g, ""),
            cardHolderName: cardFormData.cardHolderName,
            expiryDate: cardFormData.expiryDate,
            cvv: cardFormData.cvv,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("OTP sent to your registered mobile number");
      } else {
        toast.error(data.message || "Failed to send OTP");
      }
    } catch (error) {
      console.error("OTP generation error:", error);
      toast.error("Failed to send OTP. Please try again.");
    }
  };

  // Verify OTP
  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter a valid 6-digit OTP");
      return;
    }

    setIsVerifyingOTP(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${
          import.meta.env.VITE_API_URL || "http://localhost:5001"
        }/api/otp/payment/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId: order?._id,
            otp: otp,
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success("Payment verified successfully!");

        // Reset form
        setCardFormData({
          cardNumber: "",
          expiryDate: "",
          cvv: "",
          cardHolderName: "",
          saveCard: false,
        });
        setShowCardForm(false);
        setShowOTPInput(false);
        setOtp("");

        // Clear cart and redirect to success page
        await clearCartCompletely();
        navigate("/order-success");
      } else {
        toast.error(data.message || "Invalid OTP. Please try again.");
      }
    } catch (error) {
      console.error("OTP verification error:", error);
      toast.error("OTP verification failed. Please try again.");
    } finally {
      setIsVerifyingOTP(false);
    }
  };

  // Handle OTP verification success (for modal compatibility)
  const handleOTPSuccess = async (_paymentId: string) => {
    toast.success("Payment verified successfully!");

    // Reset form
    setCardFormData({
      cardNumber: "",
      expiryDate: "",
      cvv: "",
      cardHolderName: "",
      saveCard: false,
    });
    setShowCardForm(false);
    setShowOTPModal(false);
    setShowOTPInput(false);
    setOtp("");

    // Clear cart and redirect to success page
    await clearCartCompletely();
    navigate("/order-success");
  };

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

  const handlePaymentSuccess = async (order: any) => {
    await clearCartCompletely();
    toast.success("Order placed successfully!");
    navigate(`/orders/${order._id}`);
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
  };

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
      if (!canAttemptCheckout) {
        toast.error("Please select a valid delivery address");
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

      const items = cart.items.map((item: any) => ({
        productId: item.id || item.productId || item._id,
        name: item.name,
        price: item.price,
        qty: item.quantity,
      }));

      // Ensure address has all required fields
      const addressToUse = userAddress;
      const formattedAddress = {
        label: (addressToUse as any).label,
        pincode: (addressToUse as any).pincode,
        city: (addressToUse as any).city,
        state: (addressToUse as any).state,
        postal_district: (addressToUse as any).postal_district,
        admin_district: (addressToUse as any).admin_district,
        addressLine: (addressToUse as any).addressLine || (addressToUse as any).address,
        phone: (addressToUse as any).phone,
        name: (addressToUse as any).name,
        lat: (addressToUse as any).lat,
        lng: (addressToUse as any).lng,
      };

      const response = await fetch("/api/orders/cod", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          items,
          address: formattedAddress,
          totalAmount: priceBreakdown.total,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to place order");
      }

      await clearCartCompletely();
      toast.success("Order placed with Cash on Delivery");
      navigate("/orders");
    } catch (error: any) {
      console.error("COD order error:", error);
      toast.error(error.message || "Failed to place order");
    }
  };

  // Handle Razorpay payment (Card, UPI, Net Banking)
  const handleRazorpayPayment = async (paymentMethod: "card" | "upi" | "netbanking") => {
    try {
      if (!canAttemptCheckout) {
        toast.error("Please select a valid delivery address");
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

      const items = cart.items.map((item: any) => ({
        productId: item.id || item.productId || item._id,
        name: item.name,
        price: item.price,
        qty: item.quantity,
      }));

      // Ensure address has all required fields
      const addressToUse = userAddress;
      const formattedAddress = {
        label: (addressToUse as any).label,
        pincode: (addressToUse as any).pincode,
        city: (addressToUse as any).city,
        state: (addressToUse as any).state,
        postal_district: (addressToUse as any).postal_district,
        admin_district: (addressToUse as any).admin_district,
        addressLine: (addressToUse as any).addressLine || (addressToUse as any).address,
        phone: (addressToUse as any).phone,
        name: (addressToUse as any).name,
        lat: (addressToUse as any).lat,
        lng: (addressToUse as any).lng,
      };

      // Create Razorpay order
      const createOrderResponse = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/razorpay/create-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            amount: priceBreakdown.total,
            items,
            address: formattedAddress,
            paymentMethod,
          }),
        }
      );

      if (!createOrderResponse.ok) {
        const errorData = await createOrderResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create order");
      }

      const orderData = await createOrderResponse.json();

      // Open Razorpay checkout
      await openRazorpayCheckout(
        paymentMethod,
        {
          orderId: orderData.orderId,
          amount: orderData.amount,
          currency: orderData.currency,
          key: orderData.key,
        },
        {
          name: user?.name,
          email: user?.email,
          contact: user?.phone,
        },
        async (response: any) => {
          // Payment successful, verify with backend
          const verifyResult = await verifyPayment(response, accessToken);

          if (verifyResult.success) {
            await clearCartCompletely();
            toast.success("Payment successful!");
            navigate("/order-success");
          } else {
            toast.error(verifyResult.error || "Payment verification failed");
          }
        },
        () => {
          // Payment failed or cancelled
          toast.error("Payment cancelled or failed");
        }
      );
    } catch (error: any) {
      console.error("Razorpay payment error:", error);
      toast.error(error.message || "Failed to process payment");
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

              {/* Payment Methods */}
              <div className="space-y-4">
                {/* Credit or Debit Card Option */}
                <div className="border border-gray-200 rounded-lg">
                  <div
                    className="flex items-center justify-between p-4 hover:border-orange-300 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedPaymentMethod("razorpay");
                      setShowCardDetails(!showCardDetails);
                      setShowUPIDetails(false);
                      setShowNetBankingDetails(false);
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="payment"
                        value="razorpay"
                        checked={selectedPaymentMethod === "razorpay"}
                        onChange={(e) =>
                          setSelectedPaymentMethod(e.target.value)
                        }
                        className="h-4 w-4 text-orange-500 focus:ring-orange-500"
                      />
                      <CreditCard className="h-5 w-5 text-gray-600" />
                      <div>
                        <div className="font-medium text-gray-900">
                          Credit or debit card
                        </div>
                        <div className="text-sm text-gray-500">
                          Visa, Mastercard, American Express
                        </div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        Visa
                      </span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        MC
                      </span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        AMEX
                      </span>
                    </div>
                  </div>

                  {/* Expandable Card Details */}
                  {showCardDetails && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <img
                                src="https://img.icons8.com/color/24/000000/visa.png"
                                alt="Visa"
                                className="h-6"
                              />
                              <img
                                src="https://img.icons8.com/color/24/000000/mastercard.png"
                                alt="Mastercard"
                                className="h-6"
                              />
                              <img
                                src="https://img.icons8.com/color/24/000000/amex.png"
                                alt="American Express"
                                className="h-6"
                              />
                              <img
                                src="https://img.icons8.com/color/24/000000/diners-club.png"
                                alt="Diners Club"
                                className="h-6"
                              />
                              <img
                                src="https://img.icons8.com/color/24/000000/maestro.png"
                                alt="Maestro"
                                className="h-6"
                              />
                              <img
                                src="https://img.icons8.com/color/24/000000/rupay.png"
                                alt="RuPay"
                                className="h-6"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowCardForm(!showCardForm)}
                          className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <CreditCard className="h-5 w-5 text-blue-600" />
                          <span className="font-medium text-gray-900">
                            Add a new credit or debit card
                          </span>
                          <span className="text-blue-600 text-xl">+</span>
                        </button>
                        <p className="text-xs text-gray-600 mt-2 text-center">
                          CS Store accepts all major credit & debit cards
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Card Input Form */}
                  {showCardForm && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
                        {/* Note */}
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm text-blue-800">
                            <strong>Note:</strong> Please ensure your card can
                            be used for online transactions. {""}
                            <span className="text-blue-600 cursor-pointer underline">
                              Learn More
                            </span>
                          </p>
                        </div>

                        {/* Card Form */}
                        <div className="space-y-4">
                          {/* Card Number */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Card Number
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="XXXX XXXX XXXX XXXX"
                                value={cardFormData.cardNumber}
                                onChange={(e) =>
                                  handleCardNumberChange(e.target.value)
                                }
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                  fieldErrors.cardNumber
                                    ? "border-red-500 bg-red-50"
                                    : cardFormData.cardNumber &&
                                      !fieldErrors.cardNumber
                                    ? "border-green-500 bg-green-50"
                                    : "border-gray-300"
                                }`}
                                maxLength={19}
                              />
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <div className="flex space-x-1">
                                  {detectedCardType && (
                                    <span className="text-blue-600 font-bold text-lg">
                                      {detectedCardType.icon}
                                    </span>
                                  )}
                                  {!detectedCardType &&
                                    cardFormData.cardNumber && (
                                      <div className="flex space-x-1">
                                        <img
                                          src="https://img.icons8.com/color/16/000000/visa.png"
                                          alt="Visa"
                                          className="h-4 opacity-30"
                                        />
                                        <img
                                          src="https://img.icons8.com/color/16/000000/mastercard.png"
                                          alt="Mastercard"
                                          className="h-4 opacity-30"
                                        />
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                            {fieldErrors.cardNumber && (
                              <p className="mt-1 text-sm text-red-600">
                                {fieldErrors.cardNumber}
                              </p>
                            )}
                          </div>

                          {/* Card Holder Name */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Card Holder Name
                            </label>
                            <input
                              type="text"
                              placeholder="Enter card holder name"
                              value={cardFormData.cardHolderName}
                              onChange={(e) =>
                                handleCardFormChange(
                                  "cardHolderName",
                                  e.target.value
                                )
                              }
                              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                fieldErrors.cardHolderName
                                  ? "border-red-500 bg-red-50"
                                  : cardFormData.cardHolderName &&
                                    !fieldErrors.cardHolderName
                                  ? "border-green-500 bg-green-50"
                                  : "border-gray-300"
                              }`}
                            />
                            {fieldErrors.cardHolderName && (
                              <p className="mt-1 text-sm text-red-600">
                                {fieldErrors.cardHolderName}
                              </p>
                            )}
                          </div>

                          {/* Expiry Date and CVV */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Valid Thru
                              </label>
                              <input
                                type="text"
                                placeholder="MM/YY"
                                value={cardFormData.expiryDate}
                                onChange={(e) =>
                                  handleExpiryDateChange(e.target.value)
                                }
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                  fieldErrors.expiryDate
                                    ? "border-red-500 bg-red-50"
                                    : cardFormData.expiryDate &&
                                      !fieldErrors.expiryDate
                                    ? "border-green-500 bg-green-50"
                                    : "border-gray-300"
                                }`}
                                maxLength={5}
                              />
                              {fieldErrors.expiryDate && (
                                <p className="mt-1 text-sm text-red-600">
                                  {fieldErrors.expiryDate}
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                CVV
                                <span
                                  className="ml-1 text-gray-400 cursor-help"
                                  title="3 or 4 digit security code"
                                >
                                  ?
                                </span>
                              </label>
                              <input
                                type="text"
                                placeholder="CVV"
                                value={cardFormData.cvv}
                                onChange={(e) =>
                                  handleCVVChange(e.target.value)
                                }
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                  fieldErrors.cvv
                                    ? "border-red-500 bg-red-50"
                                    : cardFormData.cvv && !fieldErrors.cvv
                                    ? "border-green-500 bg-green-50"
                                    : "border-gray-300"
                                }`}
                                maxLength={4}
                              />
                              {fieldErrors.cvv && (
                                <p className="mt-1 text-sm text-red-600">
                                  {fieldErrors.cvv}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Save Card Checkbox */}
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              id="saveCard"
                              checked={cardFormData.saveCard}
                              onChange={(e) =>
                                handleCardFormChange(
                                  "saveCard",
                                  e.target.checked
                                )
                              }
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label
                              htmlFor="saveCard"
                              className="ml-2 text-sm text-gray-700"
                            >
                              Save this card for future payments
                            </label>
                          </div>

                          {/* OTP Input Box */}
                          {showOTPInput && (
                            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                              <div className="text-center mb-4">
                                <h3 className="text-base font-medium text-gray-800 mb-1">
                                  Enter OTP
                                </h3>
                                <p className="text-sm text-gray-600">
                                  OTP sent to your mobile number
                                </p>
                              </div>

                              <div className="flex items-center justify-center mb-4">
                                <input
                                  type="text"
                                  value={otp}
                                  onChange={(e) =>
                                    setOtp(
                                      e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 6)
                                    )
                                  }
                                  placeholder="000000"
                                  className="w-20 h-10 text-center text-lg font-medium border border-gray-300 rounded-md focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                                  maxLength={6}
                                />
                              </div>

                              <div className="flex space-x-2">
                                <button
                                  onClick={verifyOTP}
                                  disabled={isVerifyingOTP || otp.length !== 6}
                                  className="flex-1 py-2 px-4 bg-gray-800 text-white text-sm font-medium rounded-md hover:bg-gray-900 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                                >
                                  {isVerifyingOTP ? "Verifying..." : "Verify"}
                                </button>

                                <button
                                  onClick={generateOTP}
                                  className="px-4 py-2 text-gray-600 border border-gray-300 text-sm rounded-md hover:bg-gray-100 transition-colors"
                                >
                                  Resend
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Pay Button */}
                          <button
                            onClick={handleCardPayment}
                            disabled={showOTPInput || !cardValidation.isValid}
                            className={`w-full py-3 px-4 font-medium rounded-lg transition-colors ${
                              showOTPInput || !cardValidation.isValid
                                ? "bg-gray-400 text-gray-500 cursor-not-allowed"
                                : "bg-yellow-500 text-white hover:bg-yellow-600"
                            }`}
                          >
                            {showOTPInput
                              ? "OTP Sent - Check Above"
                              : !cardValidation.isValid
                              ? "Please fix card details"
                              : `Pay ₹${priceBreakdown.total}`}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* UPI Option */}
                <div className="border border-gray-200 rounded-lg">
                  <div
                    className="flex items-center justify-between p-4 hover:border-orange-300 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedPaymentMethod("upi");
                      setShowUPIDetails(!showUPIDetails);
                      setShowCardDetails(false);
                      setShowNetBankingDetails(false);
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="payment"
                        value="upi"
                        checked={selectedPaymentMethod === "upi"}
                        onChange={(e) =>
                          setSelectedPaymentMethod(e.target.value)
                        }
                        className="h-4 w-4 text-orange-500 focus:ring-orange-500"
                      />
                      <div className="text-2xl">📱</div>
                      <div>
                        <div className="font-medium text-gray-900">UPI</div>
                        <div className="text-sm text-gray-500">
                          Pay by any UPI app
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable UPI Details */}
                  {showUPIDetails && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-4 space-y-4">
                        {/* UPI Apps Icons */}
                        <div className="flex items-center justify-center space-x-3 p-4 bg-blue-50 rounded-lg">
                          <img
                            src="https://img.icons8.com/color/48/000000/google-pay.png"
                            alt="Google Pay"
                            className="h-8"
                          />
                          <img
                            src="https://img.icons8.com/color/48/000000/phonepe.png"
                            alt="PhonePe"
                            className="h-8"
                          />
                          <img
                            src="https://img.icons8.com/color/48/000000/paytm.png"
                            alt="Paytm"
                            className="h-8"
                          />
                          <img
                            src="https://img.icons8.com/color/48/000000/bhim.png"
                            alt="BHIM"
                            className="h-8"
                          />
                        </div>

                        {/* UPI Payment Info */}
                        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                          <h4 className="font-medium text-gray-900 mb-2">
                            Pay with any UPI app
                          </h4>
                          <ul className="text-sm text-gray-600 space-y-1">
                            <li>✓ Enter UPI ID or scan QR code</li>
                            <li>✓ Pay via Google Pay, PhonePe, Paytm, BHIM</li>
                            <li>✓ Instant payment confirmation</li>
                          </ul>
                          <p className="text-xs text-gray-500 mt-3">
                            Click "Use this payment method" below to proceed with UPI payment
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Net Banking Option */}
                <div className="border border-gray-200 rounded-lg">
                  <div
                    className="flex items-center justify-between p-4 hover:border-orange-300 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedPaymentMethod("netbanking");
                      setShowNetBankingDetails(!showNetBankingDetails);
                      setShowCardDetails(false);
                      setShowUPIDetails(false);
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="payment"
                        value="netbanking"
                        checked={selectedPaymentMethod === "netbanking"}
                        onChange={(e) =>
                          setSelectedPaymentMethod(e.target.value)
                        }
                        className="h-4 w-4 text-orange-500 focus:ring-orange-500"
                      />
                      <div className="text-2xl">🏦</div>
                      <div>
                        <div className="font-medium text-gray-900">
                          Net Banking
                        </div>
                        <div className="text-sm text-gray-500">
                          Choose an Option
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Net Banking Details */}
                  {showNetBankingDetails && (
                    <div className="px-4 pb-4 border-t border-gray-100">
                      <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <img
                                src="https://img.icons8.com/color/24/000000/sbi.png"
                                alt="SBI"
                                className="h-6"
                              />
                              <img
                                src="https://img.icons8.com/color/24/000000/hdfc.png"
                                alt="HDFC"
                                className="h-6"
                              />
                              <img
                                src="https://img.icons8.com/color/24/000000/icici.png"
                                alt="ICICI"
                                className="h-6"
                              />
                              <img
                                src="https://img.icons8.com/color/24/000000/axis-bank.png"
                                alt="Axis Bank"
                                className="h-6"
                              />
                            </div>
                          </div>
                        </div>
                        <button className="w-full flex items-center justify-center space-x-2 py-3 px-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                          <div className="text-2xl">🏦</div>
                          <span className="font-medium text-gray-900">
                            Choose Bank
                          </span>
                        </button>
                        <p className="text-xs text-gray-600 mt-2 text-center">
                          Pay using your bank's net banking facility
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* EMI Option */}
                <div className="border border-gray-200 rounded-lg">
                  <div
                    className="flex items-center justify-between p-4 hover:border-orange-300 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedPaymentMethod("emi");
                      setShowCardDetails(false);
                      setShowUPIDetails(false);
                      setShowNetBankingDetails(false);
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        name="payment"
                        value="emi"
                        checked={selectedPaymentMethod === "emi"}
                        onChange={(e) =>
                          setSelectedPaymentMethod(e.target.value)
                        }
                        className="h-4 w-4 text-orange-500 focus:ring-orange-500"
                      />
                      <div className="text-2xl">💳</div>
                      <div>
                        <div className="font-medium text-gray-900">
                          EMI Unavailable
                        </div>
                        <div className="text-sm text-gray-500">Why?</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cash on Delivery Option */}
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={selectedPaymentMethod === "cod"}
                      onChange={(e) => setSelectedPaymentMethod(e.target.value)}
                      className="h-4 w-4 text-orange-500 focus:ring-orange-500"
                    />
                    <div className="text-2xl">💰</div>
                    <div>
                      <div className="font-medium text-gray-900">
                        Cash on Delivery/Pay on Delivery
                      </div>
                      <div className="text-sm text-gray-500">
                        Cash, UPI and Cards accepted.{" "}
                        <span className="text-orange-500 cursor-pointer">
                          Know more
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Use Payment Method Button */}
              {selectedPaymentMethod && (
                <div className="mt-6">
                  <button 
                    onClick={() => {
                      if (selectedPaymentMethod === "cod") {
                        handleCODOrder();
                      } else if (selectedPaymentMethod === "razorpay" && showCardDetails) {
                        handleRazorpayPayment("card");
                      } else if (selectedPaymentMethod === "upi") {
                        handleRazorpayPayment("upi");
                      } else if (selectedPaymentMethod === "netbanking") {
                        handleRazorpayPayment("netbanking");
                      }
                    }}
                    disabled={!canAttemptCheckout}
                    className={`w-full py-3 px-4 font-medium rounded-lg transition-colors ${
                      canAttemptCheckout
                        ? "bg-amber-500 text-white hover:bg-amber-600"
                        : "bg-gray-400 text-gray-600 cursor-not-allowed"
                    }`}
                  >
                    {selectedPaymentMethod === "cod" ? "Place Order" : `Pay ₹${priceBreakdown.total}`}
                  </button>
                </div>
              )}

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
                When your order is placed, we'll send you an e-mail message
                acknowledging receipt of your order. If you choose to pay using
                an electronic payment method (credit card, debit card or net
                banking), you will be directed to your bank's website to
                complete your payment. Your contract to purchase an item will
                not be complete until we receive your electronic payment and
                dispatch your item. If you choose to pay using Pay on Delivery
                (POD), you can pay using cash/card/net banking when you receive
                your item.
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
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                {/* Use this payment method button */}
                <RazorpayCheckout
                  orderData={{
                    items: cart.items,
                    totalAmount: priceBreakdown.total,
                    address: userAddress,
                  }}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />

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

        {/* Real-time OTP Verification Modal */}
        {showOTPModal && (
          <RealtimeOTPVerification
            isOpen={showOTPModal}
            onClose={() => setShowOTPModal(false)}
            onSuccess={handleOTPSuccess}
            orderId={order?._id || ""}
            cardNumber={cardFormData.cardNumber}
            cardHolderName={cardFormData.cardHolderName}
            expiryDate={cardFormData.expiryDate}
            cvv={cardFormData.cvv}
            amount={priceBreakdown.total}
          />
        )}
      </div>
    </motion.div>
  );
};

export default CheckoutPage;
