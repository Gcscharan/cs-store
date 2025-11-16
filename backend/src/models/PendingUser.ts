import mongoose, { Document, Schema } from "mongoose";
import { IAddress } from "./User";

export interface IPendingUser extends Document {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  addresses?: IAddress[];
  createdAt: Date;
  expiresAt: Date; // TTL expiry
}

const PendingUserSchema = new Schema<IPendingUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    addresses: { type: [Schema.Types.Mixed], default: [] },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index to auto-expire pending signups (e.g., 24 hours)
PendingUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingUser = mongoose.model<IPendingUser>("PendingUser", PendingUserSchema);