"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = exports.createOrder = exports.clearCart = exports.removeFromCart = exports.updateCartItem = exports.addToCart = exports.getCart = void 0;
const Product_1 = require("../models/Product");
const Order_1 = require("../models/Order");
const Cart_1 = require("../models/Cart");
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});
// Helper function to format cart items with type safety
const formatCartItem = (item) => {
    const productId = item.productId;
    // Check if productId is populated (has product properties)
    if (productId && typeof productId === 'object' && 'name' in productId) {
        const populatedProduct = productId;
        return {
            productId: populatedProduct._id.toString(),
            name: populatedProduct.name,
            price: populatedProduct.price,
            image: typeof populatedProduct.images?.[0] === 'string'
                ? populatedProduct.images[0]
                : populatedProduct.images?.[0]?.thumb || populatedProduct.images?.[0]?.full || "",
            quantity: item.quantity,
        };
    }
    else {
        // Fallback for non-populated productId
        return {
            productId: productId.toString(),
            name: "",
            price: 0,
            image: "",
            quantity: item.quantity,
        };
    }
};
const getCart = async (req, res) => {
    try {
        const userId = req.user._id;
        let cart = await Cart_1.Cart.findOne({ userId }).populate("items.productId");
        if (!cart) {
            // Create empty cart for user
            cart = new Cart_1.Cart({
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
    }
    catch (error) {
        res.status(500).json({ message: "Failed to fetch cart" });
        return;
    }
};
exports.getCart = getCart;
const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const userId = req.user._id;
        // Validate required fields
        if (!productId) {
            return res.status(400).json({ message: "Product ID is required" });
        }
        if (quantity <= 0) {
            return res.status(400).json({ message: "Quantity must be greater than 0" });
        }
        // Verify product exists and has stock
        const product = await Product_1.Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const stock = Number(product.stock || 0);
        const reservedStock = Number(product.reservedStock || 0);
        const availableStock = stock - reservedStock;
        if (availableStock < quantity) {
            return res.status(400).json({ message: "Insufficient stock" });
        }
        // Get or create cart
        let cart = await Cart_1.Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart_1.Cart({
                userId,
                items: [],
                total: 0,
                itemCount: 0,
            });
        }
        // Check if item already exists in cart
        const existingItemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
        if (existingItemIndex > -1) {
            // Update quantity
            cart.items[existingItemIndex].quantity += quantity;
        }
        else {
            // Add new item
            cart.items.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                image: typeof product.images[0] === 'string'
                    ? product.images[0]
                    : product.images[0]?.thumb || product.images[0]?.full || "/placeholder-product.svg",
                quantity,
            });
        }
        // Recalculate totals
        cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        await cart.save();
        // Get cart with populated product details for response
        const populatedCart = await Cart_1.Cart.findOne({ userId }).populate("items.productId");
        res.json({
            message: "Item added to cart",
            cart: {
                items: populatedCart?.items.map(formatCartItem) || [],
                totalAmount: cart.total,
                itemCount: cart.itemCount,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to add item to cart" });
        return;
    }
};
exports.addToCart = addToCart;
const updateCartItem = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.user._id;
        // Validate required fields
        if (!productId) {
            return res.status(400).json({ message: "Product ID is required" });
        }
        if (quantity === undefined || quantity === null) {
            return res.status(400).json({ message: "Quantity is required" });
        }
        // Get cart first
        const cart = await Cart_1.Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }
        // Find and update item
        const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ message: "Item not found in cart" });
        }
        // Verify product exists and has stock (only if quantity > 0)
        if (quantity > 0) {
            const product = await Product_1.Product.findById(productId);
            if (!product) {
                return res.status(404).json({ message: "Product not found" });
            }
            const stock = Number(product.stock || 0);
            const reservedStock = Number(product.reservedStock || 0);
            const availableStock = stock - reservedStock;
            if (availableStock < quantity) {
                return res.status(400).json({ message: "Insufficient stock" });
            }
        }
        if (quantity <= 0) {
            // Remove item from cart if quantity is 0
            cart.items = cart.items.filter((item) => item.productId.toString() !== productId);
        }
        else {
            // Update quantity if greater than 0
            cart.items[itemIndex].quantity = quantity;
        }
        // Recalculate totals
        cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        await cart.save();
        // Get cart with populated product details for response
        const populatedCart = await Cart_1.Cart.findOne({ userId }).populate("items.productId");
        res.json({
            message: "Cart updated",
            cart: {
                items: populatedCart?.items.map(formatCartItem) || [],
                totalAmount: cart.total,
                itemCount: cart.itemCount,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to update cart item" });
        return;
    }
};
exports.updateCartItem = updateCartItem;
const removeFromCart = async (req, res) => {
    try {
        const { productId } = req.body; // Changed from req.params.itemId to req.body.productId
        const userId = req.user._id;
        if (!productId) {
            return res.status(400).json({ message: "Product ID is required" });
        }
        // Get cart
        const cart = await Cart_1.Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }
        // Check if item exists
        const itemExists = cart.items.some((item) => item.productId.toString() === productId);
        if (!itemExists) {
            return res.status(404).json({ message: "Item not found in cart" });
        }
        // Remove item
        cart.items = cart.items.filter((item) => item.productId.toString() !== productId);
        // Recalculate totals
        cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        await cart.save();
        // Get cart with populated product details for response
        const populatedCart = await Cart_1.Cart.findOne({ userId }).populate("items.productId");
        res.json({
            message: "Item removed from cart",
            cart: {
                items: populatedCart?.items.map(formatCartItem) || [],
                totalAmount: cart.total,
                itemCount: cart.itemCount,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to remove item from cart" });
        return;
    }
};
exports.removeFromCart = removeFromCart;
const clearCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const cart = await Cart_1.Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ message: "Cart not found" });
        }
        cart.items = [];
        cart.total = 0;
        cart.itemCount = 0;
        await cart.save();
        // Get cart with populated product details for response (will be empty after clear)
        const populatedCart = await Cart_1.Cart.findOne({ userId }).populate("items.productId");
        res.json({
            message: "Cart cleared",
            cart: {
                items: populatedCart?.items.map(formatCartItem) || [],
                totalAmount: cart.total,
                itemCount: cart.itemCount,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to clear cart" });
        return;
    }
};
exports.clearCart = clearCart;
const createOrder = async (req, res) => {
    try {
        return res.status(410).json({
            message: "Deprecated endpoint. Use /api/orders (canonical order flow) instead.",
        });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to create order" });
    }
};
exports.createOrder = createOrder;
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const userId = req.user._id;
        // Verify Razorpay signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto_1.default
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
            .update(body.toString())
            .digest("hex");
        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ message: "Invalid payment signature" });
        }
        // Update order payment status and set to pending for admin review
        const order = await Order_1.Order.findOneAndUpdate({ razorpayOrderId: razorpay_order_id }, {
            paymentStatus: "paid",
            razorpayPaymentId: razorpay_payment_id,
        }, { new: true });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        // Clear user's cart after successful payment verification
        await Cart_1.Cart.findOneAndUpdate({ userId }, { items: [], total: 0, itemCount: 0 }, { new: true });
        // Emit socket event to notify admin of new order
        const io = req.app.get("io");
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
    }
    catch (error) {
        res.status(500).json({ message: "Failed to verify payment" });
    }
};
exports.verifyPayment = verifyPayment;
