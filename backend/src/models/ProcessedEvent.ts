import mongoose, { Document, Schema } from "mongoose";

export interface IProcessedEvent extends Document {
  eventId: string;
  consumerName: string;   // which consumer processed this event
  processedAt: Date;
}

const ProcessedEventSchema = new Schema<IProcessedEvent>(
  {
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    consumerName: {
      type: String,
      required: true,
      index: true,
    },
    processedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Unique per (eventId, consumerName) — each consumer deduplicates independently
ProcessedEventSchema.index({ eventId: 1, consumerName: 1 }, { unique: true });

// TTL: auto-expire processed event records after 30 days (keeps collection lean)
ProcessedEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const ProcessedEvent = mongoose.model<IProcessedEvent>(
  "ProcessedEvent",
  ProcessedEventSchema
);

export default ProcessedEvent;
