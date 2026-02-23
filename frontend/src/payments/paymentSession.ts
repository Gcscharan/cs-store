import { PaymentStates, type PaymentState } from "./paymentStateMachine";

export type PaymentMethod = "razorpay" | "upi" | "cod";

export type PaymentSession = {
  orderId: string;
  paymentMethod: PaymentMethod;
  state: PaymentState;
  createdAt: number;
  addressId?: string;
  cartTotal?: number;
};

const STORAGE_KEY = "cs_store_payment_session_v1";
const MAX_AGE_MS = 30 * 60_000;

function safeParse(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isSessionExpired(session: PaymentSession): boolean {
  return Date.now() - Number(session.createdAt || 0) > MAX_AGE_MS;
}

export function loadPaymentSession(): PaymentSession | null {
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY));
  if (!parsed || typeof parsed !== "object") return null;

  const orderId = String(parsed.orderId || "").trim();
  const paymentMethod = String(parsed.paymentMethod || "").trim() as PaymentMethod;
  const state = String(parsed.state || "").trim() as PaymentState;
  const createdAt = Number(parsed.createdAt || 0);
  const addressIdRaw = String((parsed as any).addressId || "").trim();
  const cartTotalRaw = Number((parsed as any).cartTotal);

  if (!orderId || !paymentMethod || !createdAt) return null;

  const knownStates = new Set<PaymentState>(Object.values(PaymentStates));
  if (!knownStates.has(state)) return null;

  const session: PaymentSession = {
    orderId,
    paymentMethod,
    state,
    createdAt,
    addressId: addressIdRaw || undefined,
    cartTotal: Number.isFinite(cartTotalRaw) ? cartTotalRaw : undefined,
  };
  if (isSessionExpired(session)) {
    clearPaymentSession();
    return null;
  }

  return session;
}

export function savePaymentSession(session: PaymentSession): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function updatePaymentSession(patch: Partial<PaymentSession>): PaymentSession | null {
  const existing = loadPaymentSession();
  if (!existing) return null;
  const next: PaymentSession = {
    ...existing,
    ...patch,
  } as PaymentSession;

  savePaymentSession(next);
  return next;
}

export function clearPaymentSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
