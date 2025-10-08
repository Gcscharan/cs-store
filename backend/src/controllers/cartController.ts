import { Request, Response } from "express";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { Pincode } from "../models/Pincode";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

export const getCart = async (req: Request, res: Response) => {
  try {
    // For now, return empty cart - in production, you might want to store cart in Redis or database
    res.json({ items: [], total: 0, itemCount: 0 });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cart" });
  }
};

export const addToCart = async (req: Request, res: Response) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // Verify product exists and has stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    // In a real implementation, you would store this in Redis or database
    res.json({
      message: "Item added to cart",
      product: {
        id: product._id,
        name: product.name,
        price: product.price,
        image: product.images[0],
        stock: product.stock,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to add item to cart" });
  }
};

export const updateCartItem = async (req: Request, res: Response) => {
  try {
    const { productId, quantity } = req.body;

    if (quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    // Verify product exists and has stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    res.json({
      message: "Cart item updated",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update cart item" });
  }
};

export const removeFromCart = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;

    // In a real implementation, you would remove from Redis or database
    res.json({
      message: "Item removed from cart",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove item from cart" });
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { items, address, totalAmount } = req.body;
    const userId = (req as any).user._id;

    // Validate minimum order amount
    if (totalAmount < 2000) {
      return res.status(400).json({
        error: "Minimum order is ₹2000. Add more items or contact support.",
      });
    }

    // Validate pincode
    const pincodeExists = await Pincode.findOne({ pincode: address.pincode });
    if (!pincodeExists) {
      return res.status(400).json({
        error: "Unable to deliver to this location.",
      });
    }

    // Create order
    const order = new Order({
      userId,
      items,
      totalAmount,
      address,
      orderStatus: "created",
      paymentStatus: "pending",
    });

    await order.save();

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: totalAmount * 100, // Convert to paise
      currency: "INR",
      receipt: order._id.toString(),
    });

    // Update order with Razorpay order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    // Auto-assign delivery boy
    const availableDeliveryBoy = await DeliveryBoy.findOne({
      availability: "available",
      isActive: true,
    });

    if (availableDeliveryBoy) {
      order.deliveryBoyId = availableDeliveryBoy._id;
      order.orderStatus = "assigned";
      availableDeliveryBoy.assignedOrders.push(order._id);
      availableDeliveryBoy.availability = "busy";
      await availableDeliveryBoy.save();
      await order.save();
    }

    res.json({
      message: "Order created successfully",
      order,
      razorpayOrderId: razorpayOrder.id,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create order" });
  }
};

export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    // Verify Razorpay signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // Update order payment status
    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        paymentStatus: "paid",
        razorpayPaymentId: razorpay_payment_id,
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      message: "Payment verified successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to verify payment" });
  }
};
