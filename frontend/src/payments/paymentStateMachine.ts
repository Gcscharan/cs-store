export const PaymentStates = {
  IDLE: "IDLE",
  ORDER_CREATED: "ORDER_CREATED",
  PAYMENT_INITIATED: "PAYMENT_INITIATED",
  PAYMENT_PROCESSING: "PAYMENT_PROCESSING",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  PAYMENT_RECOVERABLE: "PAYMENT_RECOVERABLE",
} as const;

export type PaymentState = (typeof PaymentStates)[keyof typeof PaymentStates];

const ALLOWED_TRANSITIONS: Record<PaymentState, ReadonlyArray<PaymentState>> = {
  [PaymentStates.IDLE]: [PaymentStates.ORDER_CREATED],
  [PaymentStates.ORDER_CREATED]: [PaymentStates.PAYMENT_INITIATED, PaymentStates.PAYMENT_FAILED, PaymentStates.PAYMENT_RECOVERABLE],
  [PaymentStates.PAYMENT_INITIATED]: [PaymentStates.PAYMENT_PROCESSING, PaymentStates.PAYMENT_FAILED, PaymentStates.PAYMENT_RECOVERABLE],
  [PaymentStates.PAYMENT_PROCESSING]: [PaymentStates.PAYMENT_CONFIRMED, PaymentStates.PAYMENT_FAILED, PaymentStates.PAYMENT_RECOVERABLE],
  [PaymentStates.PAYMENT_CONFIRMED]: [PaymentStates.IDLE],
  [PaymentStates.PAYMENT_FAILED]: [PaymentStates.IDLE, PaymentStates.ORDER_CREATED],
  [PaymentStates.PAYMENT_RECOVERABLE]: [PaymentStates.PAYMENT_INITIATED, PaymentStates.PAYMENT_PROCESSING, PaymentStates.IDLE, PaymentStates.ORDER_CREATED],
};

export function canTransition(from: PaymentState, to: PaymentState): boolean {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function transition(from: PaymentState, to: PaymentState): PaymentState {
  if (from === to) return to;
  if (!canTransition(from, to)) {
    throw new Error(`Invalid payment state transition: ${from} -> ${to}`);
  }
  return to;
}

export function isTerminal(state: PaymentState): boolean {
  return state === PaymentStates.PAYMENT_CONFIRMED || state === PaymentStates.PAYMENT_FAILED;
}
