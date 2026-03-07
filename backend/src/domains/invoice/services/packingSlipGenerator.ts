import PDFDocument from "pdfkit";
import { Readable } from "stream";
import { IOrder } from "../../../models/Order";

/**
 * Packing Slip PDF Generator
 * 
 * Generates A4 printable packing slips for operations team.
 * Contains NO price information - only items and shipping details.
 */

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
 * Generate Packing Slip PDF
 */
export function generatePackingSlipPdf(order: IOrder): Readable {
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    bufferPages: true,
  });
  
  let y = MARGIN;
  
  // ==================== HEADER ====================
  // Title
  doc
    .fontSize(24)
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold")
    .text("PACKING SLIP", MARGIN, y, {
      width: CONTENT_WIDTH,
      align: "center",
    });
  
  y += 35;
  
  // Order ID and Date
  doc
    .fontSize(12)
    .fillColor(COLORS.secondary)
    .font("Helvetica")
    .text(`Order ID: ${order._id}`, MARGIN, y);
  
  doc
    .text(`Date: ${formatDate(order.createdAt)}`, PAGE_WIDTH - MARGIN - 150, y, {
      width: 150,
      align: "right",
    });
  
  y += 20;
  
  // Invoice number (if available)
  if (order.invoiceNumber) {
    doc
      .fontSize(10)
      .text(`Invoice: ${order.invoiceNumber}`, MARGIN, y);
    y += 15;
  }
  
  drawLine(doc, y);
  y += 15;
  
  // ==================== SHIPPING ADDRESS ====================
  // Left side: Ship To
  doc
    .fontSize(11)
    .fillColor(COLORS.secondary)
    .font("Helvetica-Bold")
    .text("SHIP TO", MARGIN, y);
  
  y += 15;
  
  doc
    .fontSize(12)
    .fillColor(COLORS.text)
    .font("Helvetica-Bold")
    .text(order.address.name || "Customer", MARGIN, y);
  
  y += 15;
  
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(order.address.addressLine, MARGIN, y, { width: CONTENT_WIDTH * 0.5 });
  
  y += 13;
  
  if (order.address.landmark) {
    doc.text(`Landmark: ${order.address.landmark}`, MARGIN, y);
    y += 13;
  }
  
  doc.text(`${order.address.city}, ${order.address.state} - ${order.address.pincode}`, MARGIN, y);
  
  y += 13;
  
  if (order.address.phone) {
    doc
      .fillColor(COLORS.accent)
      .font("Helvetica-Bold")
      .text(`Phone: ${order.address.phone}`, MARGIN, y);
    y += 13;
  }
  
  // Right side: Delivery Info
  const rightX = PAGE_WIDTH - MARGIN - 150;
  let rightY = y - 60;
  
  doc
    .fontSize(10)
    .fillColor(COLORS.secondary)
    .font("Helvetica-Bold")
    .text("DELIVERY INFO", rightX, rightY, { width: 150, align: "right" });
  
  rightY += 15;
  
  doc
    .fontSize(9)
    .fillColor(COLORS.text)
    .font("Helvetica")
    .text(`Payment: ${order.paymentMethod.toUpperCase()}`, rightX, rightY, { width: 150, align: "right" });
  
  rightY += 12;
  
  if (order.deliveryOtp) {
    doc
      .fontSize(14)
      .fillColor(COLORS.accent)
      .font("Helvetica-Bold")
      .text(`OTP: ${order.deliveryOtp}`, rightX, rightY, { width: 150, align: "right" });
    rightY += 18;
  }
  
  y = Math.max(y, rightY) + 15;
  
  drawLine(doc, y);
  y += 15;
  
  // ==================== ITEMS TABLE ====================
  // Table Header
  const tableConfig = {
    columns: [
      { key: "item", label: "Item", width: 250 },
      { key: "qty", label: "Qty", width: 60, align: "center" },
      { key: "notes", label: "Notes", width: 150, align: "left" },
    ],
    rowHeight: 25,
    headerHeight: 25,
  };
  
  // Draw header background
  drawRect(doc, MARGIN, y, CONTENT_WIDTH, tableConfig.headerHeight, COLORS.headerBg);
  
  // Draw header text
  let x = MARGIN;
  doc
    .fontSize(10)
    .fillColor(COLORS.primary)
    .font("Helvetica-Bold");
  
  for (const col of tableConfig.columns) {
    doc.text(col.label, x, y + 7, {
      width: col.width,
      align: (col.align as any) || "left",
    });
    x += col.width;
  }
  
  y += tableConfig.headerHeight;
  
  // Draw rows
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.text);
  
  const items = order.items || [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Alternate row background
    if (i % 2 === 1) {
      drawRect(doc, MARGIN, y, CONTENT_WIDTH, tableConfig.rowHeight, COLORS.lightGray);
    }
    
    x = MARGIN;
    
    // Item name
    const itemName = item.name || item.productName || "Unknown Item";
    doc.text(itemName, x + 5, y + 7, { width: tableConfig.columns[0].width - 10 });
    x += tableConfig.columns[0].width;
    
    // Quantity
    const qty = item.qty || item.quantity || 1;
    doc.text(qty.toString(), x, y + 7, {
      width: tableConfig.columns[1].width,
      align: "center",
    });
    x += tableConfig.columns[1].width;
    
    // Notes (empty for packing team to fill)
    doc.text("", x + 5, y + 7, { width: tableConfig.columns[2].width - 10 });
    
    y += tableConfig.rowHeight;
    
    // Check if we need a new page
    if (y > PAGE_HEIGHT - 150) {
      doc.addPage();
      y = MARGIN;
    }
  }
  
  // Draw table bottom border
  drawLine(doc, y);
  y += 20;
  
  // ==================== TOTAL ITEMS ====================
  const totalItems = items.reduce((sum, item) => sum + (item.qty || item.quantity || 1), 0);
  
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .fillColor(COLORS.primary)
    .text(`Total Items: ${totalItems}`, MARGIN, y);
  
  y += 30;
  
  // ==================== CHECKBOXES ====================
  const checkboxes = [
    "Items verified",
    "Packing complete",
    "Invoice included",
    "Address label attached",
  ];
  
  doc
    .fontSize(10)
    .fillColor(COLORS.secondary)
    .font("Helvetica-Bold")
    .text("CHECKLIST:", MARGIN, y);
  
  y += 15;
  
  for (const label of checkboxes) {
    // Draw checkbox
    doc
      .strokeColor(COLORS.border)
      .lineWidth(1)
      .rect(MARGIN + 5, y, 12, 12)
      .stroke();
    
    doc
      .fontSize(9)
      .fillColor(COLORS.text)
      .font("Helvetica")
      .text(label, MARGIN + 25, y + 1);
    
    y += 18;
  }
  
  y += 20;
  
  // ==================== FOOTER ====================
  // Check if we need to move to next page for footer
  if (y > PAGE_HEIGHT - 80) {
    doc.addPage();
    y = MARGIN;
  }
  
  // Instructions
  doc
    .fontSize(9)
    .fillColor(COLORS.secondary)
    .font("Helvetica")
    .text("Instructions:", MARGIN, y);
  
  y += 12;
  
  const instructions = [
    "• Verify all items before packing",
    "• Handle fragile items with care",
    "• Seal package securely",
    "• Attach shipping label on top",
  ];
  
  for (const instruction of instructions) {
    doc
      .fontSize(8)
      .text(instruction, MARGIN, y);
    y += 11;
  }
  
  // Packed by signature area (Right side)
  const sigX = PAGE_WIDTH - MARGIN - 180;
  let sigY = y - 60;
  
  doc
    .fontSize(9)
    .fillColor(COLORS.secondary)
    .text("Packed By:", sigX, sigY);
  
  sigY += 30;
  
  drawLine(doc, sigY, sigX, sigX + 180);
  
  sigY += 5;
  
  doc
    .fontSize(8)
    .text("Name & Signature", sigX, sigY, { width: 180, align: "center" });
  
  // Finalize
  doc.end();
  
  return createPdfStream(doc);
}

export default {
  generatePackingSlipPdf,
};
