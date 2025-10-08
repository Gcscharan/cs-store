"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyPayment = exports.createOrder = exports.removeFromCart = exports.updateCartItem = exports.addToCart = exports.getCart = void 0;
const Product_1 = require("../models/Product");
const Order_1 = require("../models/Order");
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const Pincode_1 = require("../models/Pincode");
const razorpay_1 = __importDefault(require("razorpay"));
const crypto_1 = __importDefault(require("crypto"));
const razorpay = new razorpay_1.default({
    key_id: process.env.RAZORPAY_KEY_ID || "",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});
const getCart = async (req, res) => {
    try {
        res.json({ items: [], total: 0, itemCount: 0 });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch cart" });
    }
};
exports.getCart = getCart;
const addToCart = async (req, res) => {
    try {
        const { productId, quantity = 1 } = req.body;
        const product = await Product_1.Product.findById(productId);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        if (product.stock < quantity) {
            return res.status(400).json({ error: "Insufficient stock" });
        }
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
    }
    catch (error) {
        res.status(500).json({ error: "Failed to add item to cart" });
    }
};
exports.addToCart = addToCart;
const updateCartItem = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
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
        res.json({
            message: "Cart item updated",
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to update cart item" });
    }
};
exports.updateCartItem = updateCartItem;
const removeFromCart = async (req, res) => {
    try {
        const { itemId } = req.params;
        res.json({
            message: "Item removed from cart",
        });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to remove item from cart" });
    }
};
exports.removeFromCart = removeFromCart;
const createOrder = async (req, res) => {
    try {
        const { items, address, totalAmount } = req.body;
        const userId = req.user._id;
        if (totalAmount < 2000) {
            return res.status(400).json({
                error: "Minimum order is ₹2000. Add more items or contact support.",
            });
        }
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