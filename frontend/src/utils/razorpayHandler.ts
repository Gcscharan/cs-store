type RazorpayCheckoutPayload = {
  keyId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
};

declare global {
  interface Window {
    Razorpay?: any;
  }
}

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

export const openRazorpayCheckout = async (args: {
  checkoutPayload: RazorpayCheckoutPayload;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (response: any) => void | Promise<void>;
  onDismiss: () => void;
  onFailure?: (response: any) => void;
}): Promise<void> => {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    throw new Error("Failed to load payment gateway");
  }

  const options: any = {
    key: args.checkoutPayload.keyId,
    order_id: args.checkoutPayload.razorpayOrderId,
    amount: args.checkoutPayload.amount,
    currency: args.checkoutPayload.currency,
    prefill: args.prefill || {},
    handler: (response: any) => {
      void args.onSuccess(response);
    },
    modal: {
      ondismiss: () => {
        args.onDismiss();
      },
    },
  };

  const rzp = new (window as any).Razorpay(options);
  if (typeof rzp?.on === "function") {
    rzp.on("payment.failed", (resp: any) => {
      if (args.onFailure) args.onFailure(resp);
    });
  }

  rzp.open();
};

export const verifyPayment = async (): Promise<{ success: boolean; error?: string }> => {
  return { success: false, error: "Client-side payment verification is not supported" };
};
