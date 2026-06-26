import mongoose, { Document, Schema } from "mongoose";

export type SupportRequestStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";
export type SupportRequesterRole = "customer" | "delivery" | "admin";

export interface ISupportRequest extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: SupportRequesterRole;
  category: string;
  subject?: string;
  message: string;
  contactPhone?: string;
  orderId?: mongoose.Types.ObjectId;
  status: SupportRequestStatus;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  adminNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SupportRequestSchema = new Schema<ISupportRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: {
      type: String,
      enum: ["customer", "delivery", "admin"],
      required: true,
    },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    subject: { type: String, trim: true, maxlength: 200 },
    message: { type: String, required: true, trim: true, maxlength: 4000 },
    contactPhone: { type: String, trim: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order" },
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "RESOLVED"],
      default: "OPEN",
      index: true,
    },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    adminNote: { type: String, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

// Admin inbox: newest open requests first.
SupportRequestSchema.index({ status: 1, createdAt: -1 });

export const SupportRequest = mongoose.model<ISupportRequest>(
  "SupportRequest",
  SupportRequestSchema
);
