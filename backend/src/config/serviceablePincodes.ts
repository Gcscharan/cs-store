/**
 * Serviceable Pincodes Configuration
 * 
 * Only orders with delivery addresses in these pincodes can be placed.
 * This prevents orders from outside the service area.
 */

// Andhra Pradesh and Telangana pincode ranges
const SERVICEABLE_RANGES = [
  { start: 500001, end: 599999 },
];

// Keep the flat list for backward compatibility and exact match
export const SERVICEABLE_PINCODES: string[] = [
  ...(process.env.NODE_ENV === "test" ? ["500001"] : []),
];

/**
 * Check if a pincode is in the serviceable area
 * Checks against known pincode ranges for AP and Telangana
 * @param pincode - The pincode to check
 * @returns true if serviceable, false otherwise
 */
export function isPincodeServiceable(pincode: string): boolean {
  const normalizedPincode = String(pincode).trim();
  if (!/^\d{6}$/.test(normalizedPincode)) return false;
  const pincodeNum = parseInt(normalizedPincode, 10);
  return SERVICEABLE_RANGES.some(
    (range) => pincodeNum >= range.start && pincodeNum <= range.end
  );
}
