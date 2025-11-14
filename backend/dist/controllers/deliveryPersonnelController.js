"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDeliveryPersonnel = exports.updateDeliveryPersonnel = exports.addDeliveryPersonnel = exports.getDeliveryPersonnel = void 0;
const DeliveryBoy_1 = require("../models/DeliveryBoy");
const User_1 = require("../models/User");
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
const addDeliveryPersonnel = async (req, res) => {
    try {
        const { name, phone, vehicleType } = req.body;
        if (!name || !phone || !vehicleType) {
            res.status(400).json({
                error: "Name, phone, and vehicle type are required",
            });
            return;
        }
        const existingDeliveryBoy = await DeliveryBoy_1.DeliveryBoy.findOne({ phone });
        if (existingDeliveryBoy) {
            res.status(400).json({
                error: "A delivery boy with this phone number already exists",
            });
            return;
        }
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
//# sourceMappingURL=deliveryPersonnelController.js.map