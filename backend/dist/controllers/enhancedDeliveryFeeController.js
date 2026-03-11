"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearDeliveryFeeCache = exports.estimateDeliveryFee = exports.getDeliveryFeeConfig = exports.calculateDeliveryFeeForSpecificAddress = exports.calculateDeliveryFeeForUser = void 0;
const logger_1 = require("../utils/logger");
const User_1 = require("../models/User");
const deliveryFeeService_1 = require("../services/deliveryFeeService");
/**
 * Calculate delivery fee for authenticated user's default address
 * GET /api/delivery-fee/calculate
 * Query params: ?orderAmount=1500&orderWeight=5&expressDelivery=false
 */
const calculateDeliveryFeeForUser = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        // Parse query parameters
        const orderAmount = parseFloat(req.query.orderAmount) || 0;
        const orderWeight = parseFloat(req.query.orderWeight) || 0;
        const expressDelivery = req.query.expressDelivery === "true";
        // Fetch user from database
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        // Get ONLY default address - no fallback to first address
        const defaultAddress = user.addresses?.find((addr) => addr.isDefault);
        if (!defaultAddress) {
            res.json({
                success: true,
                data: {
                    deliveryFee: null,
                    requiresAddress: true,
                    message: "Add delivery address to calculate delivery fee"
                }
            });
            return;
        }
        // Validate address has coordinates
        if (!defaultAddress.lat || !defaultAddress.lng) {
            res.status(400).json({
                success: false,
                message: "Address coordinates not found. Please update your address with valid location.",
            });
            return;
        }
        // Calculate delivery fee
        const result = await (0, deliveryFeeService_1.calculateDeliveryFeeForAddress)(defaultAddress, orderAmount, orderWeight, expressDelivery);
        res.json({
            success: true,
            data: {
                ...result,
                address: {
                    label: defaultAddress.label,
                    addressLine: defaultAddress.addressLine,
                    city: defaultAddress.city,
                    state: defaultAddress.state,
                    pincode: defaultAddress.pincode,
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Error calculating delivery fee:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to calculate delivery fee",
        });
    }
};
exports.calculateDeliveryFeeForUser = calculateDeliveryFeeForUser;
/**
 * Calculate delivery fee for a specific address
 * POST /api/delivery-fee/calculate-for-address
 * Body: { addressId: "xxx", orderAmount: 1500, orderWeight: 5, expressDelivery: false }
 */
const calculateDeliveryFeeForSpecificAddress = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: "Authentication required",
            });
            return;
        }
        const { addressId, orderAmount = 0, orderWeight = 0, expressDelivery = false } = req.body;
        if (!addressId) {
            res.status(400).json({
                success: false,
                message: "Address ID is required",
            });
            return;
        }
        // Fetch user from database
        const user = await User_1.User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        // Find the specific address
        const address = user.addresses?.find((addr) => addr._id?.toString() === addressId);
        if (!address) {
            res.status(404).json({
                success: false,
                message: "Address not found",
            });
            return;
        }
        // Validate address has coordinates
        if (!address.lat || !address.lng) {
            res.status(400).json({
                success: false,
                message: "Address coordinates not found. Please update your address with valid location.",
            });
            return;
        }
        // Calculate delivery fee
        const result = await (0, deliveryFeeService_1.calculateDeliveryFeeForAddress)(address, orderAmount, orderWeight, expressDelivery);
        res.json({
            success: true,
            data: {
                ...result,
                address: {
                    label: address.label,
                    addressLine: address.addressLine,
                    city: address.city,
                    state: address.state,
                    pincode: address.pincode,
                },
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Error calculating delivery fee:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to calculate delivery fee",
        });
    }
};
exports.calculateDeliveryFeeForSpecificAddress = calculateDeliveryFeeForSpecificAddress;
/**
 * Get delivery fee configuration and tiers
 * GET /api/delivery-fee/config
 */
const getDeliveryFeeConfig = async (req, res) => {
    try {
        const { DELIVERY_CONFIG, DELIVERY_TIERS, WAREHOUSES } = await Promise.resolve().then(() => __importStar(require("../config/deliveryFeeConfig")));
        res.json({
            success: true,
            data: {
                freeDeliveryThreshold: DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD,
                minimumFee: DELIVERY_CONFIG.MINIMUM_DELIVERY_FEE,
                maximumFee: DELIVERY_CONFIG.MAXIMUM_DELIVERY_FEE,
                expressDeliverySurcharge: DELIVERY_CONFIG.EXPRESS_DELIVERY_SURCHARGE,
                tiers: DELIVERY_TIERS.map((tier) => ({
                    distanceRange: `${tier.minDistance}-${tier.maxDistance === Infinity ? "∞" : tier.maxDistance} km`,
                    baseFee: tier.baseFee,
                    perKmFee: tier.perKmFee,
                    estimatedTime: tier.estimatedTime,
                })),
                warehouses: WAREHOUSES.filter((w) => w.isActive).map((w) => ({
                    name: w.name,
                    city: w.city,
                    state: w.state,
                })),
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Error fetching delivery fee config:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch delivery fee configuration",
        });
    }
};
exports.getDeliveryFeeConfig = getDeliveryFeeConfig;
/**
 * Calculate delivery fee estimate (guest users, no auth required)
 * POST /api/delivery-fee/estimate
 * Body: { pincode: "500001", orderAmount: 1500 }
 */
const estimateDeliveryFee = async (req, res) => {
    try {
        const { pincode, orderAmount = 0, orderWeight = 0 } = req.body;
        const pincodeStr = String(pincode || "").trim();
        if (!pincodeStr) {
            res.status(400).json({
                success: false,
                message: "Pincode is required",
            });
            return;
        }
        if (!/^\d{6}$/.test(pincodeStr)) {
            res.status(400).json({
                success: false,
                message: "Invalid pincode format",
            });
            return;
        }
        // Import Pincode model
        const { Pincode } = await Promise.resolve().then(() => __importStar(require("../models/Pincode")));
        // Look up pincode in database (single source of truth)
        // NOTE: Some environments may have pincodes stored as numbers (legacy) while schema expects string.
        // Query both forms to avoid false 404s.
        const pincodeRecord = await Pincode.findOne({
            $or: [{ pincode: pincodeStr }, { pincode: Number(pincodeStr) }],
        }).lean();
        logger_1.logger.info("[DELIVERY ESTIMATE DEBUG]", {
            requestPincode: pincode,
            normalized: pincodeStr,
            found: !!pincodeRecord,
        });
        if (!pincodeRecord) {
            res.status(404).json({
                success: false,
                message: "Pincode not found. Delivery may not be available in your area.",
            });
            return;
        }
        // Create a temporary address object (you may need to geocode the pincode)
        // For now, using approximate coordinates
        const tempAddress = {
            _id: "temp",
            name: "Estimated Location",
            label: "Temp",
            pincode: pincodeStr,
            city: pincodeRecord.district || "Unknown",
            state: pincodeRecord.state || "Unknown",
            postal_district: pincodeRecord.district || "Unknown",
            admin_district: pincodeRecord.district || "Unknown",
            addressLine: `${pincodeRecord.taluka || ""}, ${pincodeRecord.district || ""}`,
            phone: "0000000000",
            lat: 17.385, // Default to approximate location - in production, geocode this
            lng: 78.4867,
            isDefault: false,
        };
        const { WAREHOUSES } = await Promise.resolve().then(() => __importStar(require("../config/deliveryFeeConfig")));
        const activeWarehouses = (WAREHOUSES || []).filter((w) => w?.isActive);
        const warehouse = activeWarehouses[0];
        const distanceKm = warehouse
            ? Math.round((Math.sqrt(Math.pow(Number(tempAddress.lat) - Number(warehouse.lat), 2) +
                Math.pow(Number(tempAddress.lng) - Number(warehouse.lng), 2)) *
                111.32) *
                10) / 10
            : NaN;
        logger_1.logger.info("[DELIVERY DISTANCE]", {
            warehouse,
            destination: { lat: tempAddress.lat, lng: tempAddress.lng, pincode: tempAddress.pincode },
            distanceKm,
        });
        if (!Number.isFinite(distanceKm) || distanceKm < 0) {
            logger_1.logger.error("[DELIVERY DISTANCE ERROR]", { distanceKm });
            res.status(500).json({ message: "Invalid distance calculation" });
            return;
        }
        const result = await (0, deliveryFeeService_1.calculateDeliveryFeeForAddress)(tempAddress, orderAmount, orderWeight, false);
        if (!result?.delivery?.isDeliverable) {
            res.status(400).json({
                success: false,
                message: "Delivery not available to this pincode",
            });
            return;
        }
        res.status(200).json({
            deliveryFee: Number(result?.fees?.total || 0),
            distanceKm: Number(result?.distance?.value || 0),
            totalAmount: Number(orderAmount || 0),
        });
    }
    catch (error) {
        logger_1.logger.error("Error estimating delivery fee:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Failed to estimate delivery fee",
        });
    }
};
exports.estimateDeliveryFee = estimateDeliveryFee;
/**
 * Clear delivery fee distance cache (admin only)
 * POST /api/delivery-fee/clear-cache
 */
const clearDeliveryFeeCache = async (req, res) => {
    try {
        const user = req.user;
        // Check if user is admin
        if (!user || user.role !== "admin") {
            res.status(403).json({
                success: false,
                message: "Admin access required",
            });
            return;
        }
        const { clearDistanceCache, getCacheStats } = await Promise.resolve().then(() => __importStar(require("../services/deliveryFeeService")));
        const statsBefore = getCacheStats();
        clearDistanceCache();
        const statsAfter = getCacheStats();
        res.json({
            success: true,
            message: "Distance cache cleared successfully",
            data: {
                before: statsBefore,
                after: statsAfter,
            },
        });
    }
    catch (error) {
        logger_1.logger.error("Error clearing cache:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clear cache",
        });
    }
};
exports.clearDeliveryFeeCache = clearDeliveryFeeCache;
