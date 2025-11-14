import { Request, Response } from "express";
import Otp from "../../../models/Otp";
import { Order } from "../../../models/Order";
import { User } from "../../../models/User";
import { generateOTP, sendSMS } from "../../../utils/sms";
import { validateCard } from "../../../utils/cardValidation";
// import SocketService from "../services/socketService";

// Generate OTP for payment verification
export const generatePaymentOTP = async (req: Request, res: Response) => {
  try {
    const { orderId, cardNumber, cardHolderName, expiryDate, cvv } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ message: "User not authenticated" });
      return;
    }

    if (!orderId || !cardNumber || !cardHolderName || !expiryDate || !cvv) {
      res.status(400).json({
        message:
          "Order ID, card number, card holder name, expiry date, and CVV are required",
      });
      return;
    }

    // Validate card details
    const cardValidation = validateCard(
      cardNumber,
      expiryDate,
      cvv,
      cardHolderName
    );
    if (!cardValidation.isValid) {
      res.status(400).json({
        message: "Invalid card details",
        errors: cardValidation.errors,
      });
      return;
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Get order details
    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    // Check if order belongs to user
    if (order.userId.toString() !== userId) {
      res.status(403).json({ message: "Unauthorized access to order" });
      return;
    }

    // Generate 6-digit OTP
    const otp = generateOTP();

    // Create OTP record
    const otpRecord = new Otp({
      phone: user.phone,
      otp,
      type: "payment",
      orderId: order._id,
      paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    await otpRecord.save();

    // Send OTP via SMS (fallback)
    const message = `Your CS Store payment OTP is ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
    await sendSMS(user.phone, message);

    // Send OTP via WebSocket for real-time delivery (disabled for now)
    // const socketService = (req as any).app.get(
    //   "socketService"
    // ) as any;
    const otpData = {
      paymentId: otpRecord.paymentId,
      orderId: order._id,
      amount: order.totalAmount,
      cardLast4: cardNumber.slice(-4),
      cardHolderName,
      expiresIn: 600,
      timestamp: new Date().toISOString(),
    };

    // Try real-time delivery first (disabled for now)
    const realTimeDelivered = false; // socketService.sendOTPToUser(userId, otpData);

    if (realTimeDelivered) {
      console.log(`📱 OTP delivered in real-time to user ${userId}`);
    } else {
      console.log(`⚠️ User ${userId} not connected, OTP sent via SMS only`);
    }

    res.status(200).json({
      message: realTimeDelivered
        ? "OTP sent successfully (real-time)"
        : "OTP sent successfully (SMS)",
      paymentId: otpRecord.paymentId,
      expiresIn: 600, // 10 minutes in seconds
      realTimeDelivered,
    });
    return;
  } catch (error) {
    console.error("Generate payment OTP error:", error);
    res.status(500).json({ message: "Failed to generate OTP" });
    return;
  }
};

// Verify OTP for payment
export const verifyPaymentOTP = async (req: Request, res: Response) => {
  try {
    const { paymentId, otp } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!paymentId || !otp) {
      return res.status(400).json({
        message: "Payment ID and OTP are required",
      });
    }

    // Find OTP record
    const otpRecord = await Otp.findOne({
      paymentId,
      type: "payment",
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (!otpRecord) {
      return res.status(400).json({
        message: "Invalid or expired OTP",
      });
    }

    // Check attempts
    if (otpRecord.attempts >= 3) {
      return res.status(400).json({
        message: "Maximum OTP attempts exceeded. Please generate a new OTP.",
      });
    }

    // Verify OTP
    if (otpRecord.otp !== otp) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        message: `Invalid OTP. ${3 - otpRecord.attempts} attempts remaining.`,
      });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Get order details
    const order = await Order.findById(otpRecord.orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Update order status
    order.paymentStatus = "paid";
    await order.save();

    // Send real-time verification result (disabled for now)
    // const socketService = (req as any).app.get(
    //   "socketService"
    // ) as any;
    const verificationResult = {
      success: true,
      orderId: order._id,
      paymentId,
      amount: order.totalAmount,
      status: "verified",
      timestamp: new Date().toISOString(),
    };

    // socketService.sendOTPVerificationResult(userId, verificationResult);
    // socketService.sendPaymentStatusUpdate(userId, {
    //   orderId: order._id,
    //   status: "paid",
    //   paymentId,
    //   amount: order.totalAmount,
    // });

    res.status(200).json({
      message: "Payment verified successfully",
      orderId: order._id,
      paymentId,
      amount: order.totalAmount,
    });
    return;
  } catch (error) {
    console.error("Verify payment OTP error:", error);
    res.status(500).json({ message: "Failed to verify OTP" });
    return;
  }
};

// Resend OTP
export const resendPaymentOTP = async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!paymentId) {
      return res.status(400).json({ message: "Payment ID is required" });
    }

    // Find existing OTP record
    const existingOtp = await Otp.findOne({
      paymentId,
      type: "payment",
      isUsed: false,
    });

    if (!existingOtp) {
      return res.status(404).json({ message: "Payment session not found" });
    }

    // Check if resend is allowed (not too frequent)
    const timeSinceLastUpdate = Date.now() - existingOtp.updatedAt.getTime();
    if (timeSinceLastUpdate < 30000) {
      // 30 seconds
      return res.status(400).json({
        message: "Please wait 30 seconds before resending OTP",
      });
    }

    // Generate new OTP
    const newOtp = generateOTP();
    existingOtp.otp = newOtp;
    existingOtp.attempts = 0;
    existingOtp.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await existingOtp.save();

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Send new OTP via SMS (fallback)
    const message = `Your CS Store payment OTP is ${newOtp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
    await sendSMS(user.phone, message);

    // Send OTP via WebSocket for real-time delivery (disabled for now)
    // const socketService = (req as any).app.get(
    //   "socketService"
    // ) as any;
    const otpData = {
      paymentId: existingOtp.paymentId,
      orderId: existingOtp.orderId,
      expiresIn: 600,
      timestamp: new Date().toISOString(),
      isResend: true,
    };

    // Try real-time delivery (disabled for now)
    const realTimeDelivered = false; // socketService.sendOTPToUser(userId, otpData);

    if (realTimeDelivered) {
      console.log(`📱 OTP resent in real-time to user ${userId}`);
    } else {
      console.log(`⚠️ User ${userId} not connected, OTP resent via SMS only`);
    }

    res.status(200).json({
      message: realTimeDelivered
        ? "OTP resent successfully (real-time)"
        : "OTP resent successfully (SMS)",
      expiresIn: 600, // 10 minutes in seconds
      realTimeDelivered,
    });
    return;
  } catch (error) {
    console.error("Resend payment OTP error:", error);
    res.status(500).json({ message: "Failed to resend OTP" });
    return;
  }
};
