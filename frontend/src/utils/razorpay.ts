import { openRazorpayCheckout as openCheckout } from "./razorpayHandler";
import { toApiUrl } from "../config/runtime";
import { authFetch } from "./authClient";

type PaymentIntentResponse = {
  paymentIntentId: string;
  gateway: "RAZORPAY";
  expiresAt: string;
  checkoutPayload: {
    key?: string;
    orderId?: string;
    keyId?: string;
    razorpayOrderId?: string;
    amount: number;
    currency: string;
  };
};

export const createRazorpayOrder = async (args: {
  orderId: string;
  accessToken: string;
  idempotencyKey: string;
}): Promise<PaymentIntentResponse> => {
  const orderId = String(args.orderId || "").trim();
  const idempotencyKey = String(args.idempotencyKey || "").trim();
  if (!orderId) {
    throw new Error("Missing orderId for payment intent");
  }
  if (!idempotencyKey) {
    throw new Error("Missing idempotencyKey for payment intent");
  }

  const res = await authFetch(toApiUrl("/payment-intents"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      orderId,
      method: "RAZORPAY",
      idempotencyKey,
    }),
  });

  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    const message = String((data as any)?.message || "Failed to create payment intent");
    throw new Error(`${message} (HTTP ${res.status})`);
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
