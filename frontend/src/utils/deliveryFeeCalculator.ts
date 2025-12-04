// Define IAddress interface for frontend
interface IAddress {
  _id: string;
  label: string;
  pincode: string;
  city: string;
  state: string;
  addressLine: string;
  lat: number;
  lng: number;
  isDefault: boolean;
}

// Admin's warehouse address (Boya Bazar, Tiruvuru, Krishna District)
// Pincode: 521235
// Accurate GPS coordinates for Boya Bazar, Tiruvuru
const ADMIN_ADDRESS: IAddress = {
  _id: "admin-address",
  label: "Boya Bazar, Tiruvuru",
  pincode: "521235",
  city: "Tiruvuru",
  state: "Andhra Pradesh",
  addressLine: "Boya Bazar, Tiruvuru, Krishna District, Andhra Pradesh - 521235",
  lat: 17.0956,  // Accurate GPS for Boya Bazar, Tiruvuru
  lng: 80.6089,
  isDefault: true,
};

// Delivery fee configuration - Swiggy/Zomato style pricing
const DELIVERY_CONFIG = {
  FREE_DELIVERY_THRESHOLD: 2000, // Free delivery for orders ≥ ₹2000
  // New distance-based pricing tiers
  BASE_FEE_0_2_KM: 25,        // ₹25 for up to 2 km
  BASE_FEE_2_6_KM_MIN: 35,    // ₹35 minimum for 2-6 km range
  BASE_FEE_2_6_KM_MAX: 60,    // ₹60 maximum for 2-6 km range
  BASE_FEE_BEYOND_6_KM: 60,   // ₹60 base for beyond 6 km
  EXTRA_KM_RATE: 8,           // ₹8 per extra km beyond 6 km
};

/**
 * Calculate the distance between two coordinates using Haversine formula
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

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate delivery fee based on distance and order amount
 */
export function calculateDeliveryFee(
  userAddress: IAddress,
  orderAmount: number
): {
  distance: number;
  baseFee: number;
  distanceFee: number;
  totalFee: number;
  isFreeDelivery: boolean;
  finalFee: number;
} {
  // Validate user address coordinates
  if (
    !userAddress.lat ||
    !userAddress.lng ||
    userAddress.lat === 0 ||
    userAddress.lng === 0 ||
    isNaN(userAddress.lat) ||
    isNaN(userAddress.lng)
  ) {
    console.error("❌ [Frontend] Invalid user address coordinates - cannot calculate delivery fee");
    return {
      distance: 0,
      baseFee: 0,
      distanceFee: 0,
      totalFee: 0,
      isFreeDelivery: false,  // NOT free delivery - invalid address
      finalFee: 0,             // ₹0 with error banner shown
    };
  }

  // Calculate distance between warehouse and user's address
  const distance = calculateDistance(
    ADMIN_ADDRESS.lat,
    ADMIN_ADDRESS.lng,
    userAddress.lat,
    userAddress.lng
  );

  // Debug logs for verification
  console.log('🚚 Delivery Fee Calculation:', {
    warehouseCoords: { lat: ADMIN_ADDRESS.lat, lng: ADMIN_ADDRESS.lng, location: ADMIN_ADDRESS.addressLine },
    userCoords: { lat: userAddress.lat, lng: userAddress.lng, location: `${userAddress.city}, ${userAddress.state}` },
    calculatedDistance: `${distance.toFixed(2)} km`,
    orderAmount: `₹${orderAmount}`,
  });

  // Validate distance (should always be valid since addresses are auto-geocoded)
  if (isNaN(distance) || distance < 0) {
    console.error("❌ CRITICAL: Invalid distance calculated! Address may have invalid coordinates.");
    // This should never happen with auto-geocoding
    // Return high penalty fee to discourage orders with bad data
    const penaltyFee = 500;
    return {
      distance: 0,
      baseFee: penaltyFee,
      distanceFee: 0,
      totalFee: penaltyFee,
      isFreeDelivery: false,
      finalFee: penaltyFee,
    };
  }

  // Check if order qualifies for free delivery
  const isFreeDelivery = orderAmount >= DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD;

  if (isFreeDelivery) {
    console.log('✅ Free Delivery Applied! (Order ≥ ₹2000)');
    return {
      distance: Math.round(distance * 100) / 100,
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
    console.log(`📍 Distance: ${distance.toFixed(2)} km (≤2 km) → Base Fee: ₹${deliveryFee}`);
    
  } else if (distance <= 6) {
    // 2 to 6 km: ₹35 to ₹60 (progressive increase)
    // Linear interpolation: ₹35 at 2km → ₹60 at 6km
    const progressInRange = (distance - 2) / 4; // 0 to 1
    deliveryFee = DELIVERY_CONFIG.BASE_FEE_2_6_KM_MIN + 
                  (progressInRange * (DELIVERY_CONFIG.BASE_FEE_2_6_KM_MAX - DELIVERY_CONFIG.BASE_FEE_2_6_KM_MIN));
    deliveryFee = Math.round(deliveryFee); // Round to nearest rupee
    console.log(`📍 Distance: ${distance.toFixed(2)} km (2-6 km) → Progressive Fee: ₹${deliveryFee}`);
    
  } else {
    // Beyond 6 km: ₹60 + ₹8 per extra km
    const extraDistance = distance - 6;
    deliveryFee = DELIVERY_CONFIG.BASE_FEE_BEYOND_6_KM + (extraDistance * DELIVERY_CONFIG.EXTRA_KM_RATE);
    deliveryFee = Math.round(deliveryFee); // Round to nearest rupee
    console.log(`📍 Distance: ${distance.toFixed(2)} km (>6 km) → ₹60 + (${extraDistance.toFixed(2)} km × ₹8) = ₹${deliveryFee}`);
  }

  // Final fee
  const finalFee = deliveryFee;
  console.log(`💰 Final Delivery Fee: ₹${finalFee}`);

  return {
    distance: Math.round(distance * 100) / 100,
    baseFee: deliveryFee,
    distanceFee: 0, // No separate distance fee calculation
    totalFee: deliveryFee,
    isFreeDelivery: false,
    finalFee: deliveryFee,
  };
}

/**
 * Get delivery fee breakdown for display
 */
export function getDeliveryFeeBreakdown(
  userAddress: IAddress,
  orderAmount: number
): {
  distance: string;
  baseFee: string;
  distanceFee: string;
  totalFee: string;
  isFreeDelivery: boolean;
  finalFee: string;
  message: string;
} {
  const feeDetails = calculateDeliveryFee(userAddress, orderAmount);

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
 * Get admin's address
 */
export function getAdminAddress() {
  return ADMIN_ADDRESS;
}

/**
 * Check if delivery is available to a specific pincode
 */
export function isDeliveryAvailable(_pincode: string): boolean {
  // For now, we'll allow delivery to all pincodes
  // You can add specific pincode restrictions here
  return true;
}

/**
 * Check if a pincode is valid (6 digits)
 */
export function isValidPincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode);
}

/**
 * Format delivery fee for display
 */
export function formatDeliveryFee(fee: number, isFree: boolean): string {
  if (isFree) {
    return "FREE";
  }
  return `₹${fee.toFixed(2)}`;
}

/**
 * Delivery fee result interface
 */
export interface DeliveryFeeResult {
  distance: number;
  baseFee: number;
  distanceFee: number;
  totalFee: number;
  isFreeDelivery: boolean;
  finalFee: number;
  isDeliveryAvailable: boolean;
  error?: string;
}

/**
 * Calculate delivery fee for a pincode (async version for compatibility)
 */
export async function calculateDeliveryFeeForPincode(
  pincode: string,
  orderAmount: number
): Promise<DeliveryFeeResult> {
  // For now, we'll use a mock address for the pincode
  // In a real app, you'd look up the pincode to get coordinates
  const mockAddress: IAddress = {
    _id: `address-${pincode}`,
    label: "Delivery Address",
    pincode: pincode,
    city: "Unknown",
    state: "Unknown",
    addressLine: "Address",
    lat: 17.385, // Default to Hyderabad coordinates
    lng: 78.4867,
    isDefault: false,
  };

  const feeDetails = calculateDeliveryFee(mockAddress, orderAmount);

  return {
    ...feeDetails,
    isDeliveryAvailable: isDeliveryAvailable(pincode),
  };
}
