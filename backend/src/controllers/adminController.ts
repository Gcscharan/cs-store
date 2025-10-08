import { Request, Response } from "express";
import { Order } from "../models/Order";
import { User } from "../models/User";
import { Product } from "../models/Product";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { createObjectCsvWriter } from "csv-writer";

export const getStats = async (req: Request, res: Response) => {
  try {
    const { period = "month" } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;

    if (period === "day") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Sales analytics
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          totalSales: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Orders by status
    const ordersByStatus = await Order.aggregate([
      {
        $match: { createdAt: { $gte: startDate } },
      },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
        },
      },
    ]);

    // Delivery analytics
    const deliveryStats = await DeliveryBoy.aggregate([
      {
        $group: {
          _id: null,
          totalDrivers: { $sum: 1 },
          activeDrivers: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          availableDrivers: {
            $sum: { $cond: [{ $eq: ["$availability", "available"] }, 1, 0] },
          },
          totalEarnings: { $sum: "$earnings" },
          totalCompletedOrders: { $sum: "$completedOrdersCount" },
        },
      },
    ]);

    // User stats
    const userStats = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      salesData,
      ordersByStatus,
      deliveryStats: deliveryStats[0] || {},
      userStats,
      period,
      startDate,
      endDate: now,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

export const exportOrders = async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    const query: any = {};
    if (from && to) {
      query.createdAt = {
        $gte: new Date(from as string),
        $lte: new Date(to as string),
      };
    }

    const orders = await Order.find(query)
      .populate("userId", "name phone")
      .populate("deliveryBoyId", "name phone")
      .sort({ createdAt: -1 });

    // Create CSV data
    const csvData = orders.map((order) => ({
      orderId: order._id,
      customerName: (order.userId as any)?.name || "N/A",
      customerPhone: (order.userId as any)?.phone || "N/A",
      deliveryBoy: (order.deliveryBoyId as any)?.name || "Not Assigned",
      totalAmount: order.totalAmount,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      address: `${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}`,
      createdAt: order.createdAt.toISOString(),
    }));

    // Set headers for CSV download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="orders-${from || "all"}-${to || "all"}.csv"`
    );

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: "/tmp/orders.csv",
      header: [
        { id: "orderId", title: "Order ID" },
        { id: "customerName", title: "Customer Name" },
        { id: "customerPhone", title: "Customer Phone" },
        { id: "deliveryBoy", title: "Delivery Boy" },
        { id: "totalAmount", title: "Total Amount" },
        { id: "orderStatus", title: "Order Status" },
        { id: "paymentStatus", title: "Payment Status" },
        { id: "address", title: "Address" },
        { id: "createdAt", title: "Created At" },
      ],
    });

    await csvWriter.writeRecords(csvData);

    // Send file
    res.download("/tmp/orders.csv");
  } catch (error) {
    res.status(500).json({ error: "Failed to export orders" });
  }
};
