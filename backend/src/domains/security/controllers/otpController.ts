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

    let authedUserPhone: string | null = null;
    if (authedUserId) {
      const user = await User.findById(authedUserId);
      if (user && user.phone) {
        authedUserPhone = user.phone;
      }
    }

    let cleanedPhoneFromBody: string | null = null;
    if (phoneFromBody) {
      cleanedPhoneFromBody = String(phoneFromBody).replace(/\D/g, "");
    }

    const targetPhone =
      cleanedPhoneFromBody ||
      authedUserPhone ||
      req.body.phone ||
      null;

    if (targetPhone === null) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // Validation order: check phone first, then validate format
    if (!validatePhoneNumber(targetPhone)) {
      res.status(400).json({ message: "Invalid phone number format" });
      return;
    }

    // Clean phone number for storage
    const cleanedPhone = String(targetPhone).replace(/\D/g, "");

    // Generate 6-digit OTP
    const otp = generateOTP();

    // Create OTP record
    const otpRecord = new Otp({
      phone: cleanedPhone,
      otp,
      type: "verification",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    await otpRecord.save();

    // Send OTP via SMS
    const message = `Your CS Store verification OTP is ${otp}. Valid for 10 minutes. Do not share this OTP with anyone.`;
    const smsOk = await sendSMS(cleanedPhone, message);

    if (!smsOk) {
      res.status(500).json({
        message: "Failed to send verification OTP via SMS",
      });
      return;
    }

    // Prepare response
    const response: any = {
      message: "OTP sent successfully",
      expiresIn: 600,
    };
    
    // If MOCK_OTP mode, include OTP for testing (only in test environment)
    if (process.env.NODE_ENV === "test" && process.env.MOCK_OTP === "true") {
      response.mockOtp = otp;
    }
    
    res.status(200).json(response);
    return;
  } catch (error: any) {
    res.status(500).json({ 
      message: "Failed to generate verification OTP",
      error: error?.message,
    });
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

    // FETCH existing order from DB (do not create new one)
    const order = await Order.findById(orderId).lean();
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

    const paymentResponse: any = {
      message: "OTP sent successfully",
      paymentId: otpRecord.paymentId,
      expiresIn: 600, // 10 minutes in seconds
      realTimeDelivered: false,
    };
    
    // If MOCK_OTP mode, indicate it and include OTP for easier testing (only in test environment)
    if (process.env.NODE_ENV === "test" && process.env.MOCK_OTP === "true") {
      console.log(`💳 MOCK PAYMENT OTP for order ${orderId}: ${otp}`);
      paymentResponse.mock = true;
      paymentResponse.message = "OTP sent successfully (mock)";
      paymentResponse.otp = otp;
      paymentResponse.phone = user.phone;
      paymentResponse.note = "MOCK_OTP mode enabled - OTP included in response";
    } else if (process.env.NODE_ENV === "development") {
      console.log(`💳 Development PAYMENT OTP for order ${orderId}: ${otp}`);
      paymentResponse.otp = otp; 
      paymentResponse.phone = user.phone;
      paymentResponse.note = "OTP included in response for development only";
    }
    
    res.status(200).json(paymentResponse);
    return;
  } catch (error) {
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
        message: "Invalid or expired OTP",
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
      return res.status(500).json({ message: "Failed to resend payment OTP" });
    }

    const response: any = { message: "OTP resent successfully", expiresIn: 600 };
    if (process.env.MOCK_OTP === "true") {
      response.mock = true;
      response.otp = newOtp;
      response.phone = user.phone;
      response.note = "MOCK_OTP mode enabled - OTP included in response";
    } else if (process.env.NODE_ENV === "development") {
      response.otp = newOtp;
      response.note = "OTP included in response for development only";
    }

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({ message: "Failed to resend OTP" });
  }
};
