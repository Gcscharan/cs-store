import { Request, Response } from "express";
import { Order } from "../models/Order";
import { User, IUser } from "../models/User";
import { Product } from "../models/Product";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { createObjectCsvWriter } from "csv-writer";

export const getStats = async (req: Request, res: Response) => {
  try {
    const { period = "month", from, to } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    if (from && to) {
      startDate = new Date(from as string);
      endDate = new Date(to as string);
    } else if (period === "day") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Sales analytics with more detailed breakdown
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
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
          averageOrderValue: { $avg: "$totalAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Monthly sales data
    const monthlySales = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$createdAt" },
          },
          totalSales: { $sum: "$totalAmount" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Orders by status with detailed breakdown
    const ordersByStatus = await Order.aggregate([
      {
        $match: { createdAt: { $gte: startDate, $lte: endDate } },
      },
      {
        $group: {
          _id: "$orderStatus",
          count: { $sum: 1 },
          totalValue: { $sum: "$totalAmount" },
        },
      },
    ]);

    // Payment status breakdown
    const paymentStatusBreakdown = await Order.aggregate([
      {
        $match: { createdAt: { $gte: startDate, $lte: endDate } },
      },
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          totalValue: { $sum: "$totalAmount" },
        },
      },
    ]);

    // Delivery analytics with performance metrics
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
          busyDrivers: {
            $sum: { $cond: [{ $eq: ["$availability", "busy"] }, 1, 0] },
          },
          totalEarnings: { $sum: "$earnings" },
          totalCompletedOrders: { $sum: "$completedOrdersCount" },
          averageEarnings: { $avg: "$earnings" },
        },
      },
    ]);

    // Driver performance metrics
    const driverPerformance = await DeliveryBoy.find({ isActive: true })
      .select(
        "name phone vehicleType availability earnings completedOrdersCount assignedOrders"
      )
      .populate("assignedOrders", "orderStatus totalAmount")
      .sort({ completedOrdersCount: -1 })
      .limit(10);

    // User stats with role breakdown
    const userStats = await User.aggregate([
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    // Top products by sales
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          paymentStatus: "paid",
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          totalQuantity: { $sum: "$items.qty" },
          totalRevenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
    ]);

    // Recent orders for dashboard
    const recentOrders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate },
    })
      .populate("userId", "name phone")
      .populate("deliveryBoyId", "name phone")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      salesData,
      monthlySales,
      ordersByStatus,
      paymentStatusBreakdown,
      deliveryStats: deliveryStats[0] || {},
      driverPerformance,
      userStats,
      topProducts,
      recentOrders,
      period,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
    return;
  }
};

export const getAdminProfile = async (req: Request, res: Response) => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Return only essential admin profile information
    const adminProfile = {
      name: adminUser.name || "Unknown",
      email: adminUser.email || "Unknown",
      phone: adminUser.phone || "Unknown",
      role: adminUser.role || "admin",
    };

    return res.json(adminProfile);
  } catch (error) {
    console.error("Admin profile error:", error);
    return res.status(500).json({ error: "Failed to fetch admin profile" });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Fetch all users with basic information only
    const users = await User.find({})
      .select("name email phone role createdAt isActive")
      .sort({ createdAt: -1 });

    return res.json({ users });
  } catch (error) {
    console.error("Admin users error:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getAdminProducts = async (req: Request, res: Response) => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Fetch all products
    const products = await Product.find({})
      .select(
        "name price stock category weight images description createdAt updatedAt"
      )
      .sort({ createdAt: -1 });

    return res.json({ products });
  } catch (error) {
    console.error("Admin products error:", error);
    return res.status(500).json({ error: "Failed to fetch products" });
  }
};

export const getAdminOrders = async (req: Request, res: Response) => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Fetch all orders with populated user and delivery boy info
    const orders = await Order.find({})
      .populate("userId", "name email phone")
      .populate("deliveryBoyId", "name phone")
      .sort({ createdAt: -1 });

    return res.json({ orders });
  } catch (error) {
    console.error("Admin orders error:", error);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
};

export const getAdminDeliveryBoys = async (req: Request, res: Response) => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Fetch all delivery boys
    const deliveryBoys = await DeliveryBoy.find({})
      .populate("assignedOrders", "orderStatus totalAmount createdAt")
      .sort({ createdAt: -1 });

    return res.json({ deliveryBoys });
  } catch (error) {
    console.error("Admin delivery boys error:", error);
    return res.status(500).json({ error: "Failed to fetch delivery boys" });
  }
};

export const exportOrders = async (req: Request, res: Response) => {
  try {
    const { from, to, format = "csv" } = req.query;

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

    if (format === "labels") {
      // Generate order labels for printing
      const labelsData = orders.map((order) => ({
        orderId: order._id.toString().slice(-6),
        customerName: (order.userId as any)?.name || "N/A",
        customerPhone: (order.userId as any)?.phone || "N/A",
        address: `${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}`,
        items: order.items
          .map((item) => `${item.name} (Qty: ${item.qty})`)
          .join(", "),
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        deliveryBoy: (order.deliveryBoyId as any)?.name || "Not Assigned",
        createdAt: order.createdAt.toLocaleDateString(),
      }));

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="order-labels-${from || "all"}-${
          to || "all"
        }.csv"`
      );

      const csvWriter = createObjectCsvWriter({
        path: "/tmp/order-labels.csv",
        header: [
          { id: "orderId", title: "Order #" },
          { id: "customerName", title: "Customer" },
          { id: "customerPhone", title: "Phone" },
          { id: "address", title: "Delivery Address" },
          { id: "items", title: "Items" },
          { id: "totalAmount", title: "Amount" },
          { id: "orderStatus", title: "Status" },
          { id: "deliveryBoy", title: "Driver" },
          { id: "createdAt", title: "Date" },
        ],
      });

      await csvWriter.writeRecords(labelsData);
      res.download("/tmp/order-labels.csv");
    } else {
      // Standard CSV export with detailed information
      const csvData = orders.map((order) => ({
        orderId: order._id,
        customerName: (order.userId as any)?.name || "N/A",
        customerPhone: (order.userId as any)?.phone || "N/A",
        deliveryBoy: (order.deliveryBoyId as any)?.name || "Not Assigned",
        deliveryBoyPhone: (order.deliveryBoyId as any)?.phone || "N/A",
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        address: `${order.address.addressLine}, ${order.address.city}, ${order.address.pincode}`,
        items: order.items
          .map((item) => `${item.name} (₹${item.price} x ${item.qty})`)
          .join("; "),
        itemsCount: order.items.length,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      }));

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="orders-${from || "all"}-${to || "all"}.csv"`
      );

      const csvWriter = createObjectCsvWriter({
        path: "/tmp/orders.csv",
        header: [
          { id: "orderId", title: "Order ID" },
          { id: "customerName", title: "Customer Name" },
          { id: "customerPhone", title: "Customer Phone" },
          { id: "deliveryBoy", title: "Delivery Boy" },
          { id: "deliveryBoyPhone", title: "Driver Phone" },
          { id: "totalAmount", title: "Total Amount" },
          { id: "orderStatus", title: "Order Status" },
          { id: "paymentStatus", title: "Payment Status" },
          { id: "address", title: "Delivery Address" },
          { id: "items", title: "Items" },
          { id: "itemsCount", title: "Items Count" },
          { id: "createdAt", title: "Created At" },
          { id: "updatedAt", title: "Updated At" },
        ],
      });

      await csvWriter.writeRecords(csvData);
      res.download("/tmp/orders.csv");
    }
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({ error: "Failed to export orders" });
    return;
  }
};

// Simple dashboard stats for the admin dashboard
export const getDashboardStats = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Get basic counts
    const totalProducts = await Product.countDocuments();
    const totalUsers = await User.countDocuments();
    const totalOrders = await Order.countDocuments();
    const totalDeliveryBoys = await DeliveryBoy.countDocuments();

    // Get recent orders count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentOrders = await Order.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Get total revenue (from paid orders)
    const totalRevenue = await Order.aggregate([
      { $match: { paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]);

    res.json({
      totalProducts,
      totalUsers,
      totalOrders,
      totalDeliveryBoys,
      recentOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
    });
    return;
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
    return;
  }
};

// Update product
export const updateProduct = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const { name, description, price, category, stock, weight, image, images } =
      req.body;

    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Validate required fields
    if (!name || !description || !price || !category || stock === undefined) {
      return res.status(400).json({
        error: "Name, description, price, category, and stock are required",
      });
    }

    // Prepare update data
    const updateData: any = {
      name,
      description,
      price: Number(price),
      category,
      stock: Number(stock),
      weight: weight ? Number(weight) : undefined,
      updatedAt: new Date(),
    };

    // Handle images - prioritize images array over single image
    if (images && Array.isArray(images)) {
      updateData.images = images;
    } else if (image) {
      updateData.images = [image];
    }

    // Find and update product
    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    console.error("Update product error:", error);
    res.status(500).json({ error: "Failed to update product" });
    return;
  }
};

// Delete product
export const deleteProduct = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Find and delete product
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json({
      message: "Product deleted successfully",
    });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ error: "Failed to delete product" });
    return;
  }
};

// Make user a delivery boy
export const makeDeliveryBoy = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;

    // Get admin user from authenticated request
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    // Find the user to update
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if delivery boy record already exists
    const existingDeliveryBoy = await DeliveryBoy.findOne({
      phone: user.phone,
    });
    if (existingDeliveryBoy) {
      return res.status(400).json({ error: "User is already a delivery boy" });
    }

    // Update user role to delivery
    user.role = "delivery";
    await user.save();

    // Create delivery boy record
    const deliveryBoy = new DeliveryBoy({
      name: user.name,
      phone: user.phone,
      vehicleType: "bike", // Default vehicle type
      currentLocation: {
        lat: 0,
        lng: 0,
        lastUpdatedAt: new Date(),
      },
      availability: "offline",
      isActive: true,
      earnings: 0,
      completedOrdersCount: 0,
      assignedOrders: [],
    });

    await deliveryBoy.save();

    res.json({
      success: true,
      message: "User promoted to Delivery Boy",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      deliveryBoy: {
        id: deliveryBoy._id,
        name: deliveryBoy.name,
        phone: deliveryBoy.phone,
        vehicleType: deliveryBoy.vehicleType,
      },
    });
  } catch (error) {
    console.error("Make delivery boy error:", error);
    res.status(500).json({ error: "Failed to promote user to delivery boy" });
    return;
  }
};
