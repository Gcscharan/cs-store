import { Request, Response } from "express";
import { Order } from "../models/Order";
import { Product } from "../models/Product";

export const getOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const userId = (req as any).user._id;

    const query: any = { userId };
    if (status) query.orderStatus = status;

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate("deliveryBoyId", "name phone vehicleType");

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user._id;
    const userRole = (req as any).user.role;

    const query: any = { _id: id };

    // If not admin, only show user's own orders
    if (userRole !== "admin") {
      query.userId = userId;
    }

    const order = await Order.findOne(query)
      .populate("deliveryBoyId", "name phone vehicleType currentLocation")
      .populate("items.productId", "name images");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch order" });
  }
};

export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user._id;

    const order = await Order.findOne({ _id: id, userId });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if order can be cancelled
    if (order.orderStatus === "delivered") {
      return res.status(400).json({ error: "Cannot cancel delivered order" });
    }

    if (order.orderStatus === "cancelled") {
      return res.status(400).json({ error: "Order already cancelled" });
    }

    // Update order status
    order.orderStatus = "cancelled";
    await order.save();

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.qty },
      });
    }

    res.json({
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel order" });
  }
};
