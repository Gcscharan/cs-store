import { Address } from "@vyaparsetu/types";

// ============================================================================
// Types
// ============================================================================

export type DeliveryAddress = Address;

export interface DeliveryFeeResult {
  deliveryFee: number | null;
  distance: number | null;
  requiresAddress: boolean;
  baseFee: number;
  distanceFee: number;
  totalFee: number;
  isFreeDelivery: boolean;
  finalFee: number;
  isDeliveryAvailable?: boolean;
  error?: string;
}

export interface DeliveryFeeBreakdown {
  distance: string;
  baseFee: string;
  distanceFee: string;
  totalFee: string;
  isFreeDelivery: boolean;
  finalFee: string;
  message: string;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Admin's warehouse address (Boya Bazar, Tiruvuru, Krishna District)
 * Pincode: 521235
 */
export const WAREHOUSE_ADDRESS: DeliveryAddress = {
  _id: "admin-address",
  label: "Boya Bazar, Tiruvuru",
  pincode: "521235",
  city: "Tiruvuru",
  state: "Andhra Pradesh",
  line1: "Boya Bazar, Tiruvuru",
  line2: "Krishna District",
  phone: "0000000000",
  name: "VyaparSetu Warehouse",
  lat: 17.0956,
  lng: 80.6089,
  isDefault: true,
};

/**
 * Delivery fee configuration - Swiggy/Zomato style pricing
 */
export const DELIVERY_CONFIG = {
  /** Free delivery for orders ≥ ₹2000 */
  FREE_DELIVERY_THRESHOLD: 2000,
  /** ₹25 for up to 2 km */
  BASE_FEE_0_2_KM: 25,
  /** ₹35 minimum for 2-6 km range */
  BASE_FEE_2_6_KM_MIN: 35,
  /** ₹60 maximum for 2-6 km range */
  BASE_FEE_2_6_KM_MAX: 60,
  /** ₹60 base for beyond 6 km */
  BASE_FEE_BEYOND_6_KM: 60,
  /** ₹8 per extra km beyond 6 km */
  EXTRA_KM_RATE: 8,
  /** Road distance factor (typically 30% more than straight-line in India) */
  ROAD_DISTANCE_FACTOR: 1.3,
} as const;

// ============================================================================
// Distance Calculation
// ============================================================================

/**
 * Calculate the distance between two coordinates using Haversine formula
 * @param lat1 - Latitude of first point
 * @param lng1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lng2 - Longitude of second point
 * @returns Distance in kilometers, rounded to 2 decimal places
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100;
}

// ============================================================================
// Delivery Fee Calculation
// ============================================================================

/**
 * Calculate delivery fee based on distance and order amount
 * @param userAddress - User's delivery address with coordinates
 * @param orderAmount - Total order amount in rupees
 * @returns Detailed delivery fee breakdown
 */
export function calculateDeliveryFee(
  userAddress: DeliveryAddress | undefined,
  orderAmount: number
): DeliveryFeeResult {
  // No address provided
  if (!userAddress) {
    return {
      deliveryFee: null,
      distance: null,
      requiresAddress: true,
      baseFee: 0,
      distanceFee: 0,
      totalFee: 0,
      isFreeDelivery: false,
      finalFee: 0,
    };
  }

  // Validate user address coordinates
  if (
    !userAddress.lat ||
    !userAddress.lng ||
    userAddress.lat === 0 ||
    userAddress.lng === 0 ||
    isNaN(userAddress.lat) ||
    isNaN(userAddress.lng)
  ) {
    return {
      deliveryFee: 0,
      distance: 0,
      requiresAddress: false,
      baseFee: 0,
      distanceFee: 0,
      totalFee: 0,
      isFreeDelivery: false,
      finalFee: 0,
      error: "Invalid address coordinates",
    };
  }

  // Calculate distance between warehouse and user's address
  const straightLineDistance = calculateDistance(
    WAREHOUSE_ADDRESS.lat!,
    WAREHOUSE_ADDRESS.lng!,
    userAddress.lat!,
    userAddress.lng!
  );

  // Apply road distance factor (e.g. 1.3 for India) to estimate road distance
  const distance = Math.round(straightLineDistance * DELIVERY_CONFIG.ROAD_DISTANCE_FACTOR * 100) / 100;

  // Validate distance
  if (isNaN(distance) || distance < 0) {
    const penaltyFee = 500;
    return {
      deliveryFee: penaltyFee,
      distance: 0,
      requiresAddress: false,
      baseFee: penaltyFee,
      distanceFee: 0,
      totalFee: penaltyFee,
      isFreeDelivery: false,
      finalFee: penaltyFee,
      error: "Invalid distance calculated",
    };
  }

  // Check if order qualifies for free delivery
  const isFreeDelivery = orderAmount >= DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD;

  if (isFreeDelivery) {
    return {
      deliveryFee: 0,
      distance: Math.round(distance * 100) / 100,
      requiresAddress: false,
      baseFee: 0,
      distanceFee: 0,
      totalFee: 0,
      isFreeDelivery: true,
      finalFee: 0,
    };
  }

  // Calculate delivery fee based on distance - Swiggy/Zomato style
  let deliveryFee: number;

  if (distance <= 2) {
    // Up to 2 km: ₹25
    deliveryFee = DELIVERY_CONFIG.BASE_FEE_0_2_KM;
  } else if (distance <= 6) {
    // 2 to 6 km: ₹35 to ₹60 (progressive increase)
    const progressInRange = (distance - 2) / 4;
    deliveryFee =
      DELIVERY_CONFIG.BASE_FEE_2_6_KM_MIN +
      progressInRange * (DELIVERY_CONFIG.BASE_FEE_2_6_KM_MAX - DELIVERY_CONFIG.BASE_FEE_2_6_KM_MIN);
    deliveryFee = Math.round(deliveryFee);
  } else {
    // Beyond 6 km: ₹60 + ₹8 per extra km
    const extraDistance = distance - 6;
    deliveryFee = DELIVERY_CONFIG.BASE_FEE_BEYOND_6_KM + extraDistance * DELIVERY_CONFIG.EXTRA_KM_RATE;
    deliveryFee = Math.round(deliveryFee);
  }

  return {
    deliveryFee: deliveryFee,
    distance: Math.round(distance * 100) / 100,
    requiresAddress: false,
    baseFee: deliveryFee,
    distanceFee: 0,
    totalFee: deliveryFee,
    isFreeDelivery: false,
    finalFee: deliveryFee,
  };
}

/**
 * Get delivery fee breakdown for display
 * @param userAddress - User's delivery address
 * @param orderAmount - Total order amount
 * @returns Formatted breakdown for UI display
 */
export function getDeliveryFeeBreakdown(
  userAddress: DeliveryAddress | undefined,
  orderAmount: number
): DeliveryFeeBreakdown {
  const feeDetails = calculateDeliveryFee(userAddress, orderAmount);

  if (feeDetails.requiresAddress) {
    return {
      distance: "",
      baseFee: "",
      distanceFee: "",
      totalFee: "",
      isFreeDelivery: false,
      finalFee: "",
      message: "Add delivery address to calculate delivery fee",
    };
  }

  return {
    distance: `${feeDetails.distance} km`,
    baseFee: `₹${feeDetails.baseFee}`,
    distanceFee: `₹${feeDetails.distanceFee}`,
    totalFee: `₹${feeDetails.totalFee}`,
    isFreeDelivery: feeDetails.isFreeDelivery,
    finalFee: `₹${feeDetails.finalFee}`,
    message: feeDetails.isFreeDelivery
      ? "Free delivery on orders above ₹2000"
      : `Distance: ${feeDetails.distance} km from Tiruvuru — Delivery charge: ₹${feeDetails.finalFee}`,
  };
}

/**
 * Get warehouse address
 * @returns Admin's warehouse address
 */
export function getWarehouseAddress(): DeliveryAddress {
  return WAREHOUSE_ADDRESS;
}

// Legacy alias for backward compatibility
export const getAdminAddress = getWarehouseAddress;

/**
 * Check if delivery is available to a specific pincode
 * @param _pincode - Pincode to check (currently allows all)
 * @returns Always true for now
 */
export function isDeliveryAvailable(_pincode: string): boolean {
  // For now, allow delivery to all pincodes
  return true;
}

/**
 * Check if a pincode is valid (6 digits)
 * @param pincode - Pincode to validate
 * @returns True if valid 6-digit pincode
 */
export function isValidPincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode);
}

/**
 * Format delivery fee for display
 * @param fee - Fee amount
 * @param isFree - Whether delivery is free
 * @returns Formatted string
 */
export function formatDeliveryFee(fee: number, isFree: boolean): string {
  if (isFree) {
    return "FREE";
  }
  return `₹${fee.toFixed(2)}`;
}

/**
 * Calculate delivery fee for a pincode (async version for compatibility)
 * @param pincode - Pincode to calculate for
 * @param orderAmount - Order amount
 * @returns Delivery fee result with availability status
 */
export async function calculateDeliveryFeeForPincode(
  pincode: string,
  orderAmount: number
): Promise<DeliveryFeeResult> {
  // Mock address for pincode (in real app, look up coordinates)
  const mockAddress: DeliveryAddress = {
    _id: `address-${pincode}`,
    label: "Delivery Address",
    pincode: pincode,
    city: "Unknown",
    state: "Unknown",
    line1: "Delivery Address",
    phone: "0000000000",
    name: "Customer",
    lat: 17.385,
    lng: 78.4867,
    isDefault: false,
  };

  const feeDetails = calculateDeliveryFee(mockAddress, orderAmount);

  return {
    ...feeDetails,
    isDeliveryAvailable: isDeliveryAvailable(pincode),
  };
}
