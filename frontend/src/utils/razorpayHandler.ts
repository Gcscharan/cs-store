declare global {
  interface Window {
    Razorpay?: any;
    __razorpayInstance?: any;
  }
}

import { ensureAccessTokenFresh } from "./authClient";

export const loadRazorpayScript = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;

  const existing = document.getElementById("razorpay-checkout-js");
  if (existing) {
    return new Promise((resolve) => {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
    });
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export type PaymentFailureReason =
  | "USER_CANCELLED"
  | "GATEWAY_ERROR"
  | "TIMEOUT"
  | "UNKNOWN";

export interface PaymentFailurePayload {
  reason: PaymentFailureReason;
  gatewayResponse?: any;
}

export const openRazorpayCheckout = async (args: {
  orderId: string;
  key: string;
  amount: number;
  currency: string;
  prefill?: { name?: string; email?: string; contact?: string; vpa?: string };
  upiId?: string;
  onSuccess: (response: any) => void | Promise<void>;
  onPaymentFailure: (payload: PaymentFailurePayload) => void;
}): Promise<void> => {
  const token = await ensureAccessTokenFresh(2 * 60_000);
  if (!token) {
    console.info("[CHECKOUT][PAYMENT_BLOCKED_TOKEN_EXPIRED]", {
      orderId: String(args.orderId || ""),
    });
    throw new Error("Session expired");
  }

  const loaded = await loadRazorpayScript();
  if (!loaded) {
    throw new Error("Failed to load payment gateway");
  }

  console.info("[FRONTEND][RAZORPAY_OPEN_INIT]", {
    orderId: String(args.orderId || ""),
  });

  const upiId = String(args.upiId || args.prefill?.vpa || "").trim();

  const maskUpiId = (v: string): string => {
    const s = String(v || "").trim();
    const at = s.indexOf("@");
    if (at <= 1) return s ? "***" : "";
    const local = s.slice(0, at);
    const domain = s.slice(at + 1);
    return `${local[0]}***@${domain}`;
  };

  const options: any = {
    key: args.key,
    order_id: args.orderId,
    amount: args.amount,
    currency: args.currency,
    prefill: { ...(args.prefill || {}) },
    handler: (response: any) => {
      console.info("[FRONTEND][HANDLER_CALLED]", {
        source: "razorpayHandler",
        orderId: String(args.orderId || ""),
      });
      void args.onSuccess(response);
    },
    modal: {
      ondismiss: () => {
        args.onPaymentFailure({ reason: "USER_CANCELLED" });
      },
    },
  };

  // UPI Collect fast-path: skip the generic payment selector when we already have a UPI ID.
  if (upiId) {
    options.method = "upi";
    options.upi = { flow: "collect", vpa: upiId };
    options.prefill = { ...(options.prefill || {}), vpa: upiId };
  }

  console.info("[FRONTEND][RAZORPAY_OPTIONS]", {
    orderId: String(args.orderId || ""),
    method: options.method,
    upi: options.upi ? { ...options.upi, vpa: maskUpiId(String(options.upi?.vpa || "")) } : undefined,
    prefill: options.prefill ? { ...options.prefill, vpa: maskUpiId(String(options.prefill?.vpa || "")) } : undefined,
  });

  console.info("[AUDIT][RAZORPAY_OPTIONS]", {
    method: options.method,
    upi: options.upi ? { ...options.upi, vpa: maskUpiId(String(options.upi?.vpa || "")) } : undefined,
    prefill: options.prefill ? { ...options.prefill, vpa: maskUpiId(String(options.prefill?.vpa || "")) } : undefined,
  });

  console.log("[CHECK-3] Razorpay options prepared", options);
  console.log("[CHECK-3] new Razorpay(options) about to execute");
  const rzp = new (window as any).Razorpay(options);
  (window as any).__razorpayInstance = rzp;
  console.log("[CHECK-3] new Razorpay(options) executed", { hasRzp: !!rzp });
  if (typeof rzp?.on === "function") {
    rzp.on("payment.failed", (resp: any) => {
      args.onPaymentFailure({ reason: "GATEWAY_ERROR", gatewayResponse: resp });
    });
  }

  console.info("[AUDIT][RAZORPAY_OPEN_CALLED]");
  console.log("[CHECK-4] Razorpay.open() about to be called");
  rzp.open();
  console.info("[FRONTEND][RAZORPAY_OPENED]", {
    orderId: String(args.orderId || ""),
  });
  console.log("[CHECK-4] Razorpay.open() called");
};

export const verifyPayment = async (): Promise<{ success: boolean; error?: string }> => {
  return { success: false, error: "Client-side payment verification is not supported" };
};
