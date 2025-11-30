import { Request, Response } from "express";
import crypto from "crypto";
import razorpay from "../../../config/razorpay";
import { Order } from "../../../models/Order";
import { Payment } from "../../../models/Payment";
import { User } from "../../../models/User";
import { calculateDeliveryFee } from "../../../utils/deliveryFeeCalculator";

// Create Razorpay order for cart checkout
export const createOrder = async (req: Request, res: Response) => {
  try {
    const { items, address, totalAmount } = req.body;
    const userId = (req as any).user?._id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items are required",
      });
    }

    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required",
      });
    }

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid total amount",
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Enrich address with user's name and phone from saved addresses
    let enrichedAddress = { ...address };
    
    // Try to find matching address from user's saved addresses to get name and phone
    const savedAddress = user.addresses.find(
      (addr: any) => 
        addr.pincode === address.pincode && 
        addr.label === address.label
    );
    
    if (savedAddress) {
      enrichedAddress.name = savedAddress.name || user.name;
      enrichedAddress.phone = savedAddress.phone || user.phone;
    } else {
      // Fallback to user's profile name and phone
      enrichedAddress.name = user.name;
      enrichedAddress.phone = user.phone;
    }

    // Calculate delivery fee based on user's address
    // Note: totalAmount from frontend already includes delivery fee
    // We need to extract cart subtotal to calculate actual delivery fee
    const cartSubtotal = items.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0);
    
    // Calculate delivery fee using user's address coordinates
    const deliveryFeeDetails = await calculateDeliveryFee(
      enrichedAddress as any,
      cartSubtotal
    );
    
    console.log('💾 [Razorpay] Storing Order with Delivery Fee:', {
      orderId: 'pending',
      cartSubtotal: `₹${cartSubtotal}`,
      deliveryFee: `₹${deliveryFeeDetails.finalFee}`,
      totalAmount: `₹${totalAmount}`,
      isFreeDelivery: deliveryFeeDetails.isFreeDelivery,
    });

    // Create order in database first
    const order = new Order({
      userId,
      items,
      totalAmount,
      address: enrichedAddress, // Use enriched address with name and phone
      paymentStatus: "pending",
      orderStatus: "created",
      earnings: {
        deliveryFee: deliveryFeeDetails.finalFee,
        tip: 0,
        commission: 0,
      },
    });

    await order.save();

    // Convert amount to paise (Razorpay expects amount in smallest currency unit)
    const amountInPaise = Math.round(totalAmount * 100);

    const razorpayOptions = {
      amount: amountInPaise,
      currency: "INR",
      receipt: `order_${order._id}`,
      notes: {
        orderId: order._id.toString(),
        userId: userId,
      },
    };

    const razorpayOrder = await razorpay.orders.create(razorpayOptions);

    // Update order with Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.status(200).json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      orderId: order._id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_RREROYUEXDmjIA",
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create payment order",
    });
  }
};

// Verify payment signature and store payment data
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment verification data",
      });
    }

    // Create signature for verification
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET || "ICsVMT4uFvM53f0Czkqr5vmW"
      )
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (!isAuthentic) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed - Invalid signature",
      });
    }

    // Find the order
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Get payment details from Razorpay
    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Determine payment method
    let paymentMethod:
      | "upi"
      | "card"
      | "netbanking"
      | "wallet"
      | "emi"
      | "paylater" = "card";
    if (paymentDetails.method === "upi") paymentMethod = "upi";
    else if (paymentDetails.method === "card") paymentMethod = "card";
    else if (paymentDetails.method === "netbanking")
      paymentMethod = "netbanking";
    else if (paymentDetails.method === "wallet") paymentMethod = "wallet";
    else if (paymentDetails.method === "emi") paymentMethod = "emi";
    else if (paymentDetails.method === "paylater") paymentMethod = "paylater";

    // Extract method details
    const methodDetails: any = {};
    const acquirerData = paymentDetails.acquirer_data as any;

    if (paymentMethod === "upi" && acquirerData) {
      methodDetails.upi = {
        vpa: acquirerData.upi?.vpa,
        flow: acquirerData.upi?.flow,
      };
    } else if (paymentMethod === "card" && paymentDetails.card) {
      methodDetails.card = {
        last4: paymentDetails.card.last4,
        network: paymentDetails.card.network,
        type: paymentDetails.card.type,
        issuer: paymentDetails.card.issuer,
      };
    } else if (paymentMethod === "netbanking" && acquirerData) {
      methodDetails.netbanking = {
        bank: acquirerData.bank,
      };
    } else if (paymentMethod === "wallet" && acquirerData) {
      methodDetails.wallet = {
        wallet_name: acquirerData.wallet?.wallet_name,
      };
    }

    // Create payment record
    const payment = new Payment({
      orderId: order._id,
      paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      amount: Number(paymentDetails.amount) / 100, // Convert from paise to rupees
      currency: paymentDetails.currency,
      status: paymentDetails.status === "captured" ? "captured" : "pending",
      method: paymentMethod,
      methodDetails,
      userId,
      userDetails: {
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
      orderDetails: {
        items: order.items,
        totalAmount: order.totalAmount,
        address: order.address,
      },
      razorpayResponse: paymentDetails,
    });

    await payment.save();

    // Update order status - set to pending for admin review after successful payment
    order.paymentStatus =
      paymentDetails.status === "captured" ? "paid" : "pending";
    order.razorpayPaymentId = razorpay_payment_id;
    // Move order to pending status so admin can accept/decline
    if (paymentDetails.status === "captured") {
      order.orderStatus = "pending";
    }
    await order.save();

    // Emit socket event to notify admin of new order
    if (paymentDetails.status === "captured") {
      const io = (req as any).app?.get("io");
      if (io) {
        io.to("admin_room").emit("order:new", {
          orderId: order._id,
          status: "pending",
          totalAmount: order.totalAmount,
          message: "New order received and awaiting review",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      payment: {
        id: payment._id,
        paymentId: payment.paymentId,
        orderId: order._id,
        amount: payment.amount,
        status: payment.status,
        method: payment.method,
      },
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify payment",
    });
  }
};

// Get payment details
export const getPaymentDetails = async (req: Request, res: Response) => {
  try {
    const { payment_id } = req.params;

    if (!payment_id) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const payment = await razorpay.payments.fetch(payment_id);

    return res.status(200).json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        created_at: payment.created_at,
      },
    });
  } catch (error) {
    console.error("Error fetching payment details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment details",
    });
  }
};

// Get all payments for admin panel
export const getAllPayments = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;
    const method = req.query.method as string;
    const search = req.query.search as string;

    const query: any = {};

    if (status) {
      query.status = status;
    }

    if (method) {
      query.method = method;
    }

    if (search) {
      query.$or = [
        { paymentId: { $regex: search, $options: "i" } },
        { razorpayPaymentId: { $regex: search, $options: "i" } },
        { "userDetails.name": { $regex: search, $options: "i" } },
        { "userDetails.email": { $regex: search, $options: "i" } },
      ];
    }

    const payments = await Payment.find(query)
      .populate("orderId", "totalAmount orderStatus")
      .populate("userId", "name email phone")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const totalPayments = await Payment.countDocuments(query);

    return res.status(200).json({
      success: true,
      payments,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalPayments / limit),
        totalPayments,
        hasNext: page < Math.ceil(totalPayments / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
    });
  }
};

// Get payment statistics for admin dashboard
export const getPaymentStats = async (req: Request, res: Response) => {
  try {
    const totalPayments = await Payment.countDocuments();
    const totalAmount = await Payment.aggregate([
      { $match: { status: "captured" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const methodStats = await Payment.aggregate([
      {
        $group: {
          _id: "$method",
          count: { $sum: 1 },
          total: { $sum: "$amount" },
        },
      },
    ]);

    const statusStats = await Payment.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const recentPayments = await Payment.find()
      .populate("userId", "name email")
      .populate("orderId", "orderStatus")
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json({
      success: true,
      stats: {
        totalPayments,
        totalAmount: totalAmount[0]?.total || 0,
        methodStats,
        statusStats,
        recentPayments,
      },
    });
  } catch (error) {
    console.error("Error fetching payment stats:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch payment statistics",
    });
  }
};

// Payment callback handler (for webhooks)
export const paymentCallback = async (req: Request, res: Response) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
      req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment data",
      });
    }

    // Verify the signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac(
        "sha256",
        process.env.RAZORPAY_KEY_SECRET || "ICsVMT4uFvM53f0Czkqr5vmW"
      )
      .update(body.toString())
      .digest("hex");

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Payment is verified - you can update your database here
      console.log("Payment verified via webhook:", {
        payment_id: razorpay_payment_id,
        order_id: razorpay_order_id,
      });

      return res.status(200).json({
        success: true,
        message: "Payment callback processed successfully",
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature",
      });
    }
  } catch (error) {
    console.error("Error processing payment callback:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process payment callback",
    });
  }
};
