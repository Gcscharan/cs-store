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

export type NormalizedWebhookEventType = "PAYMENT_CAPTURED" | "PAYMENT_FAILED" | "UNKNOWN";

export interface NormalizedWebhookEvent {
  gateway: PaymentGateway;
  type: NormalizedWebhookEventType;
  gatewayEventId: string;
  gatewayOrderId?: string;
  amount?: number;
  currency?: string;
  occurredAt?: Date;
  rawEvent: any;
}

export interface PaymentGatewayAdapter {
  gateway: PaymentGateway;

  createOrder(input: GatewayCreateOrderInput): Promise<GatewayCreateOrderResult>;

  verifyWebhookSignature(args: {
    rawBody: Buffer;
    headers: Record<string, any>;
  }): { ok: true } | { ok: false; reason: string };

  parseWebhook(args: { rawBody: Buffer }): NormalizedWebhookEvent;
}
