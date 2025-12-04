import mongoose, { Document, Schema } from "mongoose";

export interface IOtp extends Document {
  phone: string;
  otp: string;
  type: "payment" | "login" | "verification" | "signup";
  orderId?: mongoose.Types.ObjectId;
  paymentId?: string;
  expiresAt: Date;
  isUsed: boolean;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    otp: {
      type: String,
      required: true,
      length: 6,
    },
    type: {
      type: String,
      enum: ["payment", "login", "verification", "signup"],
      required: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: "Order",
    },
    paymentId: {
      type: String,
    },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
      validate: {
        validator(value: number) {
          return value <= 3;
        },
        message: "Maximum OTP attempts exceeded",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
OtpSchema.index({ phone: 1, type: 1, isUsed: 1 });
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IOtp>("Otp", OtpSchema);
