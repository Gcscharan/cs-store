import mongoose, { Schema, Document } from "mongoose";

/**
 * Invoice Counter Model
 * 
 * Provides atomic, sequential invoice number generation.
 * Uses MongoDB's findOneAndUpdate with upsert for atomicity.
 * 
 * Invoice Number Format: INV-YYYY-000001
 * - INV: Prefix
 * - YYYY: Financial year (e.g., 2024)
 * - 000001: Sequential number, resets each year
 */

export interface IInvoiceCounter extends Document<string> {
  seq: number; // Current sequence number
  year: number; // Financial year
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceCounterSchema = new Schema<IInvoiceCounter>(
  {
    _id: {
      type: String,
      required: true,
    },
    seq: {
      type: Number,
      default: 0,
      min: 0,
    },
    year: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: "invoicecounters",
  }
);

// Compound index for year uniqueness
InvoiceCounterSchema.index({ year: 1 }, { unique: true });

/**
 * Get current financial year (April to March)
 * In India, financial year starts from April 1
 * So Feb 2024 is FY 2023-24, represented as 2024
 */
export function getFinancialYear(date: Date = new Date()): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (April = 3)
  
  // If month is January (0) to March (2), it's previous calendar year's FY
  // FY 2023-24: April 2023 to March 2024
  if (month < 3) {
    return year; // e.g., Feb 2024 returns 2024 (FY 2023-24)
  }
  return year; // e.g., May 2024 returns 2024 (FY 2024-25)
}

/**
 * Generate next invoice number atomically
 * Format: INV-YYYY-000001
 * 
 * @param session - Optional MongoDB session for transaction
 * @returns Invoice number string
 */
export async function getNextInvoiceNumber(
  session?: mongoose.ClientSession
): Promise<string> {
  const year = getFinancialYear();
  const counterId = `invoice-${year}`;
  
  // Atomic find-and-modify operation
  const result = await InvoiceCounter.findOneAndUpdate(
    { _id: counterId },
    { 
      $inc: { seq: 1 },
      $setOnInsert: { year, _id: counterId }
    },
    {
      upsert: true,
      new: true,
      session,
      setDefaultsOnInsert: true,
    }
  );
  
  const seq = result!.seq;
  const paddedSeq = seq.toString().padStart(6, "0");
  
  return `INV-${year}-${paddedSeq}`;
}

/**
 * Peek at the next invoice number without incrementing
 * Useful for preview/validation
 */
export async function peekNextInvoiceNumber(): Promise<string> {
  const year = getFinancialYear();
  const counterId = `invoice-${year}`;
  
  const counter = await InvoiceCounter.findById(counterId);
  const seq = (counter?.seq ?? 0) + 1;
  const paddedSeq = seq.toString().padStart(6, "0");
  
  return `INV-${year}-${paddedSeq}`;
}

export const InvoiceCounter = mongoose.model<IInvoiceCounter>(
  "InvoiceCounter",
  InvoiceCounterSchema
);

export default InvoiceCounter;
