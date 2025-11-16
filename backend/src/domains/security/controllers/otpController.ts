import { Request, Response } from "express";
import Otp from "../../../models/Otp";
import { Order } from "../../../models/Order";
import { User } from "../../../models/User";
import { generateOTP, sendSMS, validatePhoneNumber } from "../../../utils/sms";
import { validateCard } from "../../../utils/cardValidation";
// import SocketService from "../services/socketService";

// Helper: Verify OTP for a given phone and type
export const verifyOtp = async (
  phone: string,
  otp: string,
  type: "payment" | "login" | "verification"
): Promise<{ valid: boolean; error?: string }> => {
  // Find OTP record
  const otpRecord = await Otp.findOne({
    phone,
    type,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpRecord) {
    return { valid: false, error: "Invalid or expired OTP" };
  }

  // Check attempts
  if (otpRecord.attempts >= 3) {
    return { valid: false, error: "Maximum OTP attempts exceeded" };
  }

  // Verify OTP
  if (otpRecord.otp !== otp) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    return {
      valid: false,
      error: `${3 - otpRecord.attempts} attempts remaining. Invalid OTP.`,
    };
  }

  // Mark OTP as used
  otpRecord.isUsed = true;
  await otpRecord.save();

  return { valid: true };
};

// Generate OTP for mobile verification
export const generateVerificationOTP = async (req: Request, res: Response) => {
  try {
    // Support both authenticated users (preferred) and public request with phone
    const authedUserId = (req as any).user?.id || (req as any).userId;
    const { phone: phoneFromBody } = req.body || {};

    let targetPhone: string | null = null;

    if (authedUserId) {
      const user = await User.findById(authedUserId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }
      if (!user.phone) {
        res.status(400).json({ message: "User does not have a registered phone" });
        return;
      }
      targetPhone = user.phone;
    } else if (phoneFromBody) {
      targetPhone = String(phoneFromBody).replace(/\D/g, "");
    }

    if (!targetPhone) {
      res.status(401).json({ message: "User not authenticated and phone not provided" });
      return;
    }

    if (!validatePhoneNumber(targetPhone)) {
      res.status(400).json({ message: "Invalid phone number format" });
      return;
    }

    // Generate 6-digit OTP
    const otp = generateOTP();

    // Create OTP record
    const otpRecord = new Otp({
      phone: targetPhone,
      otp,
      type: "verification",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    await otpRecord.save();

    // Send OTP via SMS
    const message = `Your CS Store verification OTP is ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
    const smsOk = await sendSMS(targetPhone, message);

    if (!smsOk) {
      console.error("❌ Verification OTP SMS failed", {
        phone: targetPhone,
        otpId: otpRecord._id?.toString(),
        env: {
          TWILIO_ACCOUNT_SID_present: !!process.env.TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN_present: !!process.env.TWILIO_AUTH_TOKEN,
          TWILIO_PHONE_NUMBER_present: !!process.env.TWILIO_PHONE_NUMBER,
        },
      });
      // Do not claim success if SMS failed
      res.status(500).json({ message: "Failed to send verification OTP via SMS" });
      return;
    }

    res.status(200).json({
      message: "Verification OTP sent successfully",
      expiresIn: 600,
    });
    return;
  } catch (error: any) {
    console.error("Generate verification OTP error:", {
      name: error?.name,
      message: error?.message,
      stack: error?.stack?.split("\n").slice(0, 2).join(" | "),
    });
    res.status(500).json({ message: "Failed to generate verification OTP" });
    return;
  }
};

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
    const smsOk = await sendSMS(user.phone, message);

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

    if (!smsOk) {
      console.error("❌ Payment OTP SMS failed", {
        phone: user.phone,
        otpId: otpRecord._id?.toString(),
      });
      res.status(500).json({ message: "Failed to send payment OTP via SMS" });
      return;
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
        message: "Invalid OTP. Please try again.",
      });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    return res.status(200).json({
      message: "OTP verified successfully",
      paymentId,
    });
  } catch (error) {
    console.error("Verify payment OTP error:", error);
    return res.status(500).json({ message: "Failed to verify OTP" });
  }
};

// Resend OTP for payment
export const resendPaymentOTP = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { paymentId } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "User not authenticated" });
    }

    if (!paymentId) {
      return res.status(400).json({ message: "Payment ID is required" });
    }

    // Find latest OTP record for the payment
    const existingOtp = await Otp.findOne({ paymentId, type: "payment" }).sort({ createdAt: -1 });

    if (!existingOtp) {
      return res.status(404).json({ message: "No OTP found for this payment" });
    }

    // Generate a new OTP
    const newOtp = generateOTP();
    existingOtp.otp = newOtp;
    existingOtp.isUsed = false;
    existingOtp.attempts = 0;
    existingOtp.expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await existingOtp.save();

    const user = await User.findById(userId);
    if (!user || !user.phone) {
      return res.status(404).json({ message: "User or phone not found" });
    }

    const message = `Your CS Store payment OTP is ${newOtp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
    const smsOk = await sendSMS(user.phone, message);
    if (!smsOk) {
      console.error("❌ Payment OTP resend SMS failed", { phone: user.phone, paymentId });
      return res.status(500).json({ message: "Failed to resend payment OTP" });
    }

    return res.status(200).json({ message: "OTP resent successfully", expiresIn: 600 });
  } catch (error) {
    console.error("Resend payment OTP error:", error);
    return res.status(500).json({ message: "Failed to resend OTP" });
  }
};
