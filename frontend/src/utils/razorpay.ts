import Razorpay from "razorpay";

// Razorpay configuration
const RAZORPAY_KEY_ID =
  import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_RREROYUEXDmjIA";

// Initialize Razorpay
const loadRazorpay = (): Promise<any> => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => {
      resolve((window as any).Razorpay);
    };
    script.onerror = () => {
      resolve(null);
    };
    document.body.appendChild(script);
  });
};

// Create Razorpay order
export const createRazorpayOrder = async (
  amount: number,
  currency: string = "INR",
  receipt?: string
) => {
  try {
    const response = await fetch(
      `${
        process.env.REACT_APP_API_URL || "http://localhost:5001"
      }/api/payment/create-order`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amount,
          currency: currency,
          receipt: receipt || `receipt_${Date.now()}`,
          notes: {
            source: "frontend",
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to create order");
    }

    return data.order;
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    throw error;
  }
};

// Verify payment
export const verifyPayment = async (
  orderId: string,
  paymentId: string,
  signature: string
) => {
  try {
    const token = localStorage.getItem("accessToken");

    const response = await fetch(
      `${
        import.meta.env.VITE_API_URL || "http://localhost:5001"
      }/api/payment/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Payment verification failed");
    }

    return data;
  } catch (error) {
    console.error("Error verifying payment:", error);
    throw error;
  }
};

// Open Razorpay checkout
export const openRazorpayCheckout = async (
  order: any,
  userDetails: {
    name: string;
    email: string;
    phone: string;
  },
  onSuccess: (paymentId: string, orderId: string) => void,
  onError: (error: string) => void
) => {
  try {
    const Razorpay = await loadRazorpay();

    if (!Razorpay) {
      throw new Error("Failed to load Razorpay");
    }

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      name: "CPS Store",
      description: "Payment for your order",
      order_id: order.id,
      prefill: {
        name: userDetails.name,
        email: userDetails.email,
        contact: userDetails.phone,
      },
      theme: {
        color: "#2563eb",
      },
      // Enable all payment methods
      method: {
        netbanking: true,
        wallet: true,
        upi: true,
        card: true,
        emi: true,
        paylater: true,
      },
      // Additional options for better UX
      modal: {
        ondismiss: function () {
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
        process.env.REACT_APP_API_URL || "http://localhost:5001"
      }/api/payment/callback`,
      handler: async function (response: any) {
        try {
          const verification = await verifyPayment(
            response.razorpay_order_id,
            response.razorpay_payment_id,
            response.razorpay_signature
          );

          if (verification.success) {
            onSuccess(response.razorpay_payment_id, response.razorpay_order_id);
          } else {
            onError("Payment verification failed");
          }
        } catch (error) {
          console.error("Payment verification error:", error);
          onError("Payment verification failed");
        }
      },
    };

    const razorpayInstance = new Razorpay(options);
    razorpayInstance.open();
  } catch (error) {
    console.error("Error opening Razorpay checkout:", error);
    onError("Failed to open payment gateway");
  }
};

export default {
  createRazorpayOrder,
  verifyPayment,
  openRazorpayCheckout,
  loadRazorpay,
};
