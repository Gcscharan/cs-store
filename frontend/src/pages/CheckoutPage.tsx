import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { clearCart } from "../store/slices/cartSlice";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import ChooseLocation from "../components/ChooseLocation";
import {
  calculatePriceBreakdown,
  formatPrice,
  formatDeliveryFee,
} from "../utils/priceCalculator";
import {
  calculateDeliveryFee,
} from "../utils/deliveryFeeCalculator";
import toast from "react-hot-toast";
import { CreditCard, Landmark, MapPin, Shield, Wallet } from "lucide-react";
import {
  useClearCartMutation,
  useGetAddressesQuery,
  useSetDefaultAddressMutation,
} from "../store/api";
import { createRazorpayOrder, openRazorpayCheckout } from "../utils/razorpay";
import PaymentStatusBanner from "../payments/PaymentStatusBanner";
import { toApiUrl } from "../config/runtime";
import { authFetch } from "../utils/authClient";
import {
  PaymentStates,
  type PaymentState,
  transition as transitionPaymentState,
} from "../payments/paymentStateMachine";
import {
  clearPaymentSession,
  loadPaymentSession,
  isSessionExpired,
  savePaymentSession,
  updatePaymentSession,
  type PaymentSession,
} from "../payments/paymentSession";
import { CheckoutPageSkeleton } from "../components/PageSkeletons";
import { useCartPersistence } from "../hooks/useCartPersistence";
import { reportError } from "../utils/sentry";
import { useLanguage } from "../contexts/LanguageContext";

const PaymentOption = (props: {
  value: string;
  selected: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  testId?: string;
}) => {
  return (
    <label
      className={
        "flex items-start gap-4 rounded-lg border p-4 cursor-pointer bg-white hover:border-orange-300 transition-colors " +
        (props.selected ? "border-orange-500 ring-1 ring-orange-200" : "border-gray-200")
      }
    >
      <input
        type="radio"
        name="payment"
        value={props.value}
        data-testid={props.testId}
        checked={props.selected}
        onChange={props.onChange}
        className="mt-1 h-5 w-5 text-orange-500 focus:ring-orange-500"
      />
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-md bg-orange-50 text-orange-700">
        {props.icon}
      </div>
      <div className="min-w-0">
        <div className="text-[17px] font-semibold text-gray-900">{props.title}</div>
        <div className="mt-1 text-[15px] text-gray-800">{props.description}</div>
      </div>
    </label>
  );
};

const CheckoutPage = () => {
  const cart = useSelector((state: RootState) => state.cart);
  const { user, isAuthenticated, tokens } = useSelector((state: RootState) => state.auth);
  const { isLoadingCart } = useCartPersistence();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [clearCartMutation] = useClearCartMutation();
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isPincodeServiceable, setIsPincodeServiceable] = useState<boolean | null>(null);
  
  // Fetch addresses using RTK Query (same as navbar and Layout)
  const { data: addressesData, refetch: refetchAddresses, isLoading: isLoadingAddresses } = useGetAddressesQuery(undefined, {
    skip: !isAuthenticated,
  });
  const [setDefaultAddressMutation] = useSetDefaultAddressMutation();

  const LAST_METHOD_KEY = "vyapara_setu_last_payment_method_v1";
  const loadLastMethod = (): "cod" | "upi" | "card" | "netbanking" => {
    try {
      const v = String(localStorage.getItem(LAST_METHOD_KEY) || "").trim();
      if (v === "cod" || v === "upi" || v === "card" || v === "netbanking") return v;
      return "upi";
    } catch {
      return "upi";
    }
  };

  const invalidateExistingOrder = () => {
    pollAbortRef.current?.abort();

    if (expiryIntervalRef.current) {
      window.clearInterval(expiryIntervalRef.current);
      expiryIntervalRef.current = null;
    }
    setExpiresAt(null);
    setRemainingSeconds(0);

    try {
      sessionStorage.removeItem("cs_order_create_idem_razorpay_v1");
      sessionStorage.removeItem("cs_order_create_idem_cod_v1");
    } catch {
    }

    try {
      clearPaymentSession();
    } catch {
    }
    setPaymentSession(null);
    setPaymentBannerHidden(true);
    setPaymentBannerNotice(undefined);
    setRetryAvailableAtMs(null);
    setFailureReason(null);
    setTerminalHelper(null);
    razorpayFlowInFlightRef.current = false;
    setIsRazorpayPolling(false);
    setIsPlacingOrder(false);
    setRazorpayAttempt(1);
    safeSetPaymentState(PaymentStates.IDLE);
  };
  const saveLastMethod = (m: "cod" | "upi" | "card" | "netbanking") => {
    try {
      localStorage.setItem(LAST_METHOD_KEY, m);
    } catch {
    }
  };

  const clearCartCompletely = async () => {
    try {
      dispatch(clearCart());
      if (isAuthenticated) {
        await clearCartMutation(undefined).unwrap();
      }
    } catch {
    }
  };

  if (isAuthenticated && isLoadingCart && cart.items.length === 0) {
    return <CheckoutPageSkeleton />;
  }

  if (isAuthenticated && isLoadingAddresses && cart.items.length > 0) {
    return <CheckoutPageSkeleton />;
  }

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"cod" | "upi" | "card" | "netbanking">(() => loadLastMethod());
  const [upiVpa, setUpiVpa] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [razorpayAttempt, setRazorpayAttempt] = useState(1);
  const [isRazorpayPolling, setIsRazorpayPolling] = useState(false);

  const [terminalHelper, setTerminalHelper] = useState<string | null>(null);

  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [paymentState, setPaymentState] = useState<PaymentState>(PaymentStates.IDLE);
  const [paymentBannerHidden, setPaymentBannerHidden] = useState(false);
  const [paymentBannerNotice, setPaymentBannerNotice] = useState<string | undefined>(undefined);
  const [retryAvailableAtMs, setRetryAvailableAtMs] = useState<number | null>(null);
  const [failureReason, setFailureReason] = useState<"MODAL_CLOSED" | "GATEWAY_ERROR" | "POLL_TIMEOUT" | null>(null);

  const pollAbortRef = React.useRef<AbortController | null>(null);
  const expiryIntervalRef = React.useRef<number | null>(null);
  const didInitPaymentSessionRef = React.useRef(false);
  const razorpayFlowInFlightRef = React.useRef(false);

  React.useEffect(() => {
    return () => {
      pollAbortRef.current?.abort();
      if (expiryIntervalRef.current) {
        window.clearInterval(expiryIntervalRef.current);
        expiryIntervalRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!expiresAt) {
      setRemainingSeconds(0);
      if (expiryIntervalRef.current) {
        window.clearInterval(expiryIntervalRef.current);
        expiryIntervalRef.current = null;
      }
      return;
    }

    if (expiryIntervalRef.current) {
      window.clearInterval(expiryIntervalRef.current);
      expiryIntervalRef.current = null;
    }

    const tick = () => {
      const ms = expiresAt.getTime() - Date.now();
      const sec = Math.max(0, Math.floor(ms / 1000));
      setRemainingSeconds(sec);

      if (sec <= 0) {
        setRemainingSeconds(0);

        if (expiryIntervalRef.current) {
          window.clearInterval(expiryIntervalRef.current);
          expiryIntervalRef.current = null;
        }

        resetCheckoutPaymentFlow({ message: "Payment expired. Please try again." });
      }
    };

    tick();
    expiryIntervalRef.current = window.setInterval(tick, 1000);

    return () => {
      if (expiryIntervalRef.current) {
        window.clearInterval(expiryIntervalRef.current);
        expiryIntervalRef.current = null;
      }
    };
  }, [expiresAt]);

  React.useEffect(() => {
    if (didInitPaymentSessionRef.current) return;
    if (isAuthenticated && isLoadingAddresses) return;
    didInitPaymentSessionRef.current = true;

    const existing = loadPaymentSession();
    if (!existing) return;

    const storedAddressId = String((existing as any).addressId || "").trim();
    const storedCartTotal = Number.isFinite(Number((existing as any).cartTotal))
      ? Number((existing as any).cartTotal)
      : null;
    const nextAddressId = String(currentAddressId || "").trim();
    const nextCartTotal = Number(cart.total);

    const addressMismatch = !!nextAddressId && (!storedAddressId || storedAddressId !== nextAddressId);
    const cartMismatch = storedCartTotal !== null && storedCartTotal !== nextCartTotal;

    if (addressMismatch || cartMismatch) {
      invalidateExistingOrder();
      return;
    }

    if (isSessionExpired(existing)) {
      clearPaymentSession();
      setPaymentSession(null);
      safeSetPaymentState(PaymentStates.IDLE);
      return;
    }

    if (existing.state === PaymentStates.PAYMENT_FAILED) {
      resetCheckoutPaymentFlow({ message: "Payment failed. Please try again." });
      return;
    }

    if (existing.state === PaymentStates.PAYMENT_CONFIRMED) {
      resetCheckoutPaymentFlow({ message: "Previous payment was confirmed. Please place a new order." });
      return;
    }

    setPaymentSession(existing);
    setPaymentBannerHidden(false);
    setPaymentBannerNotice("Resuming payment status…");
    safeSetPaymentState(existing.state);

    const accessToken = tokens?.accessToken;
    if (!accessToken) return;

    if (existing.paymentMethod === "razorpay") {
      if (
        existing.state === PaymentStates.PAYMENT_PROCESSING ||
        existing.state === PaymentStates.PAYMENT_INITIATED ||
        existing.state === PaymentStates.PAYMENT_RECOVERABLE ||
        existing.state === PaymentStates.ORDER_CREATED
      ) {
        void startReconciliationPolling({ orderId: existing.orderId, accessToken });
      }
    }
  }, [tokens?.accessToken]);

  const safeSetPaymentState = (next: PaymentState) => {
    setPaymentState((prev) => {
      try {
        return transitionPaymentState(prev, next);
      } catch {
        return next;
      }
    });
    updatePaymentSession({ state: next });
  };

  const hidePaymentBanner = () => {
    setPaymentBannerHidden(true);
    setPaymentBannerNotice(undefined);
  };

  const getPaymentBannerMessage = (state: PaymentState): string => {
    if (state === PaymentStates.ORDER_CREATED) return "Order created. Complete payment to confirm.";
    if (state === PaymentStates.PAYMENT_INITIATED) return "Payment initiated. Complete the Razorpay checkout.";
    if (state === PaymentStates.PAYMENT_PROCESSING) return "Payment received by gateway. Awaiting backend confirmation…";
    if (state === PaymentStates.PAYMENT_RECOVERABLE) return "Payment not confirmed yet. You can resume or retry.";
    if (state === PaymentStates.PAYMENT_FAILED) return "Payment failed. You can retry within attempt limits.";
    return "";
  };

  const showPaymentBanner =
    !paymentBannerHidden &&
    paymentSession &&
    paymentSession.paymentMethod === "razorpay" &&
    paymentState !== PaymentStates.IDLE;

  const waitForVisible = async (signal?: AbortSignal): Promise<void> => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "visible") return;

    await new Promise<void>((resolve, reject) => {
      const onChange = () => {
        if (document.visibilityState === "visible") {
          document.removeEventListener("visibilitychange", onChange);
          resolve();
        }
      };

      document.addEventListener("visibilitychange", onChange);

      if (signal) {
        const onAbort = () => {
          document.removeEventListener("visibilitychange", onChange);
          reject(new DOMException("Aborted", "AbortError"));
        };
        if (signal.aborted) {
          onAbort();
          return;
        }
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
  };

  const startReconciliationPolling = async (args: { orderId: string; accessToken: string }) => {
    if (!args.orderId) return;

    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;

    setIsRazorpayPolling(true);
    setRetryAvailableAtMs(null);

    const deadlineMs = Date.now() + 120_000;

    try {
      while (Date.now() < deadlineMs) {
        if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");

        if (typeof document !== "undefined" && document.visibilityState !== "visible") {
          await waitForVisible(controller.signal);
        }

        const res = await authFetch(toApiUrl(`/orders/${args.orderId}?ts=${Date.now()}`), {
          method: "GET",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            Pragma: "no-cache",
          },
          signal: controller.signal,
        });

        if (res.status !== 304 && res.ok) {
          const data = await res.json().catch(() => ({} as any));
          const status = String(
            (data as any)?.order?.paymentStatus || (data as any)?.paymentStatus || ""
          ).toUpperCase();

          const intentStatus = String(
            (data as any)?.order?.paymentIntent?.status || (data as any)?.paymentIntent?.status || ""
          ).toUpperCase();

          if (intentStatus === "EXPIRED") {
            resetCheckoutPaymentFlow({ message: "Payment expired. Please try again." });
            return;
          }
          if (intentStatus === "FAILED" || intentStatus === "CANCELLED") {
            resetCheckoutPaymentFlow({ message: "Payment was cancelled. Please try again." });
            return;
          }

          if (status === "PAID") {
            safeSetPaymentState(PaymentStates.PAYMENT_CONFIRMED);
            await clearCartCompletely();
            clearPaymentSession();
            setExpiresAt(null);
            setRemainingSeconds(0);
            navigate(`/order-success/${args.orderId}`);
            return;
          }
          if (status === "FAILED") {
            resetCheckoutPaymentFlow({ message: "Payment failed. Please try again." });
            return;
          }
        }

        await new Promise((r) => setTimeout(r, 3000));
      }

      safeSetPaymentState(PaymentStates.PAYMENT_RECOVERABLE);
      setFailureReason("POLL_TIMEOUT");
      setRetryAvailableAtMs(Date.now() + 30_000);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      safeSetPaymentState(PaymentStates.PAYMENT_RECOVERABLE);
      setFailureReason("POLL_TIMEOUT");
      setRetryAvailableAtMs(Date.now() + 30_000);
    } finally {
      setIsRazorpayPolling(false);
      razorpayFlowInFlightRef.current = false;
    }
  };

  const resumeRazorpayPaymentForOrder = async (args: { orderId: string }) => {
    const accessToken = tokens?.accessToken;
    if (!accessToken) {
      toast.error("Please log in to continue");
      navigate("/login");
      return;
    }
    if (!args.orderId) return;

    try {
      if (razorpayFlowInFlightRef.current) return;
      razorpayFlowInFlightRef.current = true;

      setIsPlacingOrder(true);
      setPaymentBannerHidden(false);
      setFailureReason(null);
      setTerminalHelper(null);

      const intent = await createRazorpayOrder({
        orderId: args.orderId,
        accessToken,
        idempotencyKey: `order_${args.orderId}_attempt_${razorpayAttempt}`,
      });

      const intentStatus = String((intent as any)?.status || "").toUpperCase();
      if (intentStatus === "FAILED") {
        resetCheckoutPaymentFlow({ message: "Payment failed. Please try again." });
        return;
      }
      if (intentStatus === "EXPIRED") {
        resetCheckoutPaymentFlow({ message: "Payment expired. Please try again." });
        return;
      }

      try {
        const exp = new Date(String((intent as any)?.expiresAt || ""));
        if (!isNaN(exp.getTime())) {
          setExpiresAt(exp);
        }
      } catch {
      }

      safeSetPaymentState(PaymentStates.PAYMENT_INITIATED);
      await openRazorpayCheckout({
        orderId: String((intent as any)?.checkoutPayload?.orderId || (intent as any)?.checkoutPayload?.razorpayOrderId || ""),
        key: String((intent as any)?.checkoutPayload?.key || (intent as any)?.checkoutPayload?.keyId || ""),
        amount: Number((intent as any)?.checkoutPayload?.amount),
        currency: String((intent as any)?.checkoutPayload?.currency || "INR"),
        upiId: (() => {
          if (selectedPaymentMethod !== "upi") return undefined;
          const upiVpaRegex = /^[\w.-]{2,}@[\w.-]{2,}$/;
          const normalizedUpiVpa = String(upiVpa || "").trim().toLowerCase();
          return upiVpaRegex.test(normalizedUpiVpa) ? normalizedUpiVpa : undefined;
        })(),
        prefill: {
          name: (user as any)?.name,
          email: (user as any)?.email,
          contact: (user as any)?.phone,
          vpa: (() => {
            const upiVpaRegex = /^[\w.-]{2,}@[\w.-]{2,}$/;
            const normalizedUpiVpa = String(upiVpa || "").trim().toLowerCase();
            return upiVpaRegex.test(normalizedUpiVpa) ? normalizedUpiVpa : undefined;
          })(),
        },
        onSuccess: async () => {
          safeSetPaymentState(PaymentStates.PAYMENT_PROCESSING);
          toast("Waiting for payment confirmation…");
          void startReconciliationPolling({ orderId: args.orderId, accessToken });
        },
        onDismiss: () => {
          resetCheckoutPaymentFlow({ message: "Payment was cancelled. Please try again." });
        },
        onFailure: () => {
          resetCheckoutPaymentFlow({ message: "Payment failed. Please try again." });
        },
      });
    } catch (error: any) {
      const msg = String(error?.message || "");
      reportError(error, { route: "checkout", method: "razorpay_card", step: "payment_init" });
      if (msg.includes("Invalid order amount") || msg.includes("Order not found")) {
        sessionStorage.removeItem("cs_order_create_idem_razorpay_v1");
      }
      if (msg.includes("(HTTP 410)")) {
        resetCheckoutPaymentFlow({ message: "Payment expired. Please try again." });
      } else {
        toast.error(error?.message || "Failed to process payment", { duration: 5000 });
        safeSetPaymentState(PaymentStates.PAYMENT_RECOVERABLE);
        razorpayFlowInFlightRef.current = false;
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleRazorpayPayment = async () => {
    const idemKeyStorage = "cs_order_create_idem_razorpay_v1";
    if (razorpayFlowInFlightRef.current) return;

    try {
      const upiVpaRegex = /^[\w.-]{2,}@[\w.-]{2,}$/;
      const normalizedUpiVpa = String(upiVpa || "").trim().toLowerCase();

      const shouldPrefillVpa = selectedPaymentMethod === "upi" && !!normalizedUpiVpa;
      if (selectedPaymentMethod === "upi" && !upiVpaRegex.test(normalizedUpiVpa)) {
        toast.error("Please enter a valid UPI ID");
        return;
      }

      if (!canAttemptCheckout) {
        toast.error("Please select a valid delivery address");
        return;
      }

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

      razorpayFlowInFlightRef.current = true;
      setIsPlacingOrder(true);
      setPaymentBannerHidden(false);
      setFailureReason(null);
      setTerminalHelper(null);

      const existingIdem = String(sessionStorage.getItem(idemKeyStorage) || "").trim();
      const orderCreateIdempotencyKey = existingIdem || `order_create_razorpay_${Date.now()}`;
      if (!existingIdem) {
        sessionStorage.setItem(idemKeyStorage, orderCreateIdempotencyKey);
      }

      const orderRes = await authFetch(toApiUrl("/orders"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": orderCreateIdempotencyKey,
        },
        body: JSON.stringify({ paymentMethod: "razorpay", idempotencyKey: orderCreateIdempotencyKey }),
      });

      const orderData = await orderRes.json().catch(() => ({} as any));
      if (!orderRes.ok) {
        throw new Error(String((orderData as any)?.message || (orderData as any)?.error || "Failed to create order"));
      }

      const dbOrderId = String(
        (orderData as any)?.order?._id ||
          (orderData as any)?.order?.id ||
          (orderData as any)?.orderId ||
          (orderData as any)?._id ||
          ""
      ).trim();
      if (!dbOrderId) throw new Error("Failed to create order");

      sessionStorage.removeItem(idemKeyStorage);

      const session: PaymentSession = {
        orderId: dbOrderId,
        paymentMethod: "razorpay",
        state: PaymentStates.ORDER_CREATED,
        createdAt: Date.now(),
        addressId: String(currentAddressId || "").trim() || undefined,
        cartTotal: Number(cart.total),
      };
      setPaymentSession(session);
      savePaymentSession(session);
      safeSetPaymentState(PaymentStates.ORDER_CREATED);

      const intent = await createRazorpayOrder({
        orderId: dbOrderId,
        accessToken,
        idempotencyKey: `order_${dbOrderId}_attempt_${razorpayAttempt}`,
      });

      const intentStatus = String((intent as any)?.status || "").toUpperCase();
      if (intentStatus === "FAILED") {
        resetCheckoutPaymentFlow({ message: "Payment failed. Please try again." });
        return;
      }
      if (intentStatus === "EXPIRED") {
        resetCheckoutPaymentFlow({ message: "Payment expired. Please try again." });
        return;
      }

      try {
        const exp = new Date(String((intent as any)?.expiresAt || ""));
        if (!isNaN(exp.getTime())) {
          setExpiresAt(exp);
        }
      } catch {
      }

      safeSetPaymentState(PaymentStates.PAYMENT_INITIATED);

      const checkoutArgs = {
        orderId: String((intent as any)?.checkoutPayload?.orderId || (intent as any)?.checkoutPayload?.razorpayOrderId || ""),
        key: String((intent as any)?.checkoutPayload?.key || (intent as any)?.checkoutPayload?.keyId || ""),
        amount: Number((intent as any)?.checkoutPayload?.amount),
        currency: String((intent as any)?.checkoutPayload?.currency || "INR"),
        upiId: selectedPaymentMethod === "upi" && isUpiValid ? normalizedUpiVpa : undefined,
        prefill: {
          name: (user as any)?.name,
          email: (user as any)?.email,
          contact: (user as any)?.phone,
          vpa: shouldPrefillVpa ? normalizedUpiVpa : undefined,
        },
        onSuccess: async () => {
          safeSetPaymentState(PaymentStates.PAYMENT_PROCESSING);
          toast("Waiting for payment confirmation…");
          void startReconciliationPolling({ orderId: dbOrderId, accessToken });
        },
        onDismiss: () => {
          resetCheckoutPaymentFlow({ message: "Payment was cancelled. Please try again." });
        },
        onFailure: () => {
          resetCheckoutPaymentFlow({ message: "Payment failed. Please try again." });
        },
      };
      await openRazorpayCheckout(checkoutArgs);
    } catch (error: any) {
      const msg = String(error?.message || "");
      reportError(error, { route: "checkout", method: "razorpay_upi", step: "payment_init" });
      if (msg.includes("(HTTP 410)")) {
        resetCheckoutPaymentFlow({ message: "Payment expired. Please try again." });
      } else {
        toast.error(error?.message || "Failed to process payment", { duration: 5000 });
        safeSetPaymentState(PaymentStates.PAYMENT_RECOVERABLE);
        razorpayFlowInFlightRef.current = false;
      }
    } finally {
      setIsPlacingOrder(false);
    }
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

  const currentAddressId = React.useMemo(() => {
    return String((userAddress as any)?._id || (userAddress as any)?.id || "").trim();
  }, [userAddress]);

  function resetCheckoutPaymentFlow(args: { message: string }) {
    try {
      pollAbortRef.current?.abort();
    } catch {
    }

    if (expiryIntervalRef.current) {
      window.clearInterval(expiryIntervalRef.current);
      expiryIntervalRef.current = null;
    }

    try {
      (window as any).__razorpayInstance?.close?.();
    } catch {
    }

    try {
      sessionStorage.removeItem("cs_order_create_idem_razorpay_v1");
      sessionStorage.removeItem("cs_order_create_idem_cod_v1");
    } catch {
    }

    try {
      clearPaymentSession();
    } catch {
    }

    setPaymentSession(null);
    setExpiresAt(null);
    setRemainingSeconds(0);
    setRetryAvailableAtMs(null);
    setFailureReason(null);
    setPaymentBannerNotice(undefined);
    setPaymentBannerHidden(true);
    setIsRazorpayPolling(false);
    setIsPlacingOrder(false);
    setRazorpayAttempt(1);
    razorpayFlowInFlightRef.current = false;

    setTerminalHelper(args.message);
    safeSetPaymentState(PaymentStates.IDLE);

    try {
      document.getElementById("checkout-payment-method")?.scrollIntoView({
        behavior: "auto",
        block: "start",
      });
    } catch {
    }
  }

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
        const res = await fetch(toApiUrl(`/pincode/check/${pincode}`));
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
  }, [userAddress, cart.total]);

  React.useEffect(() => {
    const stored = loadPaymentSession();
    if (!stored) return;

    const storedAddressId = String((stored as any).addressId || "").trim();
    const storedCartTotal = Number.isFinite(Number((stored as any).cartTotal)) ? Number((stored as any).cartTotal) : null;

    const hasNewAddressId = !!String(currentAddressId || "").trim();

    const addressMismatch =
      hasNewAddressId && (!storedAddressId || storedAddressId !== String(currentAddressId || "").trim());

    const cartMismatch = storedCartTotal !== null && storedCartTotal !== Number(cart.total);

    if (!addressMismatch && !cartMismatch) return;

    invalidateExistingOrder();
  }, [currentAddressId, cart.total]);

  const checkPincodeDeliverable = async (pincode: string): Promise<boolean> => {
    try {
      const res = await fetch(toApiUrl(`/pincode/check/${pincode}`));
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return false;
      return !!(data as any)?.deliverable;
    } catch {
      return false;
    }
  };

  const handleCODOrder = async () => {
    const idemKeyStorage = "cs_order_create_idem_cod_v1";
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

      const existingIdem = String(sessionStorage.getItem(idemKeyStorage) || "").trim();
      const orderCreateIdempotencyKey = existingIdem || `order_create_cod_${Date.now()}`;
      if (!existingIdem) {
        sessionStorage.setItem(idemKeyStorage, orderCreateIdempotencyKey);
      }

      const response = await authFetch(toApiUrl("/orders"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": orderCreateIdempotencyKey,
        },
        body: JSON.stringify({ paymentMethod: "cod", idempotencyKey: orderCreateIdempotencyKey }),
      });

      const data = await response.json().catch(() => ({} as any));
      if (!response.ok) {
        throw new Error(String((data as any)?.message || (data as any)?.error || "Failed to place order"));
      }

      const orderId = String((data as any)?.order?._id || "");
      if (!orderId) {
        throw new Error("Failed to place COD order");
      }

      sessionStorage.removeItem(idemKeyStorage);
      saveLastMethod("cod");
      await clearCartCompletely();
      navigate(`/order-success/${orderId}`);
    } catch (error: any) {
      console.error("COD order error:", error);
      reportError(error, { route: "checkout", method: "cod", step: "place_order" });
      toast.error(error.message || "Failed to place order", { duration: 5000 });
    } finally {
      setIsPlacingOrder(false);
    }
  };


  if (cart.items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">{t("checkout.title")}</h1>
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🛒</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              {t("cart.empty")}
            </h3>
            <p className="text-gray-600 mb-6">{t("cart.emptySubtitle")}</p>
            <Link
              to="/products"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t("cart.continueShopping")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const upiVpaRegex = /^[\w.-]{2,}@[\w.-]{2,}$/;
  const normalizedUpiVpa = String(upiVpa || "").trim().toLowerCase();
  const isUpiValid = upiVpaRegex.test(normalizedUpiVpa);
  const isPrimaryDisabled =
    !canAttemptCheckout ||
    isPlacingOrder ||
    isRazorpayPolling ||
    (selectedPaymentMethod === "upi" && !isUpiValid);
  const primaryActionLabel =
    isPlacingOrder || isRazorpayPolling
      ? t("checkout.processing")
      : selectedPaymentMethod === "cod"
        ? t("checkout.placeOrder")
        : `${t("checkout.pay")} ₹${priceBreakdown.total}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8 text-[17px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t("checkout.secureCheckout")}
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Delivery & Payment */}
          <div className="lg:col-span-2 space-y-8">
            {/* Delivery Address Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <MapPin className="h-5 w-5 mr-2 text-orange-500" />
                  {t("checkout.deliveryAddress")}
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
                <div className="mt-4 flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => setShowLocationModal(true)}
                    className="text-[15px] font-semibold text-blue-700 hover:text-blue-800 underline"
                  >
                    {t("checkout.changeAddress")}
                  </button>
                </div>
              </div>
            </div>

            {showPaymentBanner ? (
              <PaymentStatusBanner
                session={paymentSession!}
                state={paymentState}
                message={getPaymentBannerMessage(paymentState)}
                notice={paymentBannerNotice}
                retryAvailableAtMs={retryAvailableAtMs}
                attemptNo={razorpayAttempt}
                maxAttempts={3}
                failureReason={failureReason}
                onResume={() => {
                  const accessToken = tokens?.accessToken;
                  if (!accessToken) {
                    toast.error("Please log in to continue");
                    navigate("/login");
                    return;
                  }

                  // UX intent: "Continue checking" should not reopen the gateway; it should resume existing polling.
                  if (paymentState === PaymentStates.PAYMENT_PROCESSING) {
                    void startReconciliationPolling({ orderId: paymentSession!.orderId, accessToken });
                    return;
                  }

                  void resumeRazorpayPaymentForOrder({ orderId: paymentSession!.orderId });
                }}
                onHide={hidePaymentBanner}
              />
            ) : null}

            {showPaymentBanner && expiresAt && remainingSeconds > 0 ? (
              <div className="mt-2 text-sm text-gray-700 font-medium">
                ⏳ Payment expires in {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
                {String(remainingSeconds % 60).padStart(2, "0")}
              </div>
            ) : null}

            {/* Payment Method Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-xl font-semibold text-gray-900">{t("checkout.paymentMethod")}</h2>
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("checkout-payment-method")?.scrollIntoView({
                      behavior: "auto",
                      block: "start",
                    });
                  }}
                  className="text-[15px] font-semibold text-blue-700 hover:text-blue-800 underline"
                >
                  {t("checkout.editPayment")}
                </button>
              </div>

              {terminalHelper ? (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[15px] font-semibold text-blue-900">
                  {terminalHelper}
                </div>
              ) : null}

              <div id="checkout-payment-method" className="space-y-4">
                <PaymentOption
                  value="upi"
                  testId="payment-method-upi"
                  selected={selectedPaymentMethod === "upi"}
                  onChange={() => {
                    setSelectedPaymentMethod("upi");
                    saveLastMethod("upi");
                  }}
                  icon={<Wallet className="h-5 w-5" />}
                  title={t("checkout.upi")}
                  description={t("checkout.upiDesc")}
                />

                {selectedPaymentMethod === "upi" ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <label className="block text-[16px] font-semibold text-gray-900 mb-2">
                      {t("checkout.upiId")}
                    </label>
                    <input
                      type="text"
                      data-testid="upi-id-input"
                      placeholder="example@upi"
                      value={upiVpa}
                      onChange={(e) => {
                        setUpiVpa(e.target.value);
                      }}
                      className={
                        "w-full h-14 px-4 text-[16px] border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent " +
                        (upiVpa.length === 0 || isUpiValid ? "border-gray-300" : "border-red-400")
                      }
                    />
                    <div className="mt-2 text-sm text-gray-600">
                      {t("checkout.upiHint")}
                    </div>
                  </div>
                ) : null}

                <PaymentOption
                  value="card"
                  selected={selectedPaymentMethod === "card"}
                  onChange={() => {
                    setSelectedPaymentMethod("card");
                    saveLastMethod("card");
                  }}
                  icon={<CreditCard className="h-5 w-5" />}
                  title={t("checkout.card")}
                  description={t("checkout.cardDesc")}
                />

                <PaymentOption
                  value="netbanking"
                  selected={selectedPaymentMethod === "netbanking"}
                  onChange={() => {
                    setSelectedPaymentMethod("netbanking");
                    saveLastMethod("netbanking");
                  }}
                  icon={<Landmark className="h-5 w-5" />}
                  title={t("checkout.netbanking")}
                  description={t("checkout.netbankingDesc")}
                />

                <PaymentOption
                  value="cod"
                  testId="payment-method-cod"
                  selected={selectedPaymentMethod === "cod"}
                  onChange={() => {
                    setSelectedPaymentMethod("cod");
                    saveLastMethod("cod");
                  }}
                  icon={<span className="text-[18px] font-bold">₹</span>}
                  title={t("checkout.cod")}
                  description={t("checkout.codDesc")}
                />
              </div>

            </div>

            {/* Review Items Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {t("checkout.reviewItems")}
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
                  See Vyapara Setu's Return Policy.
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
                <button
                  type="button"
                  onClick={() => {
                    if (selectedPaymentMethod === "cod") {
                      void handleCODOrder();
                      return;
                    }
                    void handleRazorpayPayment();
                  }}
                  disabled={isPrimaryDisabled}
                  data-testid={selectedPaymentMethod === "cod" ? "cod-place-order-button" : "pay-primary-button"}
                  className={
                    "w-full rounded-lg px-4 py-4 text-[18px] font-bold transition-colors " +
                    (isPrimaryDisabled
                      ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                      : "bg-[#FFD814] text-gray-900 hover:bg-[#F7CA00] border border-[#FCD200]")
                  }
                >
                  {primaryActionLabel}
                </button>

                {/* Order Summary */}
                <div className="mt-6 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-900">{t("cart.subtotal")} ({priceBreakdown.itemCount} {t("cart.items")}):</span>
                    <span className="font-medium">
                      {formatPrice(priceBreakdown.subtotalBeforeTax)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-900">GST ({priceBreakdown.gstRate}%):</span>
                    <span className="font-medium text-gray-700">
                      {formatPrice(priceBreakdown.gstAmount)}
                    </span>
                  </div>
                  {priceBreakdown.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-900">{t("product.off")}:</span>
                      <span className="font-medium text-green-600">
                        - {formatPrice(priceBreakdown.discount)}
                      </span>
                    </div>
                  )}
                  {!requiresAddress ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-900">{t("checkout.delivery")}:</span>
                      <span className="font-medium">
                        {formatDeliveryFee(calculatedDeliveryFeeDetails)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm text-amber-800">
                      {t("checkout.addAddressForDelivery")}
                    </div>
                  )}
                  <div className="border-t pt-4">
                    <div className="flex justify-between text-[20px] font-bold text-gray-900">
                      <span>{t("checkout.orderTotal")}</span>
                      <span>{formatPrice(priceBreakdown.total)}</span>
                    </div>
                  </div>
                </div>

                {/* Security Badge */}
                <div className="mt-6 flex items-center justify-center space-x-2 text-xs text-gray-700">
                  <Shield className="h-4 w-4 text-green-700" />
                  <span>{t("checkout.securePayment")}</span>
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
    </div>
  );
};

export default CheckoutPage;
