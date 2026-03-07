/**
 * Serviceable Pincodes Configuration
 * 
 * Only orders with delivery addresses in these pincodes can be placed.
 * This prevents orders from outside the service area.
 * 
 * To add new serviceable pincodes, simply add them to this array.
 */
export const SERVICEABLE_PINCODES: string[] = [
  "521235",
  "507115",
  "507111",
  "507113",
  "507114",
  ...(process.env.NODE_ENV === "test" ? ["500001"] : []),
];

/**
 * Check if a pincode is in the serviceable list
 * @param pincode - The pincode to check
 * @returns true if serviceable, false otherwise
 */
export function isPincodeServiceable(pincode: string): boolean {
  const normalizedPincode = String(pincode).trim();
  return SERVICEABLE_PINCODES.includes(normalizedPincode);
}
