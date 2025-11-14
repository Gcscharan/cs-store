import { Request, Response } from "express";
import { Order } from "../models/Order";
import { User, IUser } from "../models/User";
import { Product } from "../models/Product";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { createObjectCsvWriter } from "csv-writer";
import { routeAssignmentService } from "../services/routeAssignmentService";

// Analytics endpoint for admin dashboard
export const getAnalytics = async (req: Request, res: Response) => {
  try {
    // Total revenue from delivered orders only (as per MongoDB Orders model)
    const revenueData = await Order.aggregate([
      { $match: { orderStatus: "delivered", paymentStatus: "paid" } },
      { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } }
    ]);
    const totalRevenue = revenueData[0]?.totalRevenue || 0;

    // Total orders count
    const totalOrders = await Order.countDocuments();

    // Total users count
    const totalUsers = await User.countDocuments();

    // Total products count
    const totalProducts = await Product.countDocuments();

    // Monthly revenue for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyRevenue = await Order.aggregate([
      { 
        $match: { 
          createdAt: { $gte: sixMonthsAgo },
          orderStatus: "delivered",
          paymentStatus: "paid"
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          revenue: { $sum: "$totalAmount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format monthly revenue with month names
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const formattedMonthlyRevenue = monthlyRevenue.map(item => {
      const [year, month] = item._id.split("-");
      const monthIndex = parseInt(month) - 1;
      return {
        month: months[monthIndex],
        revenue: item.revenue
      };
    });

    // Top products by sales (from delivered orders)
    const topProducts = await Order.aggregate([
      { $match: { orderStatus: "delivered", paymentStatus: "paid" } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          sales: { $sum: "$items.quantity" },
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
        }
      },
      { $sort: { sales: -1 } },
      { $limit: 5 }
    ]);

    // Populate product names
    const topProductsWithNames = await Promise.all(
      topProducts.map(async (item) => {
        const product = await Product.findById(item._id);
        return {
          name: product?.name || "Unknown Product",
          sales: item.sales,
          revenue: item.revenue
        };
      })
    );

    // Recent orders
    const recentOrders = await Order.find()
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id totalAmount orderStatus createdAt");

    const formattedRecentOrders = recentOrders.map(order => ({
      id: order._id.toString().substring(0, 8),
      customer: (order.userId as any)?.name || "Unknown",
      amount: order.totalAmount,
      status: order.orderStatus || "pending"
    }));

    res.json({
      totalRevenue,
      totalOrders,
      totalUsers,
      totalProducts,
      monthlyRevenue: formattedMonthlyRevenue,
      topProducts: topProductsWithNames,
      recentOrders: formattedRecentOrders
    });
  } catch (error: any) {
    console.error("Get analytics error:", error);
    res.status(500).json({ 
      error: "Failed to fetch analytics",
      message: error.message
    });
  }
};

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

    // Fetch all orders with populated user, delivery boy, and product info
    const orders = await Order.find({})
      .populate("userId", "name email phone")
      .populate("deliveryBoyId", "name phone")
      .populate("items.productId", "name images")
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

    // Get total revenue (from delivered orders only)
    const totalRevenue = await Order.aggregate([
      { $match: { orderStatus: "delivered", paymentStatus: "paid" } },
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

export const updateOrderStatus = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const adminUser = (req as any).user;

    if (!adminUser) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (adminUser.role !== "admin") {
      return res
        .status(403)
        .json({ error: "Access denied. Admin role required." });
    }

    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: "Status is required" });
    }

    // Map user-friendly statuses to database statuses
    const statusMap: { [key: string]: string } = {
      pending: "created",
      assigned: "assigned",
      accepted: "assigned",
      picked_up: "picked_up",
      in_progress: "picked_up",
      in_transit: "in_transit",
      completed: "delivered",
      delivered: "delivered",
      declined: "cancelled",
      cancelled: "cancelled",
      // Also allow direct database values
      created: "created",
    };

    const mappedStatus = statusMap[status.toLowerCase()];
    if (!mappedStatus) {
      return res.status(400).json({ 
        error: "Invalid status. Valid values: pending, assigned, picked_up, in_transit, completed, declined" 
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    order.orderStatus = mappedStatus as any;
    await order.save();

    // Populate order details for response
    const updatedOrder = await Order.findById(orderId)
      .populate("userId", "name email phone")
      .populate("deliveryBoyId", "name phone")
      .populate("items.productId", "name images");

    return res.json({
      success: true,
      message: "Order status updated successfully",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({ error: "Failed to update order status" });
  }
};

/**
 * Accept order (Admin only) - Confirms order and triggers auto-assignment
 * POST /api/admin/orders/:orderId/accept
 */
export const acceptOrder = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const adminUser = (req as any).user;

    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    const { orderId } = req.params;
    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Idempotency: if already confirmed/assigned, return existing state
    if (order.orderStatus === "confirmed" || order.orderStatus === "assigned") {
      return res.json({
        success: true,
        message: "Order already accepted",
        order: await Order.findById(orderId)
          .populate("userId", "name email phone")
          .populate("deliveryBoyId", "name phone vehicleType"),
      });
    }

    // Validate status is pending or created
    if (order.orderStatus !== "pending" && order.orderStatus !== "created") {
      return res.status(400).json({ 
        error: `Cannot accept order in status: ${order.orderStatus}` 
      });
    }

    // Generate OTP for delivery verification (4-digit)
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    order.deliveryOtp = otp;
    order.deliveryOtpExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min expiry

    // Update order status to confirmed (Admin Accept -> Processing/Confirmed)
    order.orderStatus = "confirmed";
    order.deliveryStatus = "unassigned"; // Set to unassigned until delivery partner is assigned
    order.confirmedAt = new Date();

    // Add to history
    order.history = order.history || [];
    order.history.push({
      status: "confirmed",
      deliveryStatus: "unassigned",
      updatedBy: adminUser._id,
      updatedByRole: "admin",
      timestamp: new Date(),
      meta: { action: "accept" },
    } as any);

    await order.save();

    // Populate order for response
    const confirmedOrder = await Order.findById(orderId)
      .populate("userId", "name email phone")
      .populate("deliveryBoyId", "name phone");

    // Emit socket event to notify customer
    const io = (req as any).app.get("io");
    if (io) {
      io.to(`user_${order.userId}`).emit("order:accepted", {
        orderId: order._id,
        status: "confirmed",
        message: "Your order has been accepted and is being processed",
      });

      io.to("admin_room").emit("order:accepted", {
        orderId: order._id,
        status: "confirmed",
      });
    }

    return res.json({
      success: true,
      message: "Order accepted. Please assign a delivery partner.",
      order: confirmedOrder,
      requiresAssignment: true,
    });
  } catch (error: any) {
    console.error("Accept order error:", error);
    return res.status(500).json({ 
      error: "Failed to accept order",
      message: error.message,
    });
  }
};

/**
 * Decline order (Admin only) - Cancels order and triggers refund
 * POST /api/admin/orders/:orderId/decline
 */
export const declineOrder = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const adminUser = (req as any).user;

    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Validate status is pending
    if (order.orderStatus !== "pending" && order.orderStatus !== "created") {
      return res.status(400).json({ 
        error: `Cannot decline order in status: ${order.orderStatus}` 
      });
    }

    // Update order status to cancelled
    order.orderStatus = "cancelled";
    order.deliveryStatus = "cancelled";
    order.cancelledBy = "admin";
    order.cancelReason = reason || "Declined by admin";

    // Add to history
    order.history = order.history || [];
    order.history.push({
      status: "cancelled",
      deliveryStatus: "cancelled",
      updatedBy: adminUser._id,
      updatedByRole: "admin",
      timestamp: new Date(),
      meta: { action: "decline", reason },
    } as any);

    await order.save();

    // TODO: Trigger refund logic here if payment was already made
    if (order.paymentStatus === "paid") {
      // Set payment status to refunded (actual refund integration would go here)
      order.paymentStatus = "refunded";
      await order.save();
    }

    // TODO: Restock inventory
    // Loop through order.items and increment product stock

    // Emit socket event
    const io = (req as any).app.get("io");
    if (io) {
      io.to(`user_${order.userId}`).emit("order:cancelled", {
        orderId: order._id,
        status: "cancelled",
        reason: order.cancelReason,
        message: "Your order has been cancelled",
      });

      io.to("admin_room").emit("order:cancelled", {
        orderId: order._id,
        status: "cancelled",
      });
    }

    const updatedOrder = await Order.findById(orderId)
      .populate("userId", "name email phone");

    return res.json({
      success: true,
      message: "Order declined and cancelled successfully",
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("Decline order error:", error);
    return res.status(500).json({ 
      error: "Failed to decline order",
      message: error.message,
    });
  }
};

/**
 * Manual assignment endpoint - assigns order to selected delivery partner
 * PATCH /api/admin/orders/:orderId/assign
 */
export const manualAssignOrder = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const adminUser = (req as any).user;

    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    const { orderId } = req.params;
    const { deliveryBoyId } = req.body;

    console.log(`[ASSIGN] Admin ${adminUser._id} attempting to assign order ${orderId} to delivery boy ${deliveryBoyId}`);

    if (!deliveryBoyId) {
      console.log(`[ASSIGN] FAILED: deliveryBoyId not provided`);
      return res.status(400).json({ error: "deliveryBoyId is required" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      console.log(`[ASSIGN] FAILED: Order ${orderId} not found`);
      return res.status(404).json({ error: "Order not found" });
    }

    console.log(`[ASSIGN] Order ${orderId} current status: ${order.orderStatus}, delivery status: ${order.deliveryStatus}`);

    // Validate order is in assignable status (confirmed or assigned for reassignment)
    const assignableStatuses = ["confirmed", "assigned"];
    if (!assignableStatuses.includes(order.orderStatus)) {
      console.log(`[ASSIGN] FAILED: Order not in assignable status: ${order.orderStatus}`);
      return res.status(400).json({ 
        error: `Cannot assign order in status: ${order.orderStatus}. Order must be confirmed first.` 
      });
    }

    // Find the selected delivery partner
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    console.log(`[ASSIGN] Found delivery boy:`, deliveryBoy);

    if (!deliveryBoy) {
      console.log(`[ASSIGN] FAILED: Delivery partner ${deliveryBoyId} not found`);
      return res.status(404).json({ error: "Delivery partner not found" });
    }

    if (!deliveryBoy.isActive) {
      console.log(`[ASSIGN] FAILED: Delivery partner ${deliveryBoyId} is not active`);
      return res.status(400).json({ error: "Delivery partner is not active" });
    }

    console.log(`[ASSIGN] Assigning to delivery partner: ${deliveryBoy.name} (${deliveryBoy._id}) with userId: ${deliveryBoy.userId}`);

    // Handle reassignment - remove from previous delivery boy if exists
    const previousDeliveryBoyId = order.deliveryBoyId;
    if (previousDeliveryBoyId) {
      console.log(`[ASSIGN] Removing from previous delivery boy: ${previousDeliveryBoyId}`);
      
      // Find the previous delivery boy record by userId
      const previousDeliveryBoy = await DeliveryBoy.findOne({ userId: previousDeliveryBoyId });
      if (previousDeliveryBoy) {
        await DeliveryBoy.findByIdAndUpdate(previousDeliveryBoy._id, {
          $pull: { assignedOrders: order._id },
          $inc: { currentLoad: -1 },
        });
        console.log(`[ASSIGN] Removed order from previous delivery boy: ${previousDeliveryBoy.name}`);
      }
    }

    // Update order - use the User ID, not DeliveryBoy ID for population to work
    order.deliveryBoyId = deliveryBoy.userId;
    console.log(`[ASSIGN] Set order.deliveryBoyId to userId: ${deliveryBoy.userId}`);
    order.deliveryStatus = "assigned";
    order.orderStatus = "assigned";
    
    // Add to history
    order.history = order.history || [];
    order.history.push({
      status: "assigned",
      deliveryStatus: "assigned",
      updatedBy: adminUser._id,
      updatedByRole: "admin",
      timestamp: new Date(),
      meta: { action: "manual_assign", deliveryPartnerId: deliveryBoy._id, deliveryPartnerName: deliveryBoy.name },
    } as any);

    await order.save();

    // Update delivery boy
    await DeliveryBoy.findByIdAndUpdate(deliveryBoy._id, {
      $push: { assignedOrders: order._id },
      $inc: { currentLoad: 1 },
    });

    console.log(`[ASSIGN] SUCCESS: Order ${orderId} assigned to ${deliveryBoy.name} (${deliveryBoy._id})`);

    // Emit socket event to delivery partner
    const io = (req as any).app.get("io");
    if (io) {
      // Use correct room name: driver_ (not delivery_)
      const deliveryRoom = `driver_${deliveryBoy._id}`;
      console.log(`[ASSIGN] Emitting socket event to room: ${deliveryRoom}`);
      
      // Emit order assigned event with full order details
      io.to(deliveryRoom).emit("order:assigned", {
        orderId: order._id,
        orderDetails: order,
        message: "New order assigned to you",
      });

      // Emit refresh signal to force reload of orders list
      io.to(deliveryRoom).emit("refresh_orders");
      console.log(`[ASSIGN] Emitted refresh_orders to ${deliveryRoom}`);

      // Notify admin room
      io.to("admin_room").emit("order:assigned", {
        orderId: order._id,
        deliveryBoyId: deliveryBoy._id,
      });

      // Also emit to user room
      io.to(`user_${order.userId}`).emit("order:statusUpdate", {
        orderId: order._id,
        status: "assigned",
        message: "Your order has been assigned to a delivery partner",
      });
    }

    const updatedOrder = await Order.findById(orderId)
      .populate("userId", "name email phone")
      .populate("deliveryBoyId", "name phone");

    if (!updatedOrder) {
      return res.status(404).json({ error: "Order not found after assignment" });
    }

    console.log(`[ASSIGN] Returning populated order:`, {
      orderId: updatedOrder._id,
      deliveryBoyId: updatedOrder.deliveryBoyId,
      deliveryBoyIdType: typeof updatedOrder.deliveryBoyId
    });

    return res.json({
      success: true,
      message: `Order assigned to ${deliveryBoy.name}`,
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("Manual assign order error:", error);
    return res.status(500).json({ 
      error: "Failed to assign order",
      message: error.message,
    });
  }
};

// Approve delivery boy
export const approveDeliveryBoy = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const adminUser = (req as any).user;

    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    const { id } = req.params;
    const { assignedAreas } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "delivery") {
      return res.status(400).json({ error: "User is not a delivery partner" });
    }

    // Update user status
    user.status = "active";
    if (user.deliveryProfile && assignedAreas) {
      user.deliveryProfile.assignedAreas = assignedAreas;
      user.deliveryProfile.approvedAt = new Date();
      user.deliveryProfile.approvedBy = adminUser.userId;
    }
    await user.save();

    // Update delivery boy record
    const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });
    if (deliveryBoy) {
      deliveryBoy.isActive = true;
      await deliveryBoy.save();
    }

    // TODO: Send notification to delivery boy (email/push)

    return res.json({
      success: true,
      message: "Delivery partner approved successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Approve delivery boy error:", error);
    return res.status(500).json({ error: "Failed to approve delivery partner" });
  }
};

// Suspend delivery boy
export const suspendDeliveryBoy = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const adminUser = (req as any).user;

    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role !== "delivery") {
      return res.status(400).json({ error: "User is not a delivery partner" });
    }

    // Update user status
    user.status = "suspended";
    await user.save();

    // Update delivery boy record
    const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });
    if (deliveryBoy) {
      deliveryBoy.isActive = false;
      deliveryBoy.availability = "offline";
      await deliveryBoy.save();
    }

    // TODO: Send notification to delivery boy

    return res.json({
      success: true,
      message: "Delivery partner suspended",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        status: user.status,
      },
    });
  } catch (error) {
    console.error("Suspend delivery boy error:", error);
    return res.status(500).json({ error: "Failed to suspend delivery partner" });
  }
};

// Get delivery boys with filters
export const getDeliveryBoysList = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const adminUser = (req as any).user;

    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    const { status, area } = req.query;

    // Build query
    const query: any = { role: "delivery" };
    if (status) {
      query.status = status;
    }
    if (area && area !== "all") {
      query["deliveryProfile.assignedAreas"] = area;
    }

    const deliveryBoys = await User.find(query)
      .select("-passwordHash")
      .sort({ createdAt: -1 });

    // Get corresponding DeliveryBoy records
    const deliveryBoysWithDetails = await Promise.all(
      deliveryBoys.map(async (user) => {
        const deliveryBoy = await DeliveryBoy.findOne({ userId: user._id });
        return {
          user,
          deliveryBoy,
        };
      })
    );

    return res.json({
      success: true,
      deliveryBoys: deliveryBoysWithDetails,
    });
  } catch (error) {
    console.error("Get delivery boys list error:", error);
    return res.status(500).json({ error: "Failed to fetch delivery partners" });
  }
};

/**
 * Auto-assign pending deliveries using route-based batching
 * POST /api/admin/assign-deliveries
 */
export const autoAssignDeliveries = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const adminUser = (req as any).user;

    if (!adminUser || adminUser.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    // Execute route-based assignment
    const result = await routeAssignmentService.assignPendingOrders();

    return res.json({
      success: true,
      message: `Successfully assigned ${result.assignedCount} orders`,
      data: {
        assignedCount: result.assignedCount,
        failedCount: result.failedCount,
        details: result.details,
        errors: result.errors,
      },
    });
  } catch (error: any) {
    console.error("Auto-assign deliveries error:", error);
    return res.status(500).json({
      error: "Failed to auto-assign deliveries",
      message: error.message,
    });
  }
};
