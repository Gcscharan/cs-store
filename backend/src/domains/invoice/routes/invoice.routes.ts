import express, { Request, Response, NextFunction } from "express";
import { Order } from "../../../models/Order";
import { authenticateToken, requireRole } from "../../../middleware/auth";
import { generateInvoiceForOrder, getInvoiceData } from "../services/invoiceService";
import { generateInvoicePdf } from "../services/pdfGenerator";
import { generatePackingSlipPdf } from "../services/packingSlipGenerator";

const router = express.Router();

// Admin role middleware
const requireAdmin = requireRole(["admin"]);

/**
 * GET /api/orders/:id/invoice
 * 
 * Download GST invoice PDF for an order.
 * 
 * Access Control:
 * - Order owner (customer) can download
 * - Admin can download any invoice
 * 
 * Invoice is generated on first request if not already generated.
 */
router.get(
  "/:id/invoice",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;
      
      // Fetch order to check ownership
      const order = await Order.findById(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Check access: owner or admin
      const isOwner = order.userId.toString() === userId;
      const isAdmin = userRole === "admin";
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      // Check if order is paid
      if (order.paymentStatus !== "PAID") {
        return res.status(400).json({ 
          error: "Invoice not available",
          message: "Invoice can only be generated for paid orders" 
        });
      }
      
      // Generate invoice if not already generated
      if (!order.invoiceNumber) {
        const result = await generateInvoiceForOrder(id);
        
        if (!result.success) {
          return res.status(500).json({ 
            error: "Invoice generation failed",
            message: result.error 
          });
        }
      }
      
      // Get invoice data
      const invoiceData = await getInvoiceData(id);
      
      if (!invoiceData) {
        return res.status(500).json({ error: "Failed to retrieve invoice data" });
      }
      
      // Generate PDF
      const pdfStream = generateInvoicePdf(invoiceData);
      
      // Set response headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="invoice-${invoiceData.invoiceNumber}.pdf"`
      );
      
      // Pipe PDF stream to response
      pdfStream.pipe(res);
      
    } catch (error) {
      console.error("[Invoice] Error generating invoice:", error);
      next(error);
    }
  }
);

/**
 * GET /api/orders/:id/invoice/preview
 * 
 * Get invoice data as JSON (for preview/debugging)
 */
router.get(
  "/:id/invoice/preview",
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.userId;
      const userRole = (req as any).user?.role;
      
      const order = await Order.findById(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      const isOwner = order.userId.toString() === userId;
      const isAdmin = userRole === "admin";
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      if (!order.invoiceNumber) {
        return res.status(404).json({ 
          error: "Invoice not generated",
          message: "Invoice will be generated when order is paid" 
        });
      }
      
      const invoiceData = await getInvoiceData(id);
      
      res.json(invoiceData);
      
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/orders/:id/packing-slip
 * 
 * Download packing slip PDF for an order.
 * 
 * Packing slip contains:
 * - Order items (no prices)
 * - Shipping address
 * - Order ID
 * 
 * Access Control:
 * - Admin only (for operations team)
 */
router.get(
  "/:id/packing-slip",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      const order = await Order.findById(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      // Generate packing slip PDF
      const pdfStream = generatePackingSlipPdf(order);
      
      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="packing-slip-${order._id}.pdf"`
      );
      
      pdfStream.pipe(res);
      
    } catch (error) {
      console.error("[PackingSlip] Error generating packing slip:", error);
      next(error);
    }
  }
);

/**
 * POST /api/orders/:id/invoice/generate
 * 
 * Manually trigger invoice generation (admin only)
 * Useful for regenerating invoices after data fixes
 */
router.post(
  "/:id/invoice/generate",
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { force } = req.body;
      
      const order = await Order.findById(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      if (order.paymentStatus !== "PAID") {
        return res.status(400).json({ 
          error: "Cannot generate invoice",
          message: "Order must be paid before invoice can be generated" 
        });
      }
      
      if (order.invoiceNumber && !force) {
        return res.status(400).json({ 
          error: "Invoice already exists",
          invoiceNumber: order.invoiceNumber,
          message: "Use force: true to regenerate (not recommended)" 
        });
      }
      
      const result = await generateInvoiceForOrder(id);
      
      if (!result.success) {
        return res.status(500).json({ 
          error: "Invoice generation failed",
          message: result.error 
        });
      }
      
      res.json({
        success: true,
        invoiceNumber: result.invoiceNumber,
        message: "Invoice generated successfully"
      });
      
    } catch (error) {
      next(error);
    }
  }
);

export default router;
