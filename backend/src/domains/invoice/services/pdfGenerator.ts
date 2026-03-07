import PDFDocument from "pdfkit";
import { Readable } from "stream";
import { IInvoiceItem, ISellerDetails } from "../../../models/Order";

/**
 * GST Invoice PDF Generator
 * 
 * Generates A4 printable invoices compliant with Indian GST rules.
 * Uses pdfkit for direct PDF generation without external dependencies.
 */

/**
 * Convert a Readable stream to a Buffer
 */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/**
 * Generate invoice PDF as a Buffer (for email attachments)
 */
export async function generateInvoicePdfBuffer(data: InvoiceData): Promise<Buffer> {
  const stream = generateInvoicePdf(data);
  return streamToBuffer(stream);
}

// Page dimensions (A4)
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// Colors
const COLORS = {
  primary: "#1a1a2e",
  secondary: "#4a4a6a",
  accent: "#e94560",
  text: "#333333",
  lightGray: "#f5f5f5",
  border: "#dddddd",
  headerBg: "#f8f9fa",
};

interface InvoiceData {
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
}

/**
 * Format number as Indian currency
 */
function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

/**
 * Format date in Indian format
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Create a readable stream from PDFDocument
 */
function createPdfStream(doc: InstanceType<typeof PDFDocument>): Readable {
  const stream = new Readable({
    read() {},
  });
  
  doc.on("data", (chunk: Buffer) => {
    stream.push(chunk);
  });
  
  doc.on("end", () => {
    stream.push(null);
  });
  
  return stream;
}

/**
 * Draw a horizontal line
 */
function drawLine(doc: InstanceType<typeof PDFDocument>, y: number, x1: number = MARGIN, x2: number = PAGE_WIDTH - MARGIN): void {
  doc
    .strokeColor(COLORS.border)
    .lineWidth(0.5)
    .moveTo(x1, y)
    .lineTo(x2, y)
    .stroke();
}

/**
 * Draw a filled rectangle
 */
function drawRect(doc: InstanceType<typeof PDFDocument>, x: number, y: number, width: number, height: number, fill: string): void {
  doc
    .fillColor(fill)
    .rect(x, y, width, height)
    .fill();
}

/**
 * Generate GST Invoice PDF
 */
export function generateInvoicePdf(data: InvoiceData): Readable {
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    bufferPages: true,
  });
  
  let y = MARGIN;
  
  // ==================== HEADER ====================
  // Seller Logo/Name
  doc
    .fontSize(20)
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .text(data.seller.tradeName || data.seller.legalName, MARGIN, y);
  
  y += 25;
  
  // Seller GSTIN
  doc
    .fontSize(10)
    .fillColor(COLORS.secondary)
    .font("Helvetica")
    .text(`GSTIN: ${data.seller.gstin}`, MARGIN, y);
  
  y += 15;
  
  // Seller Address
  const sellerAddress = [
    data.seller.addressLine1,
    data.seller.addressLine2,
    `${data.seller.city}, ${data.seller.state} - ${data.seller.pincode}`,
  ].filter(Boolean).join(", ");
  
  doc
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(sellerAddress, MARGIN, y, { width: CONTENT_WIDTH * 0.6 });
  
  // Invoice Title (Right aligned)
  doc
    .fontSize(18)
    .fillColor(COLORS.accent)
    .font("Helvetica-Bold")
    .text("TAX INVOICE", PAGE_WIDTH - MARGIN - 120, MARGIN, {
      width: 120,
      align: "right",
    });
  
  y = MARGIN + 25;
  
  // Invoice Number and Date (Right aligned)
  doc
    .fontSize(10)
    .fillColor(COLORS.text)
    .font("Helvetica")
    .text(`Invoice No: ${data.invoiceNumber}`, PAGE_WIDTH - MARGIN - 180, y, {
      width: 180,
      align: "right",
    });
  
  y += 15;
  
  doc
    .fontSize(10)
    .text(`Date: ${formatDate(data.invoiceDate)}`, PAGE_WIDTH - MARGIN - 180, y, {
      width: 180,
      align: "right",
    });
  
  y += 15;
  
  doc
    .fontSize(9)
    .fillColor(COLORS.secondary)
    .text(`Order ID: ${data.summary.orderId}`, PAGE_WIDTH - MARGIN - 180, y, {
      width: 180,
      align: "right",
    });
  
  // Move y past seller info
  y = Math.max(y, MARGIN + 60);
  
  drawLine(doc, y);
  y += 15;
  
  // ==================== BUYER INFO ====================
  // Left side: Bill To
  doc
    .fontSize(10)
    .fillColor(COLORS.secondary)
    .font("Helvetica-Bold")
    .text("BILL TO", MARGIN, y);
  
  y += 15;
  
  doc
    .fontSize(11)
    .fillColor(COLORS.text)
    .font("Helvetica-Bold")
    .text(data.buyer.name, MARGIN, y);
  
  y += 14;
  
  doc
    .fontSize(9)
    .font("Helvetica")
    .text(data.buyer.address, MARGIN, y, { width: CONTENT_WIDTH * 0.5 });
  
  y += 12;
  
  doc
    .text(`${data.buyer.city}, ${data.buyer.state} - ${data.buyer.pincode}`, MARGIN, y);
  
  y += 12;
  
  if (data.buyer.phone) {
    doc.text(`Phone: ${data.buyer.phone}`, MARGIN, y);
    y += 12;
  }
  
  // State Code on right
  const buyerInfoRight = PAGE_WIDTH - MARGIN - 150;
  let yRight = y - 40;
  
  doc
    .fontSize(9)
    .fillColor(COLORS.secondary)
    .text("State Code:", buyerInfoRight, yRight);
  
  doc
    .fillColor(COLORS.text)
    .text(data.buyer.stateCode, buyerInfoRight + 60, yRight);
  
  yRight += 15;
  
  doc
    .fillColor(COLORS.secondary)
    .text("State:", buyerInfoRight, yRight);
  
  doc
    .fillColor(COLORS.text)
    .text(data.buyer.state, buyerInfoRight + 60, yRight);
  
  y = Math.max(y, yRight) + 20;
  
  drawLine(doc, y);
  y += 15;
  
  // ==================== ITEMS TABLE ====================
  // Table Header
  const tableConfig = {
    columns: [
      { key: "item", label: "Item", width: 130 },
      { key: "hsn", label: "HSN", width: 45 },
      { key: "qty", label: "Qty", width: 30, align: "center" },
      { key: "rate", label: "Rate", width: 55, align: "right" },
      { key: "taxable", label: "Taxable", width: 60, align: "right" },
      { key: "gst", label: "GST%", width: 35, align: "center" },
      { key: "cgst", label: "CGST", width: 50, align: "right" },
      { key: "sgst", label: "SGST", width: 50, align: "right" },
      { key: "igst", label: "IGST", width: 50, align: "right" },
      { key: "total", label: "Total", width: 55, align: "right" },
    ],
    rowHeight: 20,
    headerHeight: 22,
  };
  
  // Draw header background
  drawRect(doc, MARGIN, y, CONTENT_WIDTH, tableConfig.headerHeight, COLORS.headerBg);
  
  // Draw header text
  let x = MARGIN;
  doc
    .fontSize(8)
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold");
  
  for (const col of tableConfig.columns) {
    doc.text(col.label, x, y + 6, {
      width: col.width,
      align: (col.align as any) || "left",
    });
    x += col.width;
  }
  
  y += tableConfig.headerHeight;
  
  // Draw rows
  doc.font("Helvetica").fontSize(8).fillColor(COLORS.text);
  
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    
    // Alternate row background
    if (i % 2 === 1) {
      drawRect(doc, MARGIN, y, CONTENT_WIDTH, tableConfig.rowHeight, COLORS.lightGray);
    }
    
    x = MARGIN;
    
    // Item name (truncate if too long)
    const itemName = item.productName.length > 25 
      ? item.productName.substring(0, 22) + "..." 
      : item.productName;
    
    doc.text(itemName, x, y + 5, { width: tableConfig.columns[0].width });
    x += tableConfig.columns[0].width;
    
    // HSN
    doc.text(item.hsnCode, x, y + 5, { width: tableConfig.columns[1].width });
    x += tableConfig.columns[1].width;
    
    // Qty
    doc.text(item.quantity.toString(), x, y + 5, {
      width: tableConfig.columns[2].width,
      align: "center",
    });
    x += tableConfig.columns[2].width;
    
    // Rate
    doc.text(formatCurrency(item.unitPrice), x, y + 5, {
      width: tableConfig.columns[3].width,
      align: "right",
    });
    x += tableConfig.columns[3].width;
    
    // Taxable
    doc.text(formatCurrency(item.taxableValue), x, y + 5, {
      width: tableConfig.columns[4].width,
      align: "right",
    });
    x += tableConfig.columns[4].width;
    
    // GST%
    doc.text(`${item.gstRate}%`, x, y + 5, {
      width: tableConfig.columns[5].width,
      align: "center",
    });
    x += tableConfig.columns[5].width;
    
    // CGST
    doc.text(item.cgstAmount > 0 ? formatCurrency(item.cgstAmount) : "-", x, y + 5, {
      width: tableConfig.columns[6].width,
      align: "right",
    });
    x += tableConfig.columns[6].width;
    
    // SGST
    doc.text(item.sgstAmount > 0 ? formatCurrency(item.sgstAmount) : "-", x, y + 5, {
      width: tableConfig.columns[7].width,
      align: "right",
    });
    x += tableConfig.columns[7].width;
    
    // IGST
    doc.text(item.igstAmount > 0 ? formatCurrency(item.igstAmount) : "-", x, y + 5, {
      width: tableConfig.columns[8].width,
      align: "right",
    });
    x += tableConfig.columns[8].width;
    
    // Total
    doc.text(formatCurrency(item.totalAmount), x, y + 5, {
      width: tableConfig.columns[9].width,
      align: "right",
    });
    
    y += tableConfig.rowHeight;
    
    // Check if we need a new page
    if (y > PAGE_HEIGHT - 200) {
      doc.addPage();
      y = MARGIN;
    }
  }
  
  // Draw table bottom border
  drawLine(doc, y);
  y += 15;
  
  // ==================== SUMMARY ====================
  const summaryX = PAGE_WIDTH - MARGIN - 200;
  const summaryValueX = PAGE_WIDTH - MARGIN - 80;
  
  const summaryRows = [
    { label: "Subtotal (Before Tax)", value: formatCurrency(data.summary.subtotalBeforeTax) },
    { label: "CGST", value: formatCurrency(data.summary.totalCGST), show: data.summary.totalCGST > 0 },
    { label: "SGST", value: formatCurrency(data.summary.totalSGST), show: data.summary.totalSGST > 0 },
    { label: "IGST", value: formatCurrency(data.summary.totalIGST), show: data.summary.totalIGST > 0 },
    { label: "Total Tax", value: formatCurrency(data.summary.totalTax) },
    { label: "Delivery Charges", value: formatCurrency(data.summary.deliveryFee), show: data.summary.deliveryFee > 0 },
    { label: "Discount", value: `-${formatCurrency(data.summary.discount)}`, show: data.summary.discount > 0 },
  ];
  
  doc.fontSize(9).font("Helvetica");
  
  for (const row of summaryRows) {
    if (row.show === false) continue;
    
    doc
      .fillColor(COLORS.secondary)
      .text(row.label, summaryX, y, { width: 120, align: "right" });
    
    doc
      .fillColor(COLORS.text)
      .text(row.value, summaryValueX, y, { width: 80, align: "right" });
    
    y += 14;
  }
  
  // Grand Total
  drawLine(doc, y, summaryX, PAGE_WIDTH - MARGIN);
  y += 8;
  
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(COLORS.primary)
    .text("Grand Total", summaryX, y, { width: 120, align: "right" });
  
  doc
    .fontSize(12)
    .fillColor(COLORS.accent)
    .text(formatCurrency(data.summary.grandTotal), summaryValueX, y, { width: 80, align: "right" });
  
  y += 20;
  
  // Payment Method
  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor(COLORS.secondary)
    .text(`Payment Method: ${data.summary.paymentMethod}`, summaryX, y, {
      width: 200,
      align: "right",
    });
  
  y += 30;
  
  // ==================== AMOUNT IN WORDS ====================
  const amountInWords = numberToWords(data.summary.grandTotal);
  
  doc
    .fontSize(9)
    .fillColor(COLORS.text)
    .text(`Amount in words: ${amountInWords} Only`, MARGIN, y);
  
  y += 30;
  
  // ==================== FOOTER ====================
  // Check if we need to move to next page for footer
  if (y > PAGE_HEIGHT - 120) {
    doc.addPage();
    y = MARGIN;
  }
  
  // Declaration
  doc
    .fontSize(8)
    .fillColor(COLORS.secondary)
    .text("Declaration:", MARGIN, y);
  
  y += 12;
  
  doc
    .fontSize(8)
    .text("We declare that this invoice shows actual price of goods described and that all particulars are true and correct.", MARGIN, y, {
      width: CONTENT_WIDTH,
    });
  
  y += 25;
  
  // Terms and Conditions
  doc
    .fontSize(8)
    .fillColor(COLORS.secondary)
    .text("Terms & Conditions:", MARGIN, y);
  
  y += 12;
  
  const terms = [
    "1. Goods once sold will not be taken back.",
    "2. Subject to jurisdiction.",
    "3. E. & O.E.",
  ];
  
  for (const term of terms) {
    doc
      .fontSize(7)
      .text(term, MARGIN, y);
    y += 10;
  }
  
  // Signature area (Right side)
  const sigX = PAGE_WIDTH - MARGIN - 150;
  let sigY = y - 60;
  
  doc
    .fontSize(8)
    .fillColor(COLORS.secondary)
    .text("For " + (data.seller.tradeName || data.seller.legalName), sigX, sigY, {
      width: 150,
      align: "center",
    });
  
  sigY += 40;
  
  drawLine(doc, sigY, sigX, sigX + 150);
  
  sigY += 5;
  
  doc
    .fontSize(8)
    .text("Authorized Signatory", sigX, sigY, { width: 150, align: "center" });
  
  // Finalize
  doc.end();
  
  return createPdfStream(doc);
}

/**
 * Convert number to words (Indian system)
 */
function numberToWords(num: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
    "Eighty", "Ninety",
  ];
  
  const scales = ["", "Thousand", "Lakh", "Crore"];
  
  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);
  
  function convertLessThanThousand(n: number): string {
    if (n === 0) return "";
    
    if (n < 20) {
      return ones[n];
    }
    
    if (n < 100) {
      return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
    }
    
    return ones[Math.floor(n / 100)] + " Hundred" +
      (n % 100 !== 0 ? " " + convertLessThanThousand(n % 100) : "");
  }
  
  function convertIndian(n: number): string {
    if (n === 0) return "Zero";
    
    let result = "";
    
    // Handle crores
    if (n >= 10000000) {
      result += convertLessThanThousand(Math.floor(n / 10000000)) + " Crore ";
      n %= 10000000;
    }
    
    // Handle lakhs
    if (n >= 100000) {
      result += convertLessThanThousand(Math.floor(n / 100000)) + " Lakh ";
      n %= 100000;
    }
    
    // Handle thousands
    if (n >= 1000) {
      result += convertLessThanThousand(Math.floor(n / 1000)) + " Thousand ";
      n %= 1000;
    }
    
    // Handle remainder
    if (n > 0) {
      result += convertLessThanThousand(n);
    }
    
    return result.trim();
  }
  
  let result = convertIndian(integerPart) + " Rupees";
  
  if (decimalPart > 0) {
    result += " and " + convertLessThanThousand(decimalPart) + " Paise";
  }
  
  return result;
}

export default {
  generateInvoicePdf,
};
