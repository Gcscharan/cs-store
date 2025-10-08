import { Request, Response } from "express";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { Order } from "../models/Order";
import { User } from "../models/User";

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Get all delivery boys (admin only)
export const getAllDeliveryBoys = async (req: Request, res: Response) => {
  try {
    const deliveryBoys = await DeliveryBoy.find()
      .populate("assignedOrders", "orderStatus totalAmount createdAt")
      .sort({ createdAt: -1 });

    res.json({
      deliveryBoys,
      total: deliveryBoys.length,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch delivery boys" });
    return;
  }
};

// Get delivery boy by ID
export const getDeliveryBoyById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deliveryBoy = await DeliveryBoy.findById(id).populate(
      "assignedOrders",
      "orderStatus totalAmount createdAt address"
    );

    if (!deliveryBoy) {
      return res.status(404).json({ error: "Delivery boy not found" });
    }

    res.json(deliveryBoy);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch delivery boy" });
    return;
  }
};

// Create new delivery boy (admin only)
export const createDeliveryBoy = async (req: Request, res: Response) => {
  try {
    const { name, phone, vehicleType, currentLocation } = req.body;

    // Check if phone already exists
    const existingDeliveryBoy = await DeliveryBoy.findOne({ phone });
    if (existingDeliveryBoy) {
      return res.status(400).json({ error: "Phone number already registered" });
    }

    const deliveryBoy = new DeliveryBoy({
      name,
      phone,
      vehicleType,
      currentLocation: currentLocation || {
        lat: 0,
        lng: 0,
        lastUpdatedAt: new Date(),
      },
      availability: "offline",
      isActive: true,
    });

    await deliveryBoy.save();

    res.status(201).json({
      message: "Delivery boy created successfully",
      deliveryBoy,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create delivery boy" });
    return;
  }
};

// Update delivery boy
export const updateDeliveryBoy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const deliveryBoy = await DeliveryBoy.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!deliveryBoy) {
      return res.status(404).json({ error: "Delivery boy not found" });
    }

    res.json({
      message: "Delivery boy updated successfully",
      deliveryBoy,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update delivery boy" });
    return;
  }
};

// Delete delivery boy
export const deleteDeliveryBoy = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const deliveryBoy = await DeliveryBoy.findByIdAndDelete(id);

    if (!deliveryBoy) {
      return res.status(404).json({ error: "Delivery boy not found" });
    }

    res.json({
      message: "Delivery boy deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete delivery boy" });
    return;
  }
};

// Get available delivery boys
export const getAvailableDeliveryBoys = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.query;

    let query: any = {
      isActive: true,
      availability: "available",
    };

    const deliveryBoys = await DeliveryBoy.find(query);

    // If location provided, sort by distance
    if (lat && lng) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);

      const deliveryBoysWithDistance = deliveryBoys.map((db) => ({
        ...db.toObject(),
        distance: calculateDistance(
          userLat,
          userLng,
          db.currentLocation.lat,
          db.currentLocation.lng
        ),
      }));

      deliveryBoysWithDistance.sort((a, b) => a.distance - b.distance);

      return res.json({
        deliveryBoys: deliveryBoysWithDistance,
        total: deliveryBoysWithDistance.length,
      });
    }

    res.json({
      deliveryBoys,
      total: deliveryBoys.length,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch available delivery boys" });
    return;
  }
};

// Assign order to delivery boy
export const assignOrder = async (req: Request, res: Response) => {
  try {
    const { orderId, deliveryBoyId } = req.body;

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Find delivery boy
    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({ error: "Delivery boy not found" });
    }

    // Check if delivery boy is available
    if (deliveryBoy.availability !== "available") {
      return res.status(400).json({ error: "Delivery boy is not available" });
    }

    // Update order
    order.deliveryBoyId = deliveryBoy._id;
    order.orderStatus = "assigned";
    await order.save();

    // Update delivery boy
    deliveryBoy.assignedOrders.push(order._id);
    deliveryBoy.availability = "busy";
    await deliveryBoy.save();

    res.json({
      message: "Order assigned successfully",
      order,
      deliveryBoy: {
        id: deliveryBoy._id,
        name: deliveryBoy.name,
        phone: deliveryBoy.phone,
        vehicleType: deliveryBoy.vehicleType,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to assign order" });
    return;
  }
};

// Auto-assign order to nearest available delivery boy
export const autoAssignOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.body;

    // Find order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Get available delivery boys
    const availableDeliveryBoys = await DeliveryBoy.find({
      isActive: true,
      availability: "available",
    });

    if (availableDeliveryBoys.length === 0) {
      return res.status(400).json({ error: "No available delivery boys" });
    }

    // Calculate distances and workload scores
    const deliveryBoysWithScore = availableDeliveryBoys.map((db) => {
      const distance = calculateDistance(
        order.address.lat,
        order.address.lng,
        db.currentLocation.lat,
        db.currentLocation.lng
      );

      const workload = db.assignedOrders.length;
      const score = distance + workload * 2; // Weight workload more than distance

      return {
        deliveryBoy: db,
        distance,
        workload,
        score,
      };
    });

    // Sort by score (lower is better)
    deliveryBoysWithScore.sort((a, b) => a.score - b.score);

    const selectedDeliveryBoy = deliveryBoysWithScore[0].deliveryBoy;

    // Assign order
    order.deliveryBoyId = selectedDeliveryBoy._id;
    order.orderStatus = "assigned";
    await order.save();

    // Update delivery boy
    selectedDeliveryBoy.assignedOrders.push(order._id);
    selectedDeliveryBoy.availability = "busy";
    await selectedDeliveryBoy.save();

    res.json({
      message: "Order auto-assigned successfully",
      order,
      deliveryBoy: {
        id: selectedDeliveryBoy._id,
        name: selectedDeliveryBoy.name,
        phone: selectedDeliveryBoy.phone,
        vehicleType: selectedDeliveryBoy.vehicleType,
        distance: deliveryBoysWithScore[0].distance,
        workload: deliveryBoysWithScore[0].workload,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to auto-assign order" });
    return;
  }
};

// Update delivery boy location
export const updateLocation = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;
    const deliveryBoyId = (req as any).user._id;

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({ error: "Delivery boy not found" });
    }

    // Update location
    deliveryBoy.currentLocation = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      lastUpdatedAt: new Date(),
    };

    await deliveryBoy.save();

    // Emit location update via socket
    const io = (req as any).app.get("io");
    if (io) {
      io.to("admin_room").emit("driver:location:update", {
        driverId: deliveryBoy._id,
        lat: deliveryBoy.currentLocation.lat,
        lng: deliveryBoy.currentLocation.lng,
        lastUpdatedAt: deliveryBoy.currentLocation.lastUpdatedAt,
      });

      // Emit to order rooms
      for (const orderId of deliveryBoy.assignedOrders) {
        io.to(`order_${orderId}`).emit("driver:location:update", {
          driverId: deliveryBoy._id,
          lat: deliveryBoy.currentLocation.lat,
          lng: deliveryBoy.currentLocation.lng,
          lastUpdatedAt: deliveryBoy.currentLocation.lastUpdatedAt,
        });
      }
    }

    res.json({
      message: "Location updated successfully",
      location: deliveryBoy.currentLocation,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update location" });
    return;
  }
};

// Update order status (delivery boy)
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId, status, proofImage } = req.body;
    const deliveryBoyId = (req as any).user._id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if delivery boy is assigned to this order
    if (order.deliveryBoyId?.toString() !== deliveryBoyId) {
      return res
        .status(403)
        .json({ error: "Not authorized to update this order" });
    }

    // Update order status
    order.orderStatus = status;
    if (proofImage) {
      order.deliveryProof = proofImage;
    }
    await order.save();

    // Emit status update via socket
    const io = (req as any).app.get("io");
    if (io) {
      io.to(`order_${orderId}`).emit("order:status:update", {
        orderId,
        status,
        updatedAt: new Date(),
      });

      io.to("admin_room").emit("order:status:update", {
        orderId,
        status,
        updatedAt: new Date(),
      });
    }

    res.json({
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update order status" });
    return;
  }
};

// Get delivery boy's assigned orders
export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const deliveryBoyId = (req as any).user._id;

    const orders = await Order.find({ deliveryBoyId })
      .populate("userId", "name phone")
      .sort({ createdAt: -1 });

    res.json({
      orders,
      total: orders.length,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
    return;
  }
};

// Get delivery boy earnings
export const getEarnings = async (req: Request, res: Response) => {
  try {
    const deliveryBoyId = (req as any).user._id;

    const deliveryBoy = await DeliveryBoy.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({ error: "Delivery boy not found" });
    }

    // Get completed orders for detailed earnings
    const completedOrders = await Order.find({
      deliveryBoyId,
      orderStatus: "delivered",
    }).sort({ updatedAt: -1 });

    res.json({
      totalEarnings: deliveryBoy.earnings,
      completedOrdersCount: deliveryBoy.completedOrdersCount,
      orders: completedOrders,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch earnings" });
    return;
  }
};
