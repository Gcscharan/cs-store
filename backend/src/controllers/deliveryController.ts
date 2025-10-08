import { Request, Response } from "express";
import { DeliveryBoy } from "../models/DeliveryBoy";
import { Order } from "../models/Order";

export const getAvailableDrivers = async (req: Request, res: Response) => {
  try {
    const drivers = await DeliveryBoy.find({
      availability: "available",
      isActive: true,
    }).select("name phone vehicleType currentLocation");

    res.json({ drivers });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch available drivers" });
  }
};

export const assignDelivery = async (req: Request, res: Response) => {
  try {
    const { orderId, driverId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    const driver = await DeliveryBoy.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    if (driver.availability !== "available") {
      return res.status(400).json({ error: "Driver not available" });
    }

    // Assign order to driver
    order.deliveryBoyId = driver._id;
    order.orderStatus = "assigned";
    await order.save();

    driver.assignedOrders.push(order._id);
    driver.availability = "busy";
    await driver.save();

    res.json({
      message: "Order assigned to driver successfully",
      order,
      driver,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to assign delivery" });
  }
};

export const updateLocation = async (req: Request, res: Response) => {
  try {
    const { lat, lng } = req.body;
    const driverId = (req as any).user._id;

    const driver = await DeliveryBoy.findById(driverId);
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    driver.currentLocation = {
      lat,
      lng,
      lastUpdatedAt: new Date(),
    };

    await driver.save();

    res.json({
      message: "Location updated successfully",
      location: driver.currentLocation,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update location" });
  }
};

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const { orderId, status, proofImage } = req.body;
    const driverId = (req as any).user._id;

    const order = await Order.findOne({
      _id: orderId,
      deliveryBoyId: driverId,
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Update order status
    order.orderStatus = status;
    await order.save();

    // If delivered, update driver earnings
    if (status === "delivered") {
      const driver = await DeliveryBoy.findById(driverId);
      if (driver) {
        // Calculate earnings: base ₹50 + ₹5 per km + ₹2 per minute saved
        const baseEarnings = 50;
        const distanceEarnings = 0; // Calculate based on distance
        const timeEarnings = 0; // Calculate based on time saved
        const totalEarnings = baseEarnings + distanceEarnings + timeEarnings;

        driver.earnings += totalEarnings;
        driver.completedOrdersCount += 1;
        driver.availability = "available";
        driver.assignedOrders = driver.assignedOrders.filter(
          (id) => id.toString() !== orderId
        );
        await driver.save();
      }
    }

    res.json({
      message: "Status updated successfully",
      order,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to update status" });
  }
};

export const getMyOrders = async (req: Request, res: Response) => {
  try {
    const driverId = (req as any).user._id;
    const { status } = req.query;

    const query: any = { deliveryBoyId: driverId };
    if (status) query.orderStatus = status;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .populate("userId", "name phone");

    res.json({ orders });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};
