/**
 * Delivery Service - Business Logic Layer
 * 
 * Determines WHETHER delivery is available
 * Separated from data layer (WHERE user is)
 */

/**
 * Normalize state name for consistent comparison
 * Handles: "TELANGANA", "Telangana", "telangana", " Telangana "
 */
export const normalizeState = (state: string): string => {
  return state.trim().toLowerCase();
};

/**
 * Current business logic: State-based delivery
 * Future: Will be replaced by distance-based delivery
 * 
 * @param state - State name (any case, will be normalized)
 * @returns true if we deliver to this state
 */
export const isDeliverableState = (state: string | undefined): boolean => {
  if (!state) return false;
  
  const normalized = normalizeState(state);
  return normalized === 'andhra pradesh' || normalized === 'telangana';
};

/**
 * Future: Distance-based delivery logic
 * 
 * @param userCoords - User's GPS coordinates
 * @param storeCoords - Store's GPS coordinates
 * @param radiusKm - Delivery radius in kilometers (default: 8km)
 * @returns true if user is within delivery radius
 */
export const isDeliverableByDistance = (
  userCoords: { lat: number; lng: number },
  storeCoords: { lat: number; lng: number },
  radiusKm: number = 8
): boolean => {
  // Haversine formula for distance calculation
  const R = 6371; // Earth's radius in km
  const dLat = toRad(storeCoords.lat - userCoords.lat);
  const dLng = toRad(storeCoords.lng - userCoords.lng);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userCoords.lat)) *
      Math.cos(toRad(storeCoords.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance <= radiusKm;
};

const toRad = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

/**
 * Main delivery check function
 * Currently uses state-based logic (interim solution)
 * Future: Will use distance-based logic
 * 
 * @param state - State name from pincode data
 * @param district - District name (optional, for finer granularity)
 * @param userCoords - Optional user coordinates (for future distance-based)
 * @returns true if delivery is available
 */
export const checkDeliveryAvailability = (
  state: string,
  district?: string,
  userCoords?: { lat: number; lng: number }
): boolean => {
  // Future: Distance-based delivery
  // if (userCoords && storeCoords) {
  //   return isDeliverableByDistance(userCoords, storeCoords);
  // }
  
  // Current: State-based (interim solution)
  // TODO: Replace with district-based or distance-based
  return isDeliverableState(state);
  
  // Better interim: District-based (more granular)
  // if (district) {
  //   return isDeliverableDistrict(state, district);
  // }
};
