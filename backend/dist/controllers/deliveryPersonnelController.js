"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearDeliveryBoyRoute = exports.getDeliveryBoyRoute = exports.updateDeliveryBoyLocation = exports.deleteDeliveryPersonnel = exports.updateDeliveryPersonnel = exports.addDeliveryPersonnel = exports.getDeliveryPersonnel = void 0;
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const User_1 = require("../models/User");
const smartAssignmentService_1 = require("../services/smartAssignmentService");
/**
 * Get all delivery personnel
 * GET /api/delivery
 */
const getDeliveryPersonnel = async (req, res) => {
    try {
        const deliveryBoys = await DeliveryBoy_1.DeliveryBoy.find()
            .sort({ createdAt: -1 })
            .lean();
        res.json({
            success: true,
            deliveryBoys: deliveryBoys,
        });
    }
    catch (error) {
        console.error("Error fetching delivery personnel:", error);
        res.status(500).json({
            error: "Failed to load delivery personnel. Please try again later.",
        });
    }
};
exports.getDeliveryPersonnel = getDeliveryPersonnel;
/**
 * Add new delivery personnel
 * POST /api/delivery
 */
const addDeliveryPersonnel = async (req, res) => {
    try {
        const { name, phone, vehicleType } = req.body;
        // Validate required fields
        if (!name || !phone || !vehicleType) {
            res.status(400).json({
                error: "Name, phone, and vehicle type are required",
            });
            return;
        }
        // Check if phone number already exists
        const existingDeliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ phone });
        if (existingDeliveryBoy) {
            res.status(400).json({
                error: "A delivery boy with this phone number already exists",
            });
            return;
        }
        // Create new delivery boy
        const deliveryBoy = new DeliveryBoy_1.DeliveryBoy({
            name,
            phone,
            vehicleType,
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
        res.status(201).json({
            success: true,
            message: "Delivery personnel added successfully",
            deliveryBoy: {
                id: deliveryBoy._id,
                name: deliveryBoy.name,
                phone: deliveryBoy.phone,
                vehicleType: deliveryBoy.vehicleType,
                availability: deliveryBoy.availability,
                isActive: deliveryBoy.isActive,
            },
        });
    }
    catch (error) {
        console.error("Error adding delivery personnel:", error);
        res.status(500).json({
            error: "Failed to add delivery personnel. Please try again later.",
        });
    }
};
exports.addDeliveryPersonnel = addDeliveryPersonnel;
/**
 * Update delivery personnel
 * PUT /api/delivery/:id
 */
const updateDeliveryPersonnel = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, vehicleType, availability, isActive } = req.body;
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findById(id);
        if (!deliveryBoy) {
            res.status(404).json({
                error: "Delivery personnel not found",
            });
            return;
        }
        // Update fields if provided
        if (name)
            deliveryBoy.name = name;
        if (phone)
            deliveryBoy.phone = phone;
        if (vehicleType)
            deliveryBoy.vehicleType = vehicleType;
        if (availability)
            deliveryBoy.availability = availability;
        if (typeof isActive === "boolean")
            deliveryBoy.isActive = isActive;
        await deliveryBoy.save();
        res.json({
            success: true,
            message: "Delivery personnel updated successfully",
            deliveryBoy: {
                id: deliveryBoy._id,
                name: deliveryBoy.name,
                phone: deliveryBoy.phone,
                vehicleType: deliveryBoy.vehicleType,
                availability: deliveryBoy.availability,
                isActive: deliveryBoy.isActive,
            },
        });
    }
    catch (error) {
        console.error("Error updating delivery personnel:", error);
        res.status(500).json({
            error: "Failed to update delivery personnel. Please try again later.",
        });
    }
};
exports.updateDeliveryPersonnel = updateDeliveryPersonnel;
/**
 * Delete delivery personnel
 * DELETE /api/delivery/:id
 */
const deleteDeliveryPersonnel = async (req, res) => {
    try {
        const { id } = req.params;
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findById(id);
        if (!deliveryBoy) {
            res.status(404).json({
                error: "Delivery personnel not found",
            });
            return;
        }
        // Also update the corresponding user's role if it exists
        if (deliveryBoy.userId) {
            await User_1.User.findByIdAndUpdate(deliveryBoy.userId, { role: "customer" });
        }
        await DeliveryBoy_1.DeliveryBoy.findByIdAndDelete(id);
        res.json({
            success: true,
            message: "Delivery personnel deleted successfully",
        });
    }
    catch (error) {
        console.error("Error deleting delivery personnel:", error);
        res.status(500).json({
            error: "Failed to delete delivery personnel. Please try again later.",
        });
    }
};
exports.deleteDeliveryPersonnel = deleteDeliveryPersonnel;
/**
 * Update delivery boy location (for real-time tracking)
 * PUT /api/delivery-personnel/:id/location
 */
const updateDeliveryBoyLocation = async (req, res) => {
    try {
        const { id } = req.params;
        const { lat, lng } = req.body;
        if (!lat || !lng) {
            res.status(400).json({
                error: "Latitude and longitude are required",
            });
            return;
        }
        // Update location in database
        const deliveryBoy = await DeliveryBoy_1.DeliveryBoy.findByIdAndUpdate(id, {
            $set: {
                "currentLocation.lat": lat,
                "currentLocation.lng": lng,
                "currentLocation.lastUpdatedAt": new Date(),
            },
        }, { new: true });
        if (!deliveryBoy) {
            res.status(404).json({
                error: "Delivery boy not found",
            });
            return;
        }
        res.json({
            success: true,
            message: "Location updated successfully",
            location: deliveryBoy.currentLocation,
        });
    }
    catch (error) {
        console.error("Error updating delivery boy location:", error);
        res.status(500).json({
            error: "Failed to update location. Please try again later.",
        });
    }
};
exports.updateDeliveryBoyLocation = updateDeliveryBoyLocation;
/**
 * Get delivery boy's active route
 * GET /api/delivery-personnel/:id/route
 */
const getDeliveryBoyRoute = async (req, res) => {
    try {
        const { id } = req.params;
        const route = await smartAssignmentService_1.smartAssignmentService.getDeliveryBoyRoute(id);
        if (!route) {
            res.status(404).json({
                error: "No active route found for this delivery boy",
            });
            return;
        }
        res.json({
            success: true,
            route,
        });
    }
    catch (error) {
        console.error("Error fetching delivery boy route:", error);
        res.status(500).json({
            error: "Failed to fetch route. Please try again later.",
        });
    }
};
exports.getDeliveryBoyRoute = getDeliveryBoyRoute;
/**
 * Clear delivery boy's active route (when delivery is completed)
 * DELETE /api/delivery-personnel/:id/route
 */
const clearDeliveryBoyRoute = async (req, res) => {
    try {
        const { id } = req.params;
        await smartAssignmentService_1.smartAssignmentService.clearDeliveryBoyRoute(id);
        res.json({
            success: true,
            message: "Route cleared successfully",
        });
    }
    catch (error) {
        console.error("Error clearing delivery boy route:", error);
        res.status(500).json({
            error: "Failed to clear route. Please try again later.",
        });
    }
};
exports.clearDeliveryBoyRoute = clearDeliveryBoyRoute;
