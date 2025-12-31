import { Request, Response } from "express";
import { Product } from "../models/Product";
import { Order } from "../models/Order";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { Pincode } from "../models/Pincode";
import { Cart } from "../models/Cart";
import Razorpay from "razorpay";
import crypto from "crypto";

// Define interfaces for type safety
interface PopulatedProduct {
  _id: any;
  name: string;
  price: number;
  images: string[];
}

interface PopulatedCartItem {
  productId: PopulatedProduct | any;
  quantity: number;
  name?: string;
  price?: number;
  image?: string;
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

// Helper function to format cart items with type safety
const formatCartItem = (item: any) => {
  const productId = item.productId;
  // Check if productId is populated (has product properties)
  if (productId && typeof productId === 'object' && 'name' in productId) {
    const populatedProduct = productId as PopulatedProduct;
    return {
      productId: populatedProduct._id.toString(),
      name: populatedProduct.name,
      price: populatedProduct.price,
      image: typeof populatedProduct.images?.[0] === 'string' 
        ? populatedProduct.images[0] 
        : (populatedProduct.images?.[0] as any)?.thumb || (populatedProduct.images?.[0] as any)?.full || "",
      quantity: item.quantity,
    };
  } else {
    // Fallback for non-populated productId
    return {
      productId: (productId as any).toString(),
      name: "",
      price: 0,
      image: "",
      quantity: item.quantity,
    };
  }
};

export const getCart = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
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
      cart: {
        items: cart.items.map(formatCartItem),
        totalAmount: cart.total,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch cart" });
    return;
  }
};

export const addToCart = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { productId, quantity = 1 } = req.body;
    const userId = (req as any).user._id;

    // Validate required fields
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    if (quantity <= 0) {
      return res.status(400).json({ message: "Quantity must be greater than 0" });
    }

    // Verify product exists and has stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.stock < quantity) {
      return res.status(400).json({ message: "Insufficient stock" });
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
        image: typeof product.images[0] === 'string' 
          ? product.images[0] 
          : (product.images[0] as any)?.thumb || (product.images[0] as any)?.full || "/placeholder-product.svg",
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

    // Get cart with populated product details for response
    const populatedCart = await Cart.findOne({ userId }).populate("items.productId");

    res.json({
      message: "Item added to cart",
      cart: {
        items: populatedCart?.items.map(formatCartItem) || [],
        totalAmount: cart.total,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to add item to cart" });
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

    // Validate required fields
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    if (quantity === undefined || quantity === null) {
      return res.status(400).json({ message: "Quantity is required" });
    }

    // Get cart first
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Find and update item
    const itemIndex = cart.items.findIndex(
      (item) => item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Verify product exists and has stock (only if quantity > 0)
    if (quantity > 0) {
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (product.stock < quantity) {
        return res.status(400).json({ message: "Insufficient stock" });
      }
    }

    if (quantity <= 0) {
      // Remove item from cart if quantity is 0
      cart.items = cart.items.filter(
        (item) => item.productId.toString() !== productId
      );
    } else {
      // Update quantity if greater than 0
      cart.items[itemIndex].quantity = quantity;
    }

    // Recalculate totals
    cart.total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    await cart.save();

    // Get cart with populated product details for response
    const populatedCart = await Cart.findOne({ userId }).populate("items.productId");

    res.json({
      message: "Cart updated",
      cart: {
        items: populatedCart?.items.map(formatCartItem) || [],
        totalAmount: cart.total,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to update cart item" });
    return;
  }
};

export const removeFromCart = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { productId } = req.body; // Changed from req.params.itemId to req.body.productId
    const userId = (req as any).user._id;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Get cart
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: "Cart not found" });
    }

    // Check if item exists
    const itemExists = cart.items.some(
      (item) => item.productId.toString() === productId
    );
    
    if (!itemExists) {
      return res.status(404).json({ message: "Item not found in cart" });
    }

    // Remove item
    cart.items = cart.items.filter(
      (item) => item.productId.toString() !== productId
    );

    // Recalculate totals
    cart.total = cart.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    await cart.save();

    // Get cart with populated product details for response
    const populatedCart = await Cart.findOne({ userId }).populate("items.productId");

    res.json({
      message: "Item removed from cart",
      cart: {
        items: populatedCart?.items.map(formatCartItem) || [],
        totalAmount: cart.total,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to remove item from cart" });
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
      return res.status(404).json({ message: "Cart not found" });
    }

    cart.items = [];
    cart.total = 0;
    cart.itemCount = 0;

    await cart.save();

    // Get cart with populated product details for response (will be empty after clear)
    const populatedCart = await Cart.findOne({ userId }).populate("items.productId");

    res.json({
      message: "Cart cleared",
      cart: {
        items: populatedCart?.items.map(formatCartItem) || [],
        totalAmount: cart.total,
        itemCount: cart.itemCount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to clear cart" });
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
    res.status(500).json({ message: "Failed to create order" });
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
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Update order payment status and set to pending for admin review
    const order = await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        paymentStatus: "paid",
        razorpayPaymentId: razorpay_payment_id,
      },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
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
    res.status(500).json({ message: "Failed to verify payment" });
  }
};
