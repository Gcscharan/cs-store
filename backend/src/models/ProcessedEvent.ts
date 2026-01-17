import mongoose, { Document, Schema } from "mongoose";

export interface IProcessedEvent extends Document {
  eventId: string;
  processedAt: Date;
}

const ProcessedEventSchema = new Schema<IProcessedEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
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

const ProcessedEvent = mongoose.model<IProcessedEvent>(
  "ProcessedEvent",
  ProcessedEventSchema
);

export default ProcessedEvent;
