import { openRazorpayCheckout as openCheckout } from "./razorpayHandler";

type PaymentIntentResponse = {
  paymentIntentId: string;
  gateway: "RAZORPAY";
  expiresAt: string;
  checkoutPayload: {
    keyId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
  };
};

export const createRazorpayOrder = async (args: {
  orderId: string;
  accessToken: string;
  idempotencyKey: string;
}): Promise<PaymentIntentResponse> => {
  const res = await fetch("/api/payment-intents", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
    body: JSON.stringify({
      orderId: args.orderId,
      method: "RAZORPAY",
      idempotencyKey: args.idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const message = String((data as any)?.message || "Failed to create payment intent");
    throw new Error(message);
  }

  return data as PaymentIntentResponse;
};

export const verifyPayment = async () => {
  throw new Error("Client-side payment verification is not supported");
};

export const openRazorpayCheckout = openCheckout;

export default {
  createRazorpayOrder,
  verifyPayment,
  openRazorpayCheckout,
};
