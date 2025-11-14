import { Request, Response } from "express";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { Pincode } from "../models/Pincode";
import { Cart } from "../models/Cart";
import Razorpay from "razorpay";
import crypto from "crypto";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

export const getCart = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    console.log('🛒 CART CONTROLLER: getCart called');
    console.log('🛒 CART CONTROLLER: User from req:', {
      userId: (req as any).user?._id,
      userEmail: (req as any).user?.email,
      userRole: (req as any).user?.role
    });
    
    const userId = (req as any).user._id;

    let cart = await Cart.findOne({ userId }).populate("items.productId");

    if (!cart) {
      // Create empty cart for user
      cart = new Cart({
        userId,
        items: [],
        total: 0,
        itemCount: 0,
      });
      await cart.save();
    }

    res.json({
      items: cart.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: item.quantity,
      })),
      total: cart.total,
      itemCount: cart.itemCount,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch cart" });
    return;
  }
};

export const addToCart = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    console.log('🛒 CART CONTROLLER: addToCart called');
    console.log('🛒 CART CONTROLLER: Request body:', req.body);
    console.log('🛒 CART CONTROLLER: User from req:', {
      userId: (req as any).user?._id,
      userEmail: (req as any).user?.email,
      userRole: (req as any).user?.role
    });
    
    const { productId, quantity = 1 } = req.body;
    const userId = (req as any).user._id;

    // Verify product exists and has stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    // Get or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({
        userId,
        items: [],
        total: 0,
        itemCount: 0,
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        image: product.images[0],
        quantity,
      });
    }

    // Recalculate totals
    cart.total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    await cart.save();

    res.json({
      message: "Item added to cart",
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to add item to cart" });
    return;
  }
};

export const updateCartItem = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { productId, quantity } = req.body;
    const userId = (req as any).user._id;

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

    // Get cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    // Find and update item
    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ error: "Item not found in cart" });
    }

    cart.items[itemIndex].quantity = quantity;

    // Recalculate totals
    cart.total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    await cart.save();

    res.json({
      message: "Cart item updated",
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update cart item" });
    return;
  }
};

export const removeFromCart = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { itemId } = req.params;
    const userId = (req as any).user._id;

    // Get cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    // Remove item
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== itemId
    );

    // Recalculate totals
    cart.total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    await cart.save();

    res.json({
      message: "Item removed from cart",
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove item from cart" });
    return;
  }
};

export const clearCart = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const userId = (req as any).user._id;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ error: "Cart not found" });
    }

    cart.items = [];
    cart.total = 0;
    cart.itemCount = 0;

    await cart.save();

    res.json({
      message: "Cart cleared successfully",
      cart: {
        items: cart.items,
        total: cart.total,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear cart" });
    return;
  }
};

export const createOrder = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { items, address, totalAmount } = req.body;
    const userId = (req as any).user._id;

    // Removed minimum order requirement - delivery charges will apply for all orders

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

export const verifyPayment = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;
    const userId = (req as any).user._id;

    // Verify Razorpay signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // Update order payment status and set to pending for admin review
    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        paymentStatus: "paid",
        razorpayPaymentId: razorpay_payment_id,
        orderStatus: "pending", // Move to pending so admin can accept/decline
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Clear user's cart after successful payment verification
    await Cart.findOneAndUpdate(
      { userId },
      { items: [], total: 0, itemCount: 0 },
      { new: true }
    );

    // Emit socket event to notify admin of new order
    const io = (req as any).app.get("io");
    if (io) {
      io.to("admin_room").emit("order:new", {
        orderId: order._id,
        status: "pending",
        totalAmount: order.totalAmount,
        message: "New order received and awaiting review",
      });
    }

    res.json({
      message: "Payment verified successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to verify payment" });
  }
};
