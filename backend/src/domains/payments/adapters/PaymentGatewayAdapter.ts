import { PaymentGateway } from "../types";

export interface GatewayCreateOrderInput {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface GatewayCreateOrderResult {
  gateway: PaymentGateway;
  gatewayOrderId: string;
  checkoutPayload: Record<string, any>;
}

export type NormalizedWebhookEventType =
  | "PAYMENT_CAPTURED"
  | "PAYMENT_FAILED"
  | "REFUND_PROCESSED"
  | "UNKNOWN";

export interface NormalizedWebhookEvent {
  gateway: PaymentGateway;
  type: NormalizedWebhookEventType;
  gatewayEventId: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;     // payment the event refers to
  gatewayRefundId?: string;      // refund id (REFUND_PROCESSED only)
  refundRequestId?: string;      // our RefundRequest id, echoed via refund notes
  amount?: number;
  currency?: string;
  occurredAt?: Date;
  rawEvent: any;
}

export interface GatewayRefundInput {
  gatewayPaymentId: string;      // Razorpay payment id to refund
  amount: number;                // in major units (e.g. rupees)
  notes?: Record<string, string>;
  idempotencyKey?: string;       // gateway-level idempotency (dedupe at provider)
}

export interface GatewayRefundResult {
  gatewayRefundId: string;
  status: string;                // gateway status: "processed" | "pending" | ...
  amount: number;                // major units
  raw: any;
}

export interface PaymentGatewayAdapter {
  gateway: PaymentGateway;

  createOrder(input: GatewayCreateOrderInput): Promise<GatewayCreateOrderResult>;

  verifyWebhookSignature(args: {
    rawBody: Buffer;
    headers: Record<string, any>;
  }): { ok: true } | { ok: false; reason: string };

  parseWebhook(args: { rawBody: Buffer }): NormalizedWebhookEvent;

  refundPayment(input: GatewayRefundInput): Promise<GatewayRefundResult>;
}
