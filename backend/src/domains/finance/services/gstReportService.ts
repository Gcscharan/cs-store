import { Order } from "../../../models/Order";

export interface GstReportQuery {
  from: Date;
  to: Date;
}

export interface GstReportResult {
  from: string;
  to: string;
  totalCGST: number;
  totalSGST: number;
  totalIGST: number;
  totalTax: number;
  totalRevenue: number;
  orderCount: number;
}

/**
 * Get GST aggregation report for a date range
 * 
 * Aggregates CGST, SGST, IGST, and total tax from delivered & paid orders.
 * Uses invoiceItems array for accurate itemized GST totals.
 */
export async function getGstReport(args: GstReportQuery): Promise<GstReportResult> {
  const { from, to } = args;

  // Match orders that are DELIVERED and PAID within date range
  const matchStage = {
    $match: {
      orderStatus: "DELIVERED",
      paymentStatus: "PAID",
      createdAt: { $gte: from, $lt: to },
      invoiceItems: { $exists: true, $ne: [] },
    },
  };

  // Unwind invoiceItems to aggregate per-item GST
  const unwindStage = {
    $unwind: {
      path: "$invoiceItems",
      preserveNullAndEmptyArrays: false,
    },
  };

  // Group to sum all GST components
  const groupStage = {
    $group: {
      _id: null,
      totalCGST: { $sum: "$invoiceItems.cgstAmount" },
      totalSGST: { $sum: "$invoiceItems.sgstAmount" },
      totalIGST: { $sum: "$invoiceItems.igstAmount" },
      totalRevenue: { $sum: "$invoiceItems.totalAmount" },
      orderCount: { $sum: 1 },
    },
  };

  // Note: orderCount will be inflated due to unwind, so we need a separate count
  const countMatchStage = {
    $match: {
      orderStatus: "DELIVERED",
      paymentStatus: "PAID",
      createdAt: { $gte: from, $lt: to },
    },
  };

  const countGroupStage = {
    $group: {
      _id: null,
      uniqueOrderCount: { $sum: 1 },
    },
  };

  // Run both aggregations in parallel
  const [gstResult, countResult] = await Promise.all([
    Order.aggregate([matchStage, unwindStage, groupStage]).exec(),
    Order.aggregate([countMatchStage, countGroupStage]).exec(),
  ]);

  const gstData = gstResult[0] || {
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    totalRevenue: 0,
  };

  const uniqueOrderCount = countResult[0]?.uniqueOrderCount || 0;

  // Calculate total tax (CGST + SGST + IGST)
  const totalTax = roundTo2Decimals(
    gstData.totalCGST + gstData.totalSGST + gstData.totalIGST
  );

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totalCGST: roundTo2Decimals(gstData.totalCGST),
    totalSGST: roundTo2Decimals(gstData.totalSGST),
    totalIGST: roundTo2Decimals(gstData.totalIGST),
    totalTax,
    totalRevenue: roundTo2Decimals(gstData.totalRevenue),
    orderCount: uniqueOrderCount,
  };
}

/**
 * Get GST summary from order-level gstBreakdown field
 * Alternative aggregation using order-level GST totals
 */
export async function getGstReportFromOrderBreakdown(args: GstReportQuery): Promise<GstReportResult> {
  const { from, to } = args;

  const matchStage = {
    $match: {
      orderStatus: "DELIVERED",
      paymentStatus: "PAID",
      createdAt: { $gte: from, $lt: to },
      gstBreakdown: { $exists: true },
    },
  };

  const groupStage = {
    $group: {
      _id: null,
      totalCGST: { $sum: "$gstBreakdown.cgst" },
      totalSGST: { $sum: "$gstBreakdown.sgst" },
      totalIGST: { $sum: "$gstBreakdown.igst" },
      totalRevenue: { $sum: "$grandTotal" },
      orderCount: { $sum: 1 },
    },
  };

  const result = await Order.aggregate([matchStage, groupStage]).exec();

  const data = result[0] || {
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    totalRevenue: 0,
    orderCount: 0,
  };

  const totalTax = roundTo2Decimals(
    data.totalCGST + data.totalSGST + data.totalIGST
  );

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totalCGST: roundTo2Decimals(data.totalCGST),
    totalSGST: roundTo2Decimals(data.totalSGST),
    totalIGST: roundTo2Decimals(data.totalIGST),
    totalTax,
    totalRevenue: roundTo2Decimals(data.totalRevenue),
    orderCount: data.orderCount,
  };
}

/**
 * Round a number to 2 decimal places
 */
function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}
