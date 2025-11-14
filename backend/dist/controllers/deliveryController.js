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
exports.getAdminAddress = exports.checkDeliveryAvailability = exports.calculateDeliveryFeeController = void 0;
const deliveryFeeCalculator_1 = require("../utils/deliveryFeeCalculator");
const calculateDeliveryFeeController = async (req, res) => {
    try {
        const { userAddress, orderAmount } = req.body;
        if (!userAddress || !orderAmount) {
            res.status(400).json({
                error: "userAddress and orderAmount are required",
            });
            return;
        }
        if (!userAddress.lat || !userAddress.lng || !userAddress.pincode) {
            res.status(400).json({
                error: "userAddress must include lat, lng, and pincode",
            });
            return;
        }
        if (!(0, deliveryFeeCalculator_1.isDeliveryAvailable)(userAddress.pincode)) {
            res.status(400).json({
                error: "Delivery not available to this pincode",
            });
            return;
        }
        const feeDetails = await (0, deliveryFeeCalculator_1.calculateDeliveryFee)(userAddress, orderAmount);
        const breakdown = await (0, deliveryFeeCalculator_1.getDeliveryFeeBreakdown)(userAddress, orderAmount);
        res.json({
            success: true,
            data: {
                ...feeDetails,
                breakdown,
                userAddress: {
                    city: userAddress.city,
                    state: userAddress.state,
                    pincode: userAddress.pincode,
                },
            },
        });
    }
    catch (error) {
        console.error("Error calculating delivery fee:", error);
        res.status(500).json({
            error: "Failed to calculate delivery fee",
        });
    }
};
exports.calculateDeliveryFeeController = calculateDeliveryFeeController;
const checkDeliveryAvailability = async (req, res) => {
    try {
        const { pincode } = req.params;
        if (!pincode) {
            res.status(400).json({
                error: "Pincode is required",
            });
            return;
        }
        const isAvailable = (0, deliveryFeeCalculator_1.isDeliveryAvailable)(pincode);
        res.json({
            success: true,
            data: {
                pincode,
                isAvailable,
                message: isAvailable
                    ? "Delivery available to this pincode"
                    : "Delivery not available to this pincode",
            },
        });
    }
    catch (error) {
        console.error("Error checking delivery availability:", error);
        res.status(500).json({
            error: "Failed to check delivery availability",
        });
    }
};
exports.checkDeliveryAvailability = checkDeliveryAvailability;
const getAdminAddress = async (req, res) => {
    try {
        const { getAdminAddress } = await Promise.resolve().then(() => __importStar(require("../utils/deliveryFeeCalculator")));
        const adminAddress = getAdminAddress();
        res.json({
            success: true,
            data: {
                address: adminAddress,
                message: "Admin's default delivery address",
            },
        });
    }
    catch (error) {
        console.error("Error getting admin address:", error);
        res.status(500).json({
            error: "Failed to get admin address",
        });
    }
};
exports.getAdminAddress = getAdminAddress;
//# sourceMappingURL=deliveryController.js.map