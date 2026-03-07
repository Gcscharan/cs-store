import mongoose from "mongoose";
import { Order, IOrder, IInvoiceItem, ISellerDetails } from "../../../models/Order";
import { Product } from "../../../models/Product";
import { getNextInvoiceNumber } from "../../../models/InvoiceCounter";
import { capturePaymentError } from "../../../utils/logger";

/**
 * Invoice Generation Service
 * 
 * Generates GST-compliant invoices for paid orders.
 * 
 * CRITICAL RULES:
 * 1. Invoice is generated ONLY when payment is captured (PAID status)
 * 2. Invoice number is sequential and atomic
 * 3. Invoice is IMMUTABLE after generation
 * 4. No regeneration allowed (idempotent)
 * 5. All currency values rounded to 2 decimals
 */

function assertSellerEnvConfigured(): void {
  const required = [
    "SELLER_LEGAL_NAME",
    "SELLER_GSTIN",
    "SELLER_ADDRESS_LINE1",
    "SELLER_CITY",
    "SELLER_STATE",
    "SELLER_STATE_CODE",
    "SELLER_PINCODE",
  ];

  const missing = required.filter((k) => !String(process.env[k] || "").trim());
  if (missing.length > 0) {
    const err: any = new Error(`Missing seller GST environment variables: ${missing.join(", ")}`);
    err.code = "SELLER_GST_ENV_MISSING";
    throw err;
  }
}

function buildSellerDetailsFromEnv(): ISellerDetails {
  return {
    legalName: String(process.env.SELLER_LEGAL_NAME || "").trim(),
    tradeName: String(process.env.SELLER_TRADE_NAME || "").trim() || undefined,
    gstin: String(process.env.SELLER_GSTIN || "").trim(),
    addressLine1: String(process.env.SELLER_ADDRESS_LINE1 || "").trim(),
    addressLine2: String(process.env.SELLER_ADDRESS_LINE2 || "").trim() || undefined,
    city: String(process.env.SELLER_CITY || "").trim(),
    state: String(process.env.SELLER_STATE || "").trim(),
    stateCode: String(process.env.SELLER_STATE_CODE || "").trim(),
    pincode: String(process.env.SELLER_PINCODE || "").trim(),
    phone: String(process.env.SELLER_PHONE || "").trim() || undefined,
    email: String(process.env.SELLER_EMAIL || "").trim() || undefined,
  };
}

// Default HSN codes for product categories
const DEFAULT_HSN_CODES: Record<string, string> = {
  chocolates: "1806",
  biscuits: "1905",
  ladoos: "1905",
  cakes: "1905",
  hot_snacks: "2106",
  groceries: "1901",
  vegetables: "0709",
  fruits: "0808",
  dairy: "0401",
  meat: "0204",
  beverages: "2202",
  snacks: "2106",
  household: "3402",
  personal_care: "3304",
  medicines: "3004",
  electronics: "8517",
  clothing: "6109",
  other: "2106",
};

/**
 * Round a number to 2 decimal places
 */
function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Get state code from state name
 */
function getStateCodeFromName(stateName: string): string {
  const stateCodes: Record<string, string> = {
    "Andhra Pradesh": "28",
    "Arunachal Pradesh": "12",
    "Assam": "18",
    "Bihar": "10",
    "Chhattisgarh": "22",
    "Goa": "30",
    "Gujarat": "24",
    "Haryana": "06",
    "Himachal Pradesh": "02",
    "Jharkhand": "20",
    "Karnataka": "29",
    "Kerala": "32",
    "Madhya Pradesh": "23",
    "Maharashtra": "27",
    "Manipur": "14",
    "Meghalaya": "17",
    "Mizoram": "15",
    "Nagaland": "13",
    "Odisha": "21",
    "Punjab": "03",
    "Rajasthan": "08",
    "Sikkim": "11",
    "Tamil Nadu": "33",
    "Telangana": "36",
    "Tripura": "16",
    "Uttar Pradesh": "09",
    "Uttarakhand": "05",
    "West Bengal": "19",
    "Delhi": "07",
    "Jammu and Kashmir": "01",
    "Ladakh": "38",
    "Puducherry": "34",
    "Chandigarh": "04",
    "Andaman and Nicobar Islands": "35",
    "Dadra and Nagar Haveli and Daman and Diu": "26",
    "Lakshadweep": "31",
  };
  
  return stateCodes[stateName] || "00";
}

/**
 * Check if order is eligible for invoice generation
 */
export function isOrderEligibleForInvoice(order: IOrder): boolean {
  // Must be paid
  if (order.paymentStatus !== "PAID") {
    return false;
  }
  
  // Must not already have an invoice
  if (order.invoiceNumber) {
    return false;
  }
  
  return true;
}

/**
 * Generate invoice for an order
 * 
 * This function:
 * 1. Validates the order is PAID
 * 2. Generates a unique invoice number atomically
 * 3. Creates detailed invoice line items with GST breakdown
 * 4. Attaches invoice data to the order
 * 5. Returns the invoice data
 * 
 * @param orderId - The order ID to generate invoice for
 * @returns Invoice data or null if not eligible
 */
export async function generateInvoiceForOrder(orderId: string): Promise<{
  success: boolean;
  invoiceNumber?: string;
  error?: string;
}> {
  const session = await mongoose.startSession();
  
  try {
    let result: { success: boolean; invoiceNumber?: string; error?: string } = {
      success: false,
    };
    
    await session.withTransaction(async () => {
      // Fetch order with lock
      const order = await Order.findById(orderId).session(session);
      
      if (!order) {
        result = { success: false, error: "Order not found" };
        return;
      }

      // Seller details must be configured at invoice time.
      // This is enforced here (not during order creation).
      assertSellerEnvConfigured();
      const sellerDetails = buildSellerDetailsFromEnv();
      
      // Check eligibility
      if (!isOrderEligibleForInvoice(order)) {
        if (order.invoiceNumber) {
          // Already has invoice - idempotent success
          result = { success: true, invoiceNumber: order.invoiceNumber };
          return;
        }
        if (order.paymentStatus !== "PAID") {
          result = { success: false, error: "Order is not paid" };
          return;
        }
        result = { success: false, error: "Order not eligible for invoice" };
        return;
      }
      
      // Fetch products for HSN codes
      const productIds = order.items.map(item => item.productId);
      const products = await Product.find({ _id: { $in: productIds } }).session(session);
      const productMap = new Map(products.map(p => [p._id.toString(), p]));
      
      // Determine if inter-state or intra-state
      const sellerStateCode = sellerDetails.stateCode;
      const buyerStateCode = getStateCodeFromName(order.address.state);
      const isInterState = sellerStateCode !== buyerStateCode;
      
      // Generate invoice number atomically
      const invoiceNumber = await getNextInvoiceNumber(session);
      
      // Create invoice line items
      const invoiceItems: IInvoiceItem[] = order.items.map((item) => {
        const product = productMap.get(item.productId.toString());
        const category = product?.category || "other";
        const hsnCode = DEFAULT_HSN_CODES[category] || "2106";
        
        const gstRate = item.gstRate || 18;
        const quantity = item.qty || item.quantity || 1;
        const unitPrice = roundTo2Decimals(item.priceAtOrderTime || item.price || 0);
        const taxableValue = roundTo2Decimals(unitPrice * quantity);
        
        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;
        
        if (isInterState) {
          // IGST for inter-state
          igstAmount = roundTo2Decimals((taxableValue * gstRate) / 100);
        } else {
          // CGST + SGST for intra-state (split equally)
          const halfGst = gstRate / 2;
          cgstAmount = roundTo2Decimals((taxableValue * halfGst) / 100);
          sgstAmount = roundTo2Decimals((taxableValue * halfGst) / 100);
        }
        
        const totalAmount = roundTo2Decimals(
          taxableValue + cgstAmount + sgstAmount + igstAmount
        );
        
        return {
          productId: item.productId,
          productName: item.name || item.productName || "Unknown Product",
          hsnCode,
          quantity,
          unitPrice,
          taxableValue,
          gstRate,
          cgstAmount,
          sgstAmount,
          igstAmount,
          totalAmount,
        };
      });
      
      // Attach invoice data to order
      order.invoiceNumber = invoiceNumber;
      order.invoiceGeneratedAt = new Date();
      order.invoiceItems = invoiceItems;
      order.sellerDetails = sellerDetails;
      
      await order.save({ session });
      
      console.log(`[Invoice] Generated invoice ${invoiceNumber} for order ${orderId}`);
      
      result = { success: true, invoiceNumber };
    });
    
    return result;
  } catch (error: any) {
    capturePaymentError("Invoice generation failed", error, { orderId });
    return { success: false, error: error.message || "Unknown error" };
  } finally {
    await session.endSession();
  }
}

/**
 * Get invoice data for an order
 * Returns null if invoice not generated
 */
export async function getInvoiceData(orderId: string): Promise<{
  order: IOrder;
  invoiceNumber: string;
  invoiceDate: Date;
  seller: ISellerDetails;
  buyer: {
    name: string;
    address: string;
    city: string;
    state: string;
    stateCode: string;
    pincode: string;
    phone?: string;
  };
  items: IInvoiceItem[];
  summary: {
    subtotalBeforeTax: number;
    totalCGST: number;
    totalSGST: number;
    totalIGST: number;
    totalTax: number;
    deliveryFee: number;
    discount: number;
    grandTotal: number;
    paymentMethod: string;
    orderId: string;
  };
} | null> {
  const order = await Order.findById(orderId);
  
  if (!order || !order.invoiceNumber) {
    return null;
  }
  
  // Calculate summary
  const items = order.invoiceItems || [];
  const subtotalBeforeTax = roundTo2Decimals(
    items.reduce((sum, item) => sum + item.taxableValue, 0)
  );
  const totalCGST = roundTo2Decimals(
    items.reduce((sum, item) => sum + item.cgstAmount, 0)
  );
  const totalSGST = roundTo2Decimals(
    items.reduce((sum, item) => sum + item.sgstAmount, 0)
  );
  const totalIGST = roundTo2Decimals(
    items.reduce((sum, item) => sum + item.igstAmount, 0)
  );
  const totalTax = roundTo2Decimals(totalCGST + totalSGST + totalIGST);
  
  return {
    order,
    invoiceNumber: order.invoiceNumber,
    invoiceDate: order.invoiceGeneratedAt!,
    seller: order.sellerDetails!,
    buyer: {
      name: order.address.name || "Customer",
      address: order.address.addressLine,
      city: order.address.city,
      state: order.address.state,
      stateCode: getStateCodeFromName(order.address.state),
      pincode: order.address.pincode,
      phone: order.address.phone,
    },
    items,
    summary: {
      subtotalBeforeTax,
      totalCGST,
      totalSGST,
      totalIGST,
      totalTax,
      deliveryFee: roundTo2Decimals(order.deliveryFee || 0),
      discount: roundTo2Decimals(order.discount || 0),
      grandTotal: roundTo2Decimals(order.grandTotal || order.totalAmount),
      paymentMethod: order.paymentMethod.toUpperCase(),
      orderId: order._id.toString(),
    },
  };
}

/**
 * Check if invoice exists for an order
 */
export async function invoiceExists(orderId: string): Promise<boolean> {
  const order = await Order.findById(orderId).select("invoiceNumber");
  return !!order?.invoiceNumber;
}

export default {
  generateInvoiceForOrder,
  getInvoiceData,
  isOrderEligibleForInvoice,
  invoiceExists,
};
