import mongoose, { Document, Schema } from "mongoose";

export interface IPincode extends Document {
  pincode: string;
  state: string;
  district?: string;
  taluka?: string;
}

const PincodeSchema = new Schema<IPincode>({
  pincode: {
    type: String,
    required: true,
    unique: true,
    match: [/^\d{6}$/, "Pincode must be 6 digits"],
  },
  state: {
    type: String,
    required: true,
    enum: ["Andhra Pradesh", "Telangana"],
  },
  district: {
    type: String,
  },
  taluka: {
    type: String,
  },
});

// Index for fast lookups
PincodeSchema.index({ pincode: 1 });
PincodeSchema.index({ state: 1 });

export const Pincode = mongoose.model<IPincode>("Pincode", PincodeSchema);
