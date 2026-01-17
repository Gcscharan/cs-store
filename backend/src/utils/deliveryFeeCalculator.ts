import { IAddress } from "../models/User";
import mongoose from "mongoose";
import { Client, UnitSystem } from "@googlemaps/google-maps-services-js";

// Admin's warehouse address (Boya Bazar, Tiruvuru, Krishna District)
// Pincode: 521235
// Accurate GPS coordinates for Boya Bazar, Tiruvuru
const ADMIN_ADDRESS: IAddress = {
  _id: "admin-address" as any,
  name: "Admin Warehouse",
  phone: "",
  label: "Boya Bazar, Tiruvuru",
  pincode: "521235",
  city: "Tiruvuru",
  state: "Andhra Pradesh",
  postal_district: "Krishna",
  admin_district: "NTR",
  addressLine: "Boya Bazar, Tiruvuru, Krishna District, Andhra Pradesh - 521235",
  lat: 17.0956,  // Accurate GPS for Boya Bazar, Tiruvuru
  lng: 80.6089,
  isDefault: true,
};

// Google Maps client
const googleMapsClient = new Client({});

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
 * Validate that address has valid coordinates
 * @param address Address to validate
 * @returns { isValid: boolean, error?: string }
 */
export function validateAddressCoordinates(address: IAddress): { isValid: boolean; error?: string } {
  if (!address) {
    return { isValid: false, error: 'Address is required' };
  }

  // Convert to numbers, handling various input types
  let lat: number;
  let lng: number;

  try {
    lat = typeof address.lat === 'number' ? address.lat : parseFloat(String(address.lat || ''));
    lng = typeof address.lng === 'number' ? address.lng : parseFloat(String(address.lng || ''));
  } catch (e) {
    return { isValid: false, error: 'Address coordinates are invalid (parsing error)' };
  }

  // Check if coordinates exist and are valid numbers
  if (isNaN(lat) || isNaN(lng)) {
    return { isValid: false, error: 'Address coordinates are invalid (NaN)' };
  }

  // Check if coordinates are zero (invalid)
  if (lat === 0 || lng === 0) {
    return { isValid: false, error: 'Address coordinates are invalid (zero values)' };
  }

  // Validate coordinates are within India bounds
  const isInIndia = lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98;
  if (!isInIndia) {
    return { isValid: false, error: `Address coordinates outside India bounds (lat=${lat}, lng=${lng})` };
  }

  return { isValid: true };
}

/**
 * Calculate the distance between two coordinates using Haversine formula
 * @param lat1 Latitude of first point
 * @param lng1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lng2 Longitude of second point
 * @returns Distance in kilometers
 */
export function calculateHaversineDistance(
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
 * IMPORTANT: This function trusts saved coordinates and does NOT re-geocode
 * @param userAddress User's delivery address (must have valid saved coordinates)
 * @param orderAmount Total order amount
 * @returns Delivery fee details
 * @throws Error if coordinates are invalid
 */
export async function calculateDeliveryFee(
  userAddress: IAddress,
  orderAmount: number
): Promise<{
  distance: number;
  baseFee: number;
  distanceFee: number;
  totalFee: number;
  isFreeDelivery: boolean;
  finalFee: number;
  distanceFrom: string;
  coordsSource: 'saved';
  error?: string;
}> {
  // STEP 1: Validate saved coordinates (NO re-geocoding)
  const coordValidation = validateAddressCoordinates(userAddress);
  
  if (!coordValidation.isValid) {
    const err: any = new Error(coordValidation.error || 'Invalid address coordinates');
    err.statusCode = 400;
    throw err;
  }

  // STEP 2: Calculate distance using saved coordinates (Haversine formula)
  const distance = calculateHaversineDistance(
    ADMIN_ADDRESS.lat,
    ADMIN_ADDRESS.lng,
    userAddress.lat,
    userAddress.lng
  );

  // Debug logs for verification
  console.log('🚚 [Backend] Delivery Fee Calculation (Using Saved Coordinates):', {
    warehouseCoords: { lat: ADMIN_ADDRESS.lat, lng: ADMIN_ADDRESS.lng, location: ADMIN_ADDRESS.addressLine },
    userCoords: { lat: userAddress.lat, lng: userAddress.lng, location: `${userAddress.city}, ${userAddress.state}` },
    coordsSource: 'saved',
    calculatedDistance: `${distance.toFixed(2)} km`,
    orderAmount: `₹${orderAmount}`,
  });

  // STEP 3: Validate distance
  if (isNaN(distance) || distance < 0) {
    const err: any = new Error('Invalid distance calculation');
    err.statusCode = 500;
    throw err;
  }

  // Check if order qualifies for free delivery
  const isFreeDelivery = orderAmount >= DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD;

  if (isFreeDelivery) {
    console.log('✅ [Backend] Free Delivery Applied! (Order ≥ ₹2000)');
    return {
      distance: distance,
      baseFee: 0,
      distanceFee: 0,
      totalFee: 0,
      isFreeDelivery: true,
      finalFee: 0,
      distanceFrom: `${distance.toFixed(2)} km from Tiruvuru`,
      coordsSource: 'saved',
    };
  }

  // Calculate delivery fee based on distance - Swiggy/Zomato style
  let deliveryFee: number;
  
  if (distance <= 2) {
    // Up to 2 km: ₹25
    deliveryFee = DELIVERY_CONFIG.BASE_FEE_0_2_KM;
    console.log(`📍 [Backend] Distance: ${distance.toFixed(2)} km (≤2 km) → Base Fee: ₹${deliveryFee}`);
    
  } else if (distance <= 6) {
    // 2 to 6 km: ₹35 to ₹60 (progressive increase)
    // Linear interpolation: ₹35 at 2km → ₹60 at 6km
    const progressInRange = (distance - 2) / 4; // 0 to 1
    deliveryFee = DELIVERY_CONFIG.BASE_FEE_2_6_KM_MIN + 
                  (progressInRange * (DELIVERY_CONFIG.BASE_FEE_2_6_KM_MAX - DELIVERY_CONFIG.BASE_FEE_2_6_KM_MIN));
    deliveryFee = Math.round(deliveryFee); // Round to nearest rupee
    console.log(`📍 [Backend] Distance: ${distance.toFixed(2)} km (2-6 km) → Progressive Fee: ₹${deliveryFee}`);
    
  } else {
    // Beyond 6 km: ₹60 + ₹8 per extra km
    const extraDistance = distance - 6;
    deliveryFee = DELIVERY_CONFIG.BASE_FEE_BEYOND_6_KM + (extraDistance * DELIVERY_CONFIG.EXTRA_KM_RATE);
    deliveryFee = Math.round(deliveryFee); // Round to nearest rupee
    console.log(`📍 [Backend] Distance: ${distance.toFixed(2)} km (>6 km) → ₹60 + (${extraDistance.toFixed(2)} km × ₹8) = ₹${deliveryFee}`);
  }

  console.log(`💰 [Backend] Final Delivery Fee: ₹${deliveryFee}`);

  return {
    distance: distance,
    baseFee: deliveryFee,
    distanceFee: 0, // No separate distance fee calculation
    totalFee: deliveryFee,
    isFreeDelivery: false,
    finalFee: deliveryFee,
    distanceFrom: `${distance.toFixed(2)} km from Tiruvuru`,
    coordsSource: 'saved',
  };
}

/**
 * Get admin's default address
 * @returns Admin's address
 */
export function getAdminAddress(): IAddress {
  return ADMIN_ADDRESS;
}

/**
 * Check if delivery is available to a specific pincode
 * @param pincode Target pincode
 * @returns Whether delivery is available
 */
export function isDeliveryAvailable(pincode: string): boolean {
  // For now, we'll allow delivery to all pincodes
  // You can add specific pincode restrictions here
  return true;
}

/**
 * Get delivery fee breakdown for display
 * @param userAddress User's delivery address
 * @param orderAmount Total order amount
 * @returns Formatted delivery fee information
 */
export async function getDeliveryFeeBreakdown(
  userAddress: IAddress,
  orderAmount: number
): Promise<{
  distance: string;
  baseFee: string;
  distanceFee: string;
  totalFee: string;
  isFreeDelivery: boolean;
  finalFee: string;
  message: string;
  distanceFrom: string;
}> {
  const feeDetails = await calculateDeliveryFee(userAddress, orderAmount);

  return {
    distance: `${feeDetails.distance} km`,
    baseFee: `₹${feeDetails.baseFee}`,
    distanceFee: `₹${feeDetails.distanceFee}`,
    totalFee: `₹${feeDetails.totalFee}`,
    isFreeDelivery: feeDetails.isFreeDelivery,
    finalFee: `₹${feeDetails.finalFee}`,
    message: feeDetails.isFreeDelivery
      ? "Free delivery on orders above ₹2000"
      : `Distance: ${feeDetails.distanceFrom} — Delivery charge: ₹${feeDetails.finalFee}`,
    distanceFrom: feeDetails.distanceFrom,
  };
}
