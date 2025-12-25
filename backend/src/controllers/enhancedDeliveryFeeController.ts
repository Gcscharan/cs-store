/**
 * Enhanced Delivery Fee Controller
 * Handles API requests for delivery fee calculation
 * Automatically fetches user's default address from database
 */

import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { User } from "../models/User";
import { calculateDeliveryFeeForAddress } from "../services/deliveryFeeService";

/**
 * Calculate delivery fee for authenticated user's default address
 * GET /api/delivery-fee/calculate
 * Query params: ?orderAmount=1500&orderWeight=5&expressDelivery=false
 */
export const calculateDeliveryFeeForUser = async (req: AuthRequest, res: Response): Promise<void> => {
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
    const orderAmount = parseFloat(req.query.orderAmount as string) || 0;
    const orderWeight = parseFloat(req.query.orderWeight as string) || 0;
    const expressDelivery = req.query.expressDelivery === "true";

    // Fetch user from database
    const user = await User.findById(userId);

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
    const result = await calculateDeliveryFeeForAddress(defaultAddress, orderAmount, orderWeight, expressDelivery);

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
  } catch (error: any) {
    console.error("Error calculating delivery fee:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to calculate delivery fee",
    });
  }
};

/**
 * Calculate delivery fee for a specific address
 * POST /api/delivery-fee/calculate-for-address
 * Body: { addressId: "xxx", orderAmount: 1500, orderWeight: 5, expressDelivery: false }
 */
export const calculateDeliveryFeeForSpecificAddress = async (req: AuthRequest, res: Response): Promise<void> => {
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
    const user = await User.findById(userId);

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
    const result = await calculateDeliveryFeeForAddress(address, orderAmount, orderWeight, expressDelivery);

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
  } catch (error: any) {
    console.error("Error calculating delivery fee:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to calculate delivery fee",
    });
  }
};

/**
 * Get delivery fee configuration and tiers
 * GET /api/delivery-fee/config
 */
export const getDeliveryFeeConfig = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { DELIVERY_CONFIG, DELIVERY_TIERS, WAREHOUSES } = await import("../config/deliveryFeeConfig");

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
  } catch (error: any) {
    console.error("Error fetching delivery fee config:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch delivery fee configuration",
    });
  }
};

/**
 * Calculate delivery fee estimate (guest users, no auth required)
 * POST /api/delivery-fee/estimate
 * Body: { pincode: "500001", orderAmount: 1500 }
 */
export const estimateDeliveryFee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pincode, orderAmount = 0, orderWeight = 0 } = req.body;

    if (!pincode) {
      res.status(400).json({
        success: false,
        message: "Pincode is required",
      });
      return;
    }

    // Import Pincode model
    const { Pincode } = await import("../models/Pincode");

    // Look up pincode in database
    const pincodeData = await Pincode.findOne({ pincode });

    if (!pincodeData) {
      res.status(404).json({
        success: false,
        message: "Pincode not found. Delivery may not be available in your area.",
      });
      return;
    }

    // Create a temporary address object (you may need to geocode the pincode)
    // For now, using approximate coordinates
    const tempAddress = {
      _id: "temp" as any,
      name: "Estimated Location",
      label: "Temp",
      pincode: pincode,
      city: pincodeData.district || "Unknown",
      state: pincodeData.state || "Unknown",
      postal_district: pincodeData.district || "Unknown",
      admin_district: pincodeData.district || "Unknown",
      addressLine: `${pincodeData.taluka || ""}, ${pincodeData.district || ""}`,
      phone: "0000000000",
      lat: 17.385, // Default to approximate location - in production, geocode this
      lng: 78.4867,
      isDefault: false,
    };

    const result = await calculateDeliveryFeeForAddress(tempAddress, orderAmount, orderWeight, false);

    res.json({
      success: true,
      data: {
        ...result,
        note: "This is an estimated delivery fee. Actual fee may vary based on exact location.",
      },
    });
  } catch (error: any) {
    console.error("Error estimating delivery fee:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to estimate delivery fee",
    });
  }
};

/**
 * Clear delivery fee distance cache (admin only)
 * POST /api/delivery-fee/clear-cache
 */
export const clearDeliveryFeeCache = async (req: AuthRequest, res: Response): Promise<void> => {
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

    const { clearDistanceCache, getCacheStats } = await import("../services/deliveryFeeService");

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
  } catch (error: any) {
    console.error("Error clearing cache:", error);
    res.status(500).json({
      success: false,
      message: "Failed to clear cache",
    });
  }
};
