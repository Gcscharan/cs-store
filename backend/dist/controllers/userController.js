"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDefaultAddress = exports.deleteUserAddress = exports.updateUserAddress = exports.addUserAddress = exports.getUserAddresses = void 0;
const User_1 = require("../models/User");
const mongoose_1 = __importDefault(require("mongoose"));
const getUserAddresses = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        const user = await User_1.User.findById(userId).select("addresses");
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        const transformedAddresses = (user.addresses || []).map((addr) => ({
            ...addr,
            id: addr._id.toString(),
        }));
        res.status(200).json({
            success: true,
            addresses: transformedAddresses,
        });
    }
    catch (error) {
        console.error("Error fetching user addresses:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.getUserAddresses = getUserAddresses;
const addUserAddress = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        const { label, pincode, city, state, addressLine, lat, lng, isDefault } = req.body;
        if (!label || !pincode || !city || !state || !addressLine) {
            res.status(400).json({
                success: false,
                message: "Missing required fields",
            });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        if (isDefault) {
            user.addresses.forEach((addr) => {
                addr.isDefault = false;
            });
        }
        const newAddress = {
            _id: new mongoose_1.default.Types.ObjectId(),
            label,
            pincode,
            city,
            state,
            addressLine,
            lat: lat || 0,
            lng: lng || 0,
            isDefault: isDefault || false,
        };
        user.addresses.push(newAddress);
        await user.save();
        res.status(201).json({
            success: true,
            message: "Address added successfully",
            address: {
                ...newAddress,
                id: newAddress._id.toString(),
            },
        });
    }
    catch (error) {
        console.error("Error adding user address:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.addUserAddress = addUserAddress;
const updateUserAddress = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        const { addressId } = req.params;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        const address = user.addresses.find((addr) => addr._id.toString() === addressId);
        if (!address) {
            res.status(404).json({
                success: false,
                message: "Address not found",
            });
            return;
        }
        const { label, pincode, city, state, addressLine, lat, lng, isDefault } = req.body;
        if (label)
            address.label = label;
        if (pincode)
            address.pincode = pincode;
        if (city)
            address.city = city;
        if (state)
            address.state = state;
        if (addressLine)
            address.addressLine = addressLine;
        if (lat !== undefined)
            address.lat = lat;
        if (lng !== undefined)
            address.lng = lng;
        if (isDefault !== undefined) {
            if (isDefault) {
                user.addresses.forEach((addr) => {
                    if (addr._id.toString() !== addressId) {
                        addr.isDefault = false;
                    }
                });
            }
            address.isDefault = isDefault;
        }
        await user.save();
        res.status(200).json({
            success: true,
            message: "Address updated successfully",
            address: {
                ...address,
                id: address._id.toString(),
            },
        });
    }
    catch (error) {
        console.error("Error updating user address:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.updateUserAddress = updateUserAddress;
const deleteUserAddress = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        const { addressId } = req.params;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "User not authenticated",
            });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        const address = user.addresses.find((addr) => addr._id.toString() === addressId);
        if (!address) {
            res.status(404).json({
                success: false,
                message: "Address not found",
            });
            return;
        }
        user.addresses = user.addresses.filter((addr) => addr._id.toString() !== addressId);
        await user.save();
        res.status(200).json({
            success: true,
            message: "Address deleted successfully",
        });
    }
    catch (error) {
        console.error("Error deleting user address:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.deleteUserAddress = deleteUserAddress;
const setDefaultAddress = async (req, res) => {
    try {
        const userId = req.userId || req.user?._id;
        const { addressId } = req.params;
        if (!userId) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        const address = user.addresses.find((addr) => addr._id.toString() === addressId);
        if (!address) {
            res.status(404).json({ success: false, message: "Address not found" });
            return;
        }
        user.addresses.forEach((addr) => {
            addr.isDefault = false;
        });
        address.isDefault = true;
        await user.save();
        res.status(200).json({
            success: true,
            message: "Default address updated successfully",
            address: {
                ...address,
                id: address._id.toString(),
            },
        });
    }
    catch (error) {
        console.error("Error setting default address:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.setDefaultAddress = setDefaultAddress;
//# sourceMappingURL=userController.js.map