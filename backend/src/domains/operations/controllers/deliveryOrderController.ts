import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { Order } from "../../../models/Order";
import { DeliveryBoy } from "../../../models/DeliveryBoy";
import { User } from "../../../models/User";
import Notification from "../../../models/Notification";
import { AuthRequest } from "../../../middleware/auth";
import { sendSMS } from "../../../utils/sms";
import { sendEmailOTP } from "../../../utils/sendEmailOTP";
import { sendDeliveryOtpEmail } from "../../../utils/sendDeliveryOtpEmail";
import { dispatchNotification } from "../../communication/services/notificationService";
import { deliveryPartnerLoadService } from "../services/deliveryPartnerLoadService";
import { orderStateService } from "../../orders/services/orderStateService";
import { OrderStatus } from "../../orders/enums/OrderStatus";

/**
 * Get delivery boy info
 * GET /api/delivery/info
 */
export const getDeliveryBoyInfo = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Find delivery boy record - ONLY active ones
    const deliveryBoy = await DeliveryBoy.findOne({ 
      userId: user._id,
      isActive: true 
    });
    
    if (!deliveryBoy) {
      console.log(`[GET_INFO] Delivery profile not found for user: ${user._id}`);
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    console.log(`[GET_INFO] Fetching info for delivery boy: ${deliveryBoy._id} (${deliveryBoy.name})`);

    res.json({
      success: true,
      deliveryBoy: {
        id: deliveryBoy._id,
        name: deliveryBoy.name,
        phone: deliveryBoy.phone,
        email: deliveryBoy.email,
        vehicleType: deliveryBoy.vehicleType,
        availability: deliveryBoy.availability,
        currentLoad: deliveryBoy.currentLoad,
        earnings: deliveryBoy.earnings,
        completedOrdersCount: deliveryBoy.completedOrdersCount,
        isActive: deliveryBoy.isActive,
        currentLocation: deliveryBoy.currentLocation,
      },
    });
  } catch (error) {
    console.error("Get delivery boy info error:", error);
    res.status(500).json({
      error: "Failed to fetch delivery info. Please try again later.",
    });
  }
};

/**
 * Get delivery boy's assigned orders
 * GET /api/delivery/orders
 */
export const getDeliveryOrders = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Find delivery boy record - ONLY active ones
    const deliveryBoy = await DeliveryBoy.findOne({ 
      userId: user._id,
      isActive: true 
    });
    if (!deliveryBoy) {
      console.log(`[GET_ORDERS] Delivery profile not found for user: ${user._id}`);
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    console.log(`[GET_ORDERS] Fetching orders for delivery boy: ${deliveryBoy._id} (${deliveryBoy.name}) with userId: ${user._id}`);

    // Get all orders assigned to this delivery boy
    // Note: deliveryBoyId in orders stores the User ID (for population), not DeliveryBoy ID
    const orders = await Order.find({
      deliveryBoyId: user._id,
      orderStatus: { $nin: ["cancelled", "delivered"] },
    })
      .populate("userId", "name phone")
      .sort({ createdAt: -1 });

    console.log(`[GET_ORDERS] Found ${orders.length} orders for userId ${user._id} (deliveryBoy ${deliveryBoy._id})`);
    orders.forEach(order => {
      console.log(`  - Order ${order._id}: status=${order.orderStatus}, deliveryStatus=${order.deliveryStatus}`);
    });

    res.json({
      success: true,
      deliveryBoy: {
        id: deliveryBoy._id,
        name: deliveryBoy.name,
        availability: deliveryBoy.availability,
        earnings: deliveryBoy.earnings,
      },
      orders,
    });
  } catch (error) {
    console.error("Get delivery orders error:", error);
    res.status(500).json({
      error: "Failed to fetch orders. Please try again later.",
    });
  }
};

/**
 * Accept an order assignment
 * POST /api/delivery/orders/:orderId/accept
 */
export const acceptOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  throw new Error(
    "Order status mutation is frozen. Use orderStateService.transition()"
  );
};

/**
 * Reject an order assignment
 * POST /api/delivery/orders/:orderId/reject
 */
export const rejectOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Find delivery boy record
    const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id, isActive: true });
    if (!deliveryBoy) {
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Add to assignment history
    order.assignmentHistory.push({
      riderId: deliveryBoy._id,
      offeredAt: new Date(),
      rejectedAt: new Date(),
      status: "rejected",
    } as any);

    await order.save();

    // Emit socket event to reassign
    const io = (req as any).app.get("io");
    if (io) {
      io.to("admin_room").emit("order:rejected", {
        orderId: order._id,
        deliveryBoyId: deliveryBoy._id,
        reason,
      });
    }

    res.json({
      success: true,
      message: "Order rejected",
    });
  } catch (error) {
    console.error("Reject order error:", error);
    res.status(500).json({
      error: "Failed to reject order. Please try again later.",
    });
  }
};

/**
 * Update delivery boy location
 * PUT /api/delivery/location
 */
export const updateLocation = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { lat, lng } = req.body;
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    if (!lat || !lng) {
      res.status(400).json({
        error: "Latitude and longitude are required",
      });
      return;
    }

    // Find delivery boy record
    const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id, isActive: true });
    if (!deliveryBoy) {
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    // Update location
    deliveryBoy.currentLocation = {
      lat,
      lng,
      lastUpdatedAt: new Date(),
    };

    await deliveryBoy.save();

    // Emit socket event for real-time tracking
    const io = (req as any).app.get("io");
    if (io) {
      io.emit("driver_location_update", {
        driverId: deliveryBoy._id,
        lat,
        lng,
      });
    }

    res.json({
      success: true,
      message: "Location updated",
    });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({
      error: "Failed to update location. Please try again later.",
    });
  }
};

/**
 * Toggle delivery boy online/offline status
 * PUT /api/delivery/status
 */
export const toggleStatus = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { isOnline } = req.body;
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Find delivery boy record
    const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id, isActive: true });
    if (!deliveryBoy) {
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    // Update availability
    deliveryBoy.availability = isOnline ? "available" : "offline";
    await deliveryBoy.save();

    // Emit socket event
    const io = (req as any).app.get("io");
    if (io) {
      io.to("admin_room").emit("driver:status:update", {
        driverId: deliveryBoy._id,
        availability: deliveryBoy.availability,
      });
    }

    res.json({
      success: true,
      message: `Status updated to ${deliveryBoy.availability}`,
      availability: deliveryBoy.availability,
    });
  } catch (error) {
    console.error("Toggle status error:", error);
    res.status(500).json({
      error: "Failed to update status. Please try again later.",
    });
  }
};

/**
 * Get delivery boy earnings
 * GET /api/delivery/earnings
 */
export const getEarnings = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { from, to } = req.query;
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    // Find delivery boy record
    const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id, isActive: true });
    if (!deliveryBoy) {
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    // Build query for orders
    const query: any = {
      deliveryBoyId: user._id,
      orderStatus: "delivered",
    };

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from as string);
      if (to) query.createdAt.$lte = new Date(to as string);
    }

    // Get completed orders
    const orders = await Order.find(query).sort({ createdAt: -1 });

    // Calculate earnings
    const totalEarnings = orders.reduce(
      (sum, order) => sum + (order.earnings?.deliveryFee || 0),
      0
    );
    const totalTips = orders.reduce(
      (sum, order) => sum + (order.earnings?.tip || 0),
      0
    );

    res.json({
      success: true,
      earnings: {
        total: deliveryBoy.earnings,
        deliveryFees: totalEarnings,
        tips: totalTips,
        completedOrders: deliveryBoy.completedOrdersCount,
      },
      orders: orders.map((order) => ({
        _id: order._id,
        amount: order.totalAmount,
        deliveryFee: order.earnings?.deliveryFee || 0,
        tip: order.earnings?.tip || 0,
        createdAt: order.createdAt,
        address: order.address,
      })),
    });
  } catch (error) {
    console.error("Get earnings error:", error);
    res.status(500).json({
      error: "Failed to fetch earnings. Please try again later.",
    });
  }
};

/**
 * Mark order as picked up
 * POST /api/delivery/orders/:orderId/pickup
 */
export const pickupOrder = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  throw new Error(
    "Order status mutation is frozen. Use orderStateService.transition()"
  );
};

/**
 * Start delivery (in transit)
 * POST /api/delivery/orders/:orderId/start-delivery
 */
export const startDelivery = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const order = await orderStateService.transition({
      orderId,
      toStatus: OrderStatus.OUT_FOR_DELIVERY,
      actorRole: "DELIVERY_PARTNER",
      actorId: String(user._id),
    });

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    next(error as any);
  }
};

/**
 * Mark as arrived at delivery location
 * POST /api/delivery/orders/:orderId/arrived
 */
export const markArrived = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  throw new Error(
    "Order status mutation is frozen. Use orderStateService.transition()"
  );
};

/**
 * Complete delivery with OTP verification
 * POST /api/delivery/orders/:orderId/complete
 */
export const completeDelivery = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { otp, photoUrl, signature, geo, deviceId } = (req as any).body || {};
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const order = await orderStateService.transition({
      orderId,
      toStatus: OrderStatus.DELIVERED,
      actorRole: "DELIVERY_PARTNER",
      actorId: String(user._id),
      meta: {
        otp,
        photoUrl,
        signature,
        geo,
        deviceId,
      },
    });

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    next(error as any);
  }
};

/**
 * Fail delivery
 * POST /api/delivery/orders/:orderId/fail
 */
export const failDelivery = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { failureReasonCode, failureNotes } = (req as any).body || {};
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const order = await orderStateService.transition({
      orderId,
      toStatus: OrderStatus.FAILED,
      actorRole: "DELIVERY_PARTNER",
      actorId: String(user._id),
      meta: {
        failureReasonCode,
        failureNotes,
      },
    });

    res.json({
      success: true,
      order,
    });
  } catch (error) {
    next(error as any);
  }
};

/**
 * REMOVED: Resend OTP for delivery verification
 * This was part of the arrived status workflow which has been removed
 * POST /api/delivery/orders/:orderId/resend-otp
 */
/* COMMENTED OUT - ARRIVED STATUS REMOVED
export const resendDeliveryOTP = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { orderId } = req.params;
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }

    const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id, isActive: true });
    if (!deliveryBoy) {
      res.status(404).json({ error: "Delivery profile not found" });
      return;
    }

    const order = await Order.findById(orderId).populate('userId');
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Verify ownership
    if (order.deliveryBoyId?.toString() !== user._id.toString()) {
      res.status(403).json({ error: "You are not assigned to this order" });
      return;
    }

    // Only allow resend if order is in arrived status
    if (order.deliveryStatus !== "arrived") {
      res.status(400).json({ 
        error: `Can only resend OTP when status is arrived. Current status: ${order.deliveryStatus}` 
      });
      return;
    }

    // Generate new 4-digit OTP
    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    order.deliveryOtp = newOtp;
    order.deliveryOtpExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    
    await order.save();

    // Send OTP to customer via SMS and Email
    const customer = order.userId as any;
    
    console.log('='.repeat(80));
    console.log(`🔔 RESENDING DELIVERY OTP - ORDER ${orderId}`);
    console.log('='.repeat(80));
    console.log(`📦 Order ID: ${orderId}`);
    console.log(`🔑 New OTP: ${order.deliveryOtp}`);
    console.log(`⏰ OTP Expires: ${order.deliveryOtpExpiresAt}`);
    console.log(`👤 Customer Details:`);
    console.log(`   - Name: ${customer?.name || 'N/A'}`);
    console.log(`   - Email: ${customer?.email || 'N/A'}`);
    console.log(`   - Phone: ${customer?.phone || 'N/A'}`);
    console.log('='.repeat(80));
    
    if (customer && customer.phone) {
      const smsMessage = `Your CS Store delivery OTP has been resent. Your OTP is ${order.deliveryOtp}. Valid for 30 minutes.`;
      try {
        await sendSMS(customer.phone, smsMessage);
        console.log(`✅ OTP resent via SMS to customer ${customer.phone}`);
      } catch (smsError) {
        console.error("❌ Failed to resend SMS OTP:", smsError);
      }
    } else {
      console.log(`⚠️ No phone number available for customer`);
    }

    if (customer && customer.email) {
      try {
        await sendEmailOTP(customer.email, order.deliveryOtp);
        console.log(`✅ OTP resent via email to customer ${customer.email}`);
      } catch (emailError) {
        console.error("❌ Failed to resend email OTP:", emailError);
      }
    } else {
      console.log(`⚠️ No email available for customer`);
    }
    
    console.log('='.repeat(80));
    
    // Determine what was actually sent
    const sentToPhone = customer && customer.phone;
    const sentToEmail = customer && customer.email;
    let notificationMessage = "New OTP:";
    let responseMessage = "OTP resent";
    
    if (sentToPhone && sentToEmail) {
      notificationMessage = "New OTP sent to your phone and email.";
      responseMessage += " to customer's phone and email";
    } else if (sentToEmail) {
      notificationMessage = "New OTP sent to your email.";
      responseMessage += " to customer's email";
    } else if (sentToPhone) {
      notificationMessage = "New OTP sent to your phone.";
      responseMessage += " to customer's phone";
    } else {
      notificationMessage = `Your OTP is: ${order.deliveryOtp}`;
      responseMessage += " (no contact info available)";
    }

    // Emit socket event
    const io = (req as any).app.get("io");
    if (io) {
      io.to(`user_${order.userId}`).emit("order:otpResent", {
        orderId: order._id,
        message: notificationMessage,
        otp: !sentToPhone && !sentToEmail ? order.deliveryOtp : undefined,
      });
    }

    res.json({
      success: true,
      message: responseMessage,
      otp: order.deliveryOtp, // Include OTP in response for testing
      otpSentTo: {
        email: sentToEmail ? customer.email : null,
        phone: sentToPhone ? customer.phone : null,
      },
    });
  } catch (error) {
    console.error("Resend OTP error:", error);
    res.status(500).json({ error: "Failed to resend OTP" });
  }
};
*/
