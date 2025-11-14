import toast from "react-hot-toast";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  method?: {
    card?: boolean;
    netbanking?: boolean;
    wallet?: boolean;
    upi?: boolean;
    paylater?: boolean;
  };
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: any) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

/**
 * Load Razorpay checkout script
 */
export const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // Check if script is already loaded
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

/**
 * Open Razorpay Checkout
 */
export const openRazorpayCheckout = async (
  paymentMethod: "card" | "upi" | "netbanking",
  orderDetails: {
    orderId: string;
    amount: number;
    currency: string;
    key: string;
  },
  userDetails: {
    name?: string;
    email?: string;
    contact?: string;
  },
  onSuccess: (response: any) => void,
  onFailure: () => void
): Promise<void> => {
  try {
    // Load Razorpay script
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      toast.error("Failed to load payment gateway. Please try again.");
      onFailure();
      return;
    }

    // Configure method-specific options
    const methodConfig: RazorpayOptions["method"] = {};
    switch (paymentMethod) {
      case "card":
        methodConfig.card = true;
        methodConfig.netbanking = false;
        methodConfig.wallet = false;
        methodConfig.upi = false;
        break;
      case "upi":
        methodConfig.upi = true;
        methodConfig.card = false;
        methodConfig.netbanking = false;
        methodConfig.wallet = false;
        break;
      case "netbanking":
        methodConfig.netbanking = true;
        methodConfig.card = false;
        methodConfig.wallet = false;
        methodConfig.upi = false;
        break;
    }

    // Razorpay options
    const options: RazorpayOptions = {
      key: orderDetails.key,
      amount: orderDetails.amount,
      currency: orderDetails.currency,
      name: "CS Store",
      description: "Payment for your order",
      order_id: orderDetails.orderId,
      method: methodConfig,
      prefill: {
        name: userDetails.name || "",
        email: userDetails.email || "",
        contact: userDetails.contact || "",
      },
      theme: {
        color: "#2563eb", // Blue color
      },
      handler: (response: any) => {
        console.log("Payment successful:", response);
        onSuccess(response);
      },
      modal: {
        ondismiss: () => {
          console.log("Payment cancelled by user");
          toast.error("Payment cancelled");
          onFailure();
        },
      },
    };

    // Create and open Razorpay checkout
    const razorpay = new window.Razorpay(options);
    razorpay.open();
  } catch (error) {
    console.error("Razorpay checkout error:", error);
    toast.error("Failed to open payment gateway. Please try again.");
    onFailure();
  }
};

/**
 * Verify payment with backend
 */
export const verifyPayment = async (
  paymentResponse: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  },
  token: string
): Promise<{ success: boolean; orderId?: string; error?: string }> => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:5001"}/api/razorpay/verify-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(paymentResponse),
      }
    );

    const data = await response.json();

    if (response.ok) {
      return { success: true, orderId: data.orderId };
    } else {
      return { success: false, error: data.error || "Payment verification failed" };
    }
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return { success: false, error: error.message || "Network error occurred" };
  }
};
