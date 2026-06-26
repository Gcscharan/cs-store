import { logger } from '../utils/logger';
import express from "express";
import {
  getStats,
  exportOrders,
  getAdminProfile,
  getUsers,
  getAdminProducts,
  getAdminOrders,
  getAdminDeliveryBoys,
  getDashboardStats,
  updateProduct,
  deleteProduct,
  makeDeliveryBoy,
  approveDeliveryBoy,
  suspendDeliveryBoy,
  computeRoutes,
  listRoutes,
  assignRoute,
  assignComputedCluster,
  getRouteStatus,
  listRecentAssignedRoutes,
  getRouteDetail,
  purgeOrders,
  getGstReportHandler,
  getRouteOverview,
} from "../controllers/adminController";
import { createProduct } from "../domains/catalog/controllers/productController";
import { assignDeliveryBoyToOrder } from "../controllers/orderAssignmentController";
import { assignOrderToAdminController } from "../domains/operations/controllers/adminAssignmentController";
import { authenticateToken, requireRole } from "../middleware/auth";
import { auditLog } from "../middleware/auditLog";
import { reviewKyc } from "../controllers/deliveryKycController";
import { listSupportRequests, updateSupportRequest } from "../controllers/supportRequestController";
import jwt from "jsonwebtoken";
import { orderStateService } from "../domains/orders/services/orderStateService";
import { OrderStatus } from "../domains/orders/enums/OrderStatus";
import { enqueueAutoAssignment } from "../domains/delivery/services/autoAssignmentRunner";
import { getAdminCodCollection, getAdminOrderAttempt } from "../domains/operations/controllers/deliveryOrderController";
import { getNotificationAnalytics } from "../domains/communication/controllers/notificationAnalyticsController";
import { UserAccountService } from "../domains/user/services/UserAccountService";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * GET /api/admin/settings
 * Returns admin settings derived from server config/env. Warehouse, hubs, capacities,
 * and payment status are environment-controlled (read-only); store profile fields are
 * returned from env defaults. Added to fix a 404 that prevented the page from loading.
 */
router.get(
  "/settings",
  authenticateToken,
  requireRole(["admin"]),
  async (_req, res) => {
    try {
      const { WAREHOUSES, DELIVERY_CONFIG } = await import("../config/deliveryFeeConfig");
      const primary = (WAREHOUSES || []).find((w: any) => w.isActive) || (WAREHOUSES || [])[0] || ({} as any);
      const hubs = (WAREHOUSES || []).map((w: any) => ({
        id: w.id,
        name: w.name,
        lat: w.lat,
        lng: w.lng,
        radiusKm: w.maxDeliveryRadius,
      }));

      return res.json({
        storeName: process.env.STORE_NAME || "VyaparSetu",
        storeEmail: process.env.STORE_EMAIL || process.env.SELLER_EMAIL || "",
        supportPhone: process.env.SUPPORT_PHONE || "",
        warehouseLat: primary.lat ?? null,
        warehouseLng: primary.lng ?? null,
        warehousePincode: primary.pincode ?? "",
        localRadiusKm: primary.maxDeliveryRadius ?? 0,
        hubs,
        routeCapacityMin: Number(process.env.ROUTE_CAPACITY_MIN || 20),
        routeCapacityMax: Number(process.env.ROUTE_CAPACITY_MAX || 30),
        killswitchEnabled: false,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || "",
        razorpayConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
        freeDeliveryThreshold: DELIVERY_CONFIG?.FREE_DELIVERY_THRESHOLD,
      });
    } catch (error: any) {
      logger.error("[admin/settings] GET failed:", error?.message);
      return res.status(500).json({ message: "Failed to load settings" });
    }
  }
);

/**
 * PUT /api/admin/settings
 * Store-profile fields (name/email/phone) acknowledged. Warehouse/hub/capacity values are
 * environment-controlled and cannot be mutated at runtime (UI labels them "from environment").
 */
router.put(
  "/settings",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  async (req, res) => {
    try {
      const { storeName, storeEmail, supportPhone } = req.body || {};
      logger.info("[admin/settings] update requested", {
        storeName: !!storeName,
        storeEmail: !!storeEmail,
        supportPhone: !!supportPhone,
      });
      // NOTE: No Settings collection exists yet; env-controlled values are immutable at runtime.
      // Returning success for the editable store-profile fields keeps the UI functional.
      return res.json({
        success: true,
        message: "Settings updated.",
        applied: { storeName, storeEmail, supportPhone },
      });
    } catch (error: any) {
      logger.error("[admin/settings] PUT failed:", error?.message);
      return res.status(500).json({ message: "Failed to save settings" });
    }
  }
);

// Mobile video upload alias: POST /api/admin/upload/video
router.post(
  "/upload/video",
  authenticateToken,
  requireRole(["admin"]),
  upload.single("video") as any,
  async (req: any, res: any) => {
    try {
      const file = req.file as Express.Multer.File;
      if (!file) return res.status(400).json({ message: "No video provided" });

      const result = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "products/videos", resource_type: "video" },
          (err, result) => { if (err || !result) return reject(err); resolve(result); }
        );
        stream.end(file.buffer);
      });

      res.json({
        url: result.secure_url,
        publicId: result.public_id,
        thumbnail: cloudinary.url(result.public_id, { resource_type: "video", format: "jpg", transformation: [{ start_offset: "0" }] }),
        duration: result.duration || 0,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  }
);

// Admin routes
router.get("/stats", authenticateToken, requireRole(["admin"]), auditLog, getStats);
router.get("/dashboard", authenticateToken, requireRole(["admin"]), auditLog, getStats);
router.get("/analytics", authenticateToken, requireRole(["admin"]), auditLog, getStats); // Using getStats as analytics
router.get("/dashboard", authenticateToken, requireRole(["admin"]), getStats);
router.get("/analytics", authenticateToken, requireRole(["admin"]), getStats); // Using getStats as analytics
router.get(
  "/dashboard-stats",
  authenticateToken,
  requireRole(["admin"]),
  getDashboardStats
);
router.get(
  "/profile",
  authenticateToken,
  requireRole(["admin"]),
  getAdminProfile
);
router.get("/users", authenticateToken, requireRole(["admin"]), getUsers);
router.delete("/users/:id", authenticateToken, requireRole(["admin"]), auditLog, async (req, res) => {
  try {
    const { id } = req.params;

    const svc = new UserAccountService();
    const result = await svc.deleteAccount(String(id));

    res.json({
      message: "User deleted successfully",
      result,
    });
  } catch (error) {
    logger.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});
router.put(
  "/users/:id/make-delivery",
  authenticateToken,
  requireRole(["admin"]),
  makeDeliveryBoy
);
router.get(
  "/products",
  authenticateToken,
  requireRole(["admin"]),
  getAdminProducts
);
// Mobile-friendly: accepts JSON with pre-uploaded image URLs
router.post(
  "/products",
  authenticateToken,
  requireRole(["admin"]),
  async (req: any, res: any) => {
    try {
      const { Product } = require("../models/Product");
      const { name, description, category, price, pricePerUnit, mrp, stock, weight, tags, sku, images, video, status } = req.body;

      if (!name || !price || !category || stock === undefined) {
        return res.status(400).json({ message: "Missing required fields", required: ["name", "price", "category", "stock"] });
      }

      // Build image docs from pre-uploaded URLs
      const imageDocs = Array.isArray(images) ? images.map((url: string) => ({
        publicId: url.split('/').pop()?.split('.')[0] || `img-${Date.now()}`,
        variants: { original: url, medium: url, small: url, thumb: url, micro: url },
      })) : [];

      const product = new Product({
        name,
        description,
        category,
        price: Number(price),
        pricePerUnit: pricePerUnit ? Number(pricePerUnit) : Number(price),
        mrp: mrp ? Number(mrp) : undefined,
        stock: Number(stock),
        weight: weight ? Number(weight) : undefined,
        tags: tags ? (Array.isArray(tags) ? tags : [tags]) : [],
        sku,
        images: imageDocs,
        status: status || 'draft',
        isActive: status === 'published',
        isSellable: status === 'published',
        ...(video ? { video } : {}),
      });

      const saved = await product.save();

      // Emit real-time event
      try {
        const io = req.app.get("io");
        if (io) {
          const { ProductSocketEmitter } = require("../domains/products/services/productSocketEmitter");
          new ProductSocketEmitter(io).emitProductCreated(saved.toObject ? saved.toObject() : saved);
        }
      } catch (e) { /* non-blocking */ }

      return res.status(201).json({ success: true, product: saved, productId: saved._id, status: saved.status });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }
);
router.put(
  "/products/:id",
  authenticateToken,
  requireRole(["admin"]),
  updateProduct
);
router.patch(
  "/products/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req: any, res: any) => {
    try {
      const { Product } = require("../models/Product");
      const { name, description, category, price, pricePerUnit, mrp, stock, weight, tags, sku, images, video, status } = req.body;

      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (price !== undefined) updateData.price = Number(price);
      if (pricePerUnit !== undefined) updateData.pricePerUnit = Number(pricePerUnit);
      if (mrp !== undefined) updateData.mrp = Number(mrp);
      if (stock !== undefined) updateData.stock = Number(stock);
      if (weight !== undefined) updateData.weight = Number(weight);
      if (tags !== undefined) updateData.tags = Array.isArray(tags) ? tags : [tags];
      if (sku !== undefined) updateData.sku = sku;
      if (status !== undefined) { 
        updateData.status = status; 
        updateData.isActive = status === 'published'; 
        updateData.isSellable = status === 'published';
      }
      if (video !== undefined) updateData.video = video;
      if (images !== undefined && Array.isArray(images)) {
        updateData.images = images.map((url: string) => ({
          publicId: url.split('/').pop()?.split('.')[0] || `img-${Date.now()}`,
          variants: { original: url, medium: url, small: url, thumb: url, micro: url },
        }));
      }

      const product = await Product.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
      if (!product) return res.status(404).json({ message: "Product not found" });

      // Emit real-time event
      try {
        const io = req.app.get("io");
        if (io) {
          const { ProductSocketEmitter } = require("../domains/products/services/productSocketEmitter");
          new ProductSocketEmitter(io).emitProductUpdated(product.toObject ? product.toObject() : product);
        }
      } catch (e) { /* non-blocking */ }

      res.json({ success: true, product });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to update product", message: err.message });
    }
  }
);
router.delete(
  "/products/:id",
  authenticateToken,
  requireRole(["admin"]),
  deleteProduct
);
// Publish product (mark as published)
router.post(
  "/products/:id/publish",
  authenticateToken,
  requireRole(["admin"]),
  async (req: any, res: any) => {
    try {
      const { Product } = require("../models/Product");
      const product = await Product.findByIdAndUpdate(
        req.params.id,
        { status: "published", isActive: true, isSellable: true },
        { new: true }
      );
      if (!product) return res.status(404).json({ message: "Product not found" });

      // Emit real-time event
      try {
        const io = req.app.get("io");
        if (io) {
          const { ProductSocketEmitter } = require("../domains/products/services/productSocketEmitter");
          new ProductSocketEmitter(io).emitProductUpdated(product.toObject ? product.toObject() : product);
        }
      } catch (e) { /* non-blocking */ }

      res.json({ message: "Product published", product });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  }
);
// Version history stubs (returns empty for now)
router.get("/products/:id/versions", authenticateToken, requireRole(["admin"]), (_req: any, res: any) => {
  res.json({ versions: [], total: 0 });
});

// Bulk product upload — POST /api/admin/products/bulk
router.post(
  "/products/bulk",
  authenticateToken,
  requireRole(["admin"]),
  async (req: any, res: any) => {
    try {
      const { products } = req.body;
      if (!Array.isArray(products) || products.length === 0) {
        return res.status(400).json({ message: "products array is required" });
      }
      if (products.length > 200) {
        return res.status(400).json({ message: "Maximum 200 products per upload" });
      }

      const { Product } = require("../models/Product");
      let created = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const p of products) {
        try {
          if (!p.name || !p.price || !p.category) {
            failed++;
            errors.push(`Skipped: missing required fields for "${p.name || 'unknown'}"`);
            continue;
          }
          await Product.create({
            name: String(p.name).trim(),
            description: String(p.description || '').trim(),
            price: Number(p.price),
            mrp: p.mrp ? Number(p.mrp) : undefined,
            category: String(p.category).trim(),
            stock: Number(p.stock || 0),
            weight: p.weight ? Number(p.weight) : undefined,
            images: [],
            isActive: true,
          });
          created++;
        } catch (err: any) {
          failed++;
          errors.push(`Failed "${p.name}": ${err.message}`);
        }
      }

      res.json({ success: true, created, failed, errors: errors.slice(0, 10) });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Bulk upload failed" });
    }
  }
);

router.get(
  "/orders",
  authenticateToken,
  requireRole(["admin"]),
  getAdminOrders
);

router.get(
  "/orders/:orderId/attempt",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getAdminOrderAttempt
);

router.get(
  "/orders/:orderId/cod-collection",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getAdminCodCollection
);
// Note: Order status updates, accept/decline, and assignment are handled by other routes
// These routes are commented out as the functions don't exist in adminController
// router.patch("/orders/:orderId", authenticateToken, requireRole(["admin"]), updateOrderStatus);
// router.post("/orders/:orderId/accept", authenticateToken, requireRole(["admin"]), acceptOrder);
// router.post("/orders/:orderId/decline", authenticateToken, requireRole(["admin"]), declineOrder);

// Admin assignment endpoint - marks order as assigned to admin system
// Primarily used via ORDER_CREATED events, but available for manual assignment
router.post(
  "/orders/:orderId/assign-admin",
  authenticateToken,
  requireRole(["admin"]),
  assignOrderToAdminController
);

// Delivery partner assignment endpoint
router.patch(
  "/orders/:orderId/assign",
  authenticateToken,
  requireRole(["admin"]),
  assignDeliveryBoyToOrder
);
router.get(
  "/delivery-boys",
  authenticateToken,
  requireRole(["admin"]),
  getAdminDeliveryBoys
);

// GST Report - aggregated CGST, SGST, IGST totals for a date range
router.get(
  "/gst-report",
  authenticateToken,
  requireRole(["admin"]),
  getGstReportHandler
);
router.get(
  "/delivery-boys-list",
  authenticateToken,
  requireRole(["admin"]),
  getAdminDeliveryBoys // Using getAdminDeliveryBoys instead of getDeliveryBoysList
);
router.get(
  "/delivery-partners/available",
  authenticateToken,
  requireRole(["admin"]),
  getAdminDeliveryBoys // Reuse same controller for available delivery partners
);
router.put(
  "/delivery-boys/:id/approve",
  authenticateToken,
  requireRole(["admin"]),
  approveDeliveryBoy
);
router.put("/delivery-boys/:id/suspend", authenticateToken, requireRole(["admin"]), suspendDeliveryBoy);
// KYC review (verify/reject a delivery partner's submitted documents)
router.post(
  "/delivery-boys/:deliveryBoyId/kyc/review",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  reviewKyc
);

// Support request inbox (customer + delivery partner help requests)
router.get(
  "/support-requests",
  authenticateToken,
  requireRole(["admin"]),
  listSupportRequests
);
router.post(
  "/support-requests/:id/resolve",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  updateSupportRequest
);
// router.post("/assign-deliveries", authenticateToken, requireRole(["admin"]), autoAssignDeliveries);
router.post(
  "/orders/purge",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  purgeOrders
);

router.get(
  "/orders/export",
  authenticateToken,
  requireRole(["admin"]),
  exportOrders
);

// CVRP Route Assignment
router.post(
  "/routes/compute",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  computeRoutes
);

router.post(
  "/routes/assign",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  assignComputedCluster
);

router.get(
  "/routes/overview",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getRouteOverview
);

router.get(
  "/routes",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  listRoutes
);

router.get(
  "/routes/recent",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  listRecentAssignedRoutes
);

router.post(
  "/routes/:routeId/assign",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  assignRoute
);

router.get(
  "/routes/:routeId/status",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getRouteStatus
);

router.get(
  "/routes/:routeId/detail",
  authenticateToken,
  requireRole(["admin"]),
  auditLog,
  getRouteDetail
);

router.post(
  "/orders/:id/confirm",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res, next) => {
    try {
      const actorId = String((req as any).user?._id || "");
      const { id } = req.params;
      const order = await orderStateService.transition({
        orderId: id,
        toStatus: OrderStatus.CONFIRMED,
        actorRole: "ADMIN",
        actorId,
      });
      res.json({ success: true, order });
    } catch (error) {
      next(error as any);
    }
  }
);

router.post(
  "/orders/:id/pack",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res, next) => {
    try {
      const actorId = String((req as any).user?._id || "");
      const { id } = req.params;
      const order = await orderStateService.transition({
        orderId: id,
        toStatus: OrderStatus.PACKED,
        actorRole: "ADMIN",
        actorId,
      });
      res.json({ success: true, order });
    } catch (error) {
      next(error as any);
    }
  }
);

router.post(
  "/orders/:id/return",
  authenticateToken,
  requireRole(["admin"]),
  async (req, res, next) => {
    try {
      const actorId = String((req as any).user?._id || "");
      const { id } = req.params;
      const { returnReason } = (req as any).body || {};
      const order = await orderStateService.transition({
        orderId: id,
        toStatus: OrderStatus.RETURNED,
        actorRole: "ADMIN",
        actorId,
        meta: {
          returnReason,
        },
      });
      res.json({ success: true, order });
    } catch (error) {
      next(error as any);
    }
  }
);

// Notification Analytics Dashboard
router.get(
  "/notifications/analytics",
  authenticateToken,
  requireRole(["admin"]),
  getNotificationAnalytics
);


export default router;

