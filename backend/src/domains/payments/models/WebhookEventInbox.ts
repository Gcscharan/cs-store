import mongoose, { Document, Schema } from "mongoose";

import {
  PaymentGateway,
  PAYMENT_GATEWAYS,
  WebhookInboxStatus,
  WEBHOOK_INBOX_STATUSES,
} from "../types";

export interface IWebhookEventInbox extends Document {
  _id: mongoose.Types.ObjectId;
  gateway: PaymentGateway;
  dedupeKey: string;
  eventId?: string;
  status: WebhookInboxStatus;
  receivedAt: Date;
  processedAt?: Date;
  error?: string;
  rawHeaders?: Record<string, any>;
  rawBodyHash?: string;
  rawBody?: any;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEventInboxSchema = new Schema<IWebhookEventInbox>(
  {
    gateway: { type: String, enum: [...PAYMENT_GATEWAYS], required: true },
    dedupeKey: { type: String, required: true, trim: true },
    eventId: { type: String, trim: true },
    status: { type: String, enum: [...WEBHOOK_INBOX_STATUSES], required: true, default: "RECEIVED" },
    receivedAt: { type: Date, required: true, default: Date.now },
    processedAt: { type: Date },
    error: { type: String },
    rawHeaders: { type: Schema.Types.Mixed },
    rawBodyHash: { type: String },
    rawBody: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

WebhookEventInboxSchema.index({ dedupeKey: 1 }, { unique: true });
WebhookEventInboxSchema.index({ receivedAt: -1 });

export const WebhookEventInbox = mongoose.model<IWebhookEventInbox>(
  "WebhookEventInbox",
  WebhookEventInboxSchema
);
