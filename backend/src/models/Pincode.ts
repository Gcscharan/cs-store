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
    index: true, // Ensure index for fast lookups
    match: [/^\d{6}$/, "Pincode must be 6 digits"],
  },
  state: {
    type: String,
    required: true,
    // No enum - we now support all India states
  },
  district: {
    type: String,
    index: true, // Index for district-based queries
  },
  taluka: {
    type: String,
  },
});

// Compound index for state + district queries (future optimization)
PincodeSchema.index({ state: 1, district: 1 });

export const Pincode = mongoose.model<IPincode>("Pincode", PincodeSchema);
