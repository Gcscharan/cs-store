"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = exports.createOrder = exports.clearCart = exports.removeFromCart = exports.updateCartItem = exports.addToCart = exports.getCart = void 0;
const Product_1 = require("../models/Product");
const Order_1 = require("../models/Order");
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const Pincode_1 = require("../models/Pincode");
const Cart_1 = require("../models/Cart");
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});
const getCart = async (req, res) => {
    try {
        const userId = req.user._id;
        let cart = await Cart_1.Cart.findOne({ userId }).populate("items.productId");
        if (!cart) {
            cart = new Cart_1.Cart({
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
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch cart" });
        return;
    }
};
exports.getCart = getCart;
const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const userId = req.user._id;
        const product = await Product_1.Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        if (product.stock < quantity) {
            return res.status(400).json({ error: "Insufficient stock" });
        }
        let cart = await Cart_1.Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart_1.Cart({
                userId,
                items: [],
                total: 0,
                itemCount: 0,
            });
        }
        const existingItemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
        if (existingItemIndex > -1) {
            cart.items[existingItemIndex].quantity += quantity;
        }
        else {
            cart.items.push({
                productId: product._id,
                name: product.name,
                price: product.price,
                image: product.images[0],
                quantity,
            });
        }
        cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
    }
    catch (error) {
        res.status(500).json({ error: "Failed to add item to cart" });
        return;
    }
};
exports.addToCart = addToCart;
const updateCartItem = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.user._id;
        if (quantity <= 0) {
            return res.status(400).json({ error: "Quantity must be greater than 0" });
        }
        const product = await Product_1.Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        if (product.stock < quantity) {
            return res.status(400).json({ error: "Insufficient stock" });
        }
        const cart = await Cart_1.Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ error: "Cart not found" });
        }
        const itemIndex = cart.items.findIndex((item) => item.productId.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ error: "Item not found in cart" });
        }
        cart.items[itemIndex].quantity = quantity;
        cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update cart item" });
        return;
    }
};
exports.updateCartItem = updateCartItem;
const removeFromCart = async (req, res) => {
    try {
        const { itemId } = req.params;
        const userId = req.user._id;
        const cart = await Cart_1.Cart.findOne({ userId });
        if (!cart) {
            return res.status(404).json({ error: "Cart not found" });
        }
        cart.items = cart.items.filter((item) => item.productId.toString() !== itemId);
        cart.total = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
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
    }
    catch (error) {
        res.status(500).json({ error: "Failed to remove item from cart" });
        return;
    }
};
exports.removeFromCart = removeFromCart;
const clearCart = async (req, res) => {
    try {
        const userId = req.user._id;
        const cart = await Cart_1.Cart.findOne({ userId });
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
    }
    catch (error) {
        res.status(500).json({ error: "Failed to clear cart" });
        return;
    }
};
exports.clearCart = clearCart;
const createOrder = async (req, res) => {
    try {
        const { items, address, totalAmount } = req.body;
        const userId = req.user._id;
        const pincodeExists = await Pincode_1.Pincode.findOne({ pincode: address.pincode });
        if (!pincodeExists) {
            return res.status(400).json({
                error: "Unable to deliver to this location.",
            });
        }
        const order = new Order_1.Order({
            userId,
            items,
            totalAmount,
            address,
            orderStatus: "created",
            paymentStatus: "pending",
        });
        await order.save();
        const razorpayOrder = await razorpay.orders.create({
            amount: totalAmount * 100,
            currency: "INR",
            receipt: order._id.toString(),
        });
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();
        const availableDeliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({
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
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create order" });
    }
};
exports.createOrder = createOrder;
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto_1.default
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
            .update(body.toString())
            .digest("hex");
        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ error: "Invalid payment signature" });
        }
        const order = await Order_1.Order.findOneAndUpdate({ razorpayOrderId: razorpay_order_id }, {
            paymentStatus: "paid",
            razorpayPaymentId: razorpay_payment_id,
        }, { new: true });
        if (!order) {
            return res.status(404).json({ error: "Order not found" });
        }
        res.json({
            message: "Payment verified successfully",
            order,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to verify payment" });
    }
};
exports.verifyPayment = verifyPayment;
//# sourceMappingURL=cartController.js.map