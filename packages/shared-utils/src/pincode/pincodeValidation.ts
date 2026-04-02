/**
 * Pincode Validation
 * 
 * Shared utility for validating Indian pincodes and checking delivery availability.
 * Used by both web and mobile apps.
 */

// ============================================================================
// Types
// ============================================================================

export interface PincodeData {
  pincode: string;
  city: string;
  state: string;
  district: string;
  isDeliverable: boolean;
  source?: "api" | "database" | "fallback";
}

export interface PincodeInfo {
  deliverable: boolean;
  city: string;
  state: string;
  district: string;
  message: string;
}

// ============================================================================
// Pincode Corrections
// ============================================================================

/**
 * Specific mappings for known problematic pincodes
 */
export const PINCODE_CORRECTIONS: Record<string, { city: string; district: string }> = {
  // Tiruvuru pincodes - NTR District (formerly Krishna)
  "521235": { city: "Tiruvuru", district: "NTR" },
  "521236": { city: "Tiruvuru", district: "NTR" },
  "521237": { city: "Tiruvuru", district: "NTR" },
  "521238": { city: "Tiruvuru", district: "NTR" },
  "521239": { city: "Tiruvuru", district: "NTR" },
  "521240": { city: "Tiruvuru", district: "NTR" },

  // Mylavaram pincodes - NTR District (formerly Krishna)
  "521230": { city: "Mylavaram", district: "NTR" },
  "521231": { city: "Mylavaram", district: "NTR" },
  "521232": { city: "Mylavaram", district: "NTR" },
  "521233": { city: "Mylavaram", district: "NTR" },
  "521234": { city: "Mylavaram", district: "NTR" },

  // Vijayawada pincodes - NTR District (formerly Krishna)
  "520001": { city: "Vijayawada", district: "NTR" },
  "520002": { city: "Vijayawada", district: "NTR" },
  "520003": { city: "Vijayawada", district: "NTR" },
  "520004": { city: "Vijayawada", district: "NTR" },
  "520005": { city: "Vijayawada", district: "NTR" },
  "520006": { city: "Vijayawada", district: "NTR" },
  "520007": { city: "Vijayawada", district: "NTR" },
  "520008": { city: "Vijayawada", district: "NTR" },
  "520009": { city: "Vijayawada", district: "NTR" },
  "520010": { city: "Vijayawada", district: "NTR" },
  "520011": { city: "Vijayawada", district: "NTR" },
  "520012": { city: "Vijayawada", district: "NTR" },
  "520013": { city: "Vijayawada", district: "NTR" },
  "520014": { city: "Vijayawada", district: "NTR" },
  "520015": { city: "Vijayawada", district: "NTR" },
  "520016": { city: "Vijayawada", district: "NTR" },
  "520017": { city: "Vijayawada", district: "NTR" },
  "520018": { city: "Vijayawada", district: "NTR" },
  "520019": { city: "Vijayawada", district: "NTR" },
  "520020": { city: "Vijayawada", district: "NTR" },

  // Machilipatnam pincodes - Krishna District
  "521001": { city: "Machilipatnam", district: "Krishna" },
  "521002": { city: "Machilipatnam", district: "Krishna" },
  "521003": { city: "Machilipatnam", district: "Krishna" },
  "521004": { city: "Machilipatnam", district: "Krishna" },
  "521005": { city: "Machilipatnam", district: "Krishna" },
  "521006": { city: "Machilipatnam", district: "Krishna" },
  "521007": { city: "Machilipatnam", district: "Krishna" },
  "521008": { city: "Machilipatnam", district: "Krishna" },
  "521009": { city: "Machilipatnam", district: "Krishna" },
  "521010": { city: "Machilipatnam", district: "Krishna" },

  // Gudivada pincodes - NTR District
  "521301": { city: "Gudivada", district: "NTR" },
  "521302": { city: "Gudivada", district: "NTR" },
  "521303": { city: "Gudivada", district: "NTR" },
  "521304": { city: "Gudivada", district: "NTR" },
  "521305": { city: "Gudivada", district: "NTR" },
  "521306": { city: "Gudivada", district: "NTR" },
  "521307": { city: "Gudivada", district: "NTR" },
  "521308": { city: "Gudivada", district: "NTR" },
  "521309": { city: "Gudivada", district: "NTR" },
  "521310": { city: "Gudivada", district: "NTR" },

  // Nuzvid pincodes - NTR District
  "521201": { city: "Nuzvid", district: "NTR" },
  "521202": { city: "Nuzvid", district: "NTR" },
  "521203": { city: "Nuzvid", district: "NTR" },
  "521204": { city: "Nuzvid", district: "NTR" },
  "521205": { city: "Nuzvid", district: "NTR" },
  "521206": { city: "Nuzvid", district: "NTR" },
  "521207": { city: "Nuzvid", district: "NTR" },
  "521208": { city: "Nuzvid", district: "NTR" },
  "521209": { city: "Nuzvid", district: "NTR" },
  "521210": { city: "Nuzvid", district: "NTR" },

  // Jaggayyapet pincodes - NTR District
  "521175": { city: "Jaggayyapet", district: "NTR" },
  "521176": { city: "Jaggayyapet", district: "NTR" },
  "521177": { city: "Jaggayyapet", district: "NTR" },
  "521178": { city: "Jaggayyapet", district: "NTR" },
  "521179": { city: "Jaggayyapet", district: "NTR" },
  "521180": { city: "Jaggayyapet", district: "NTR" },

  // Vuyyuru pincodes - NTR District
  "521165": { city: "Vuyyuru", district: "NTR" },
  "521166": { city: "Vuyyuru", district: "NTR" },
  "521167": { city: "Vuyyuru", district: "NTR" },
  "521168": { city: "Vuyyuru", district: "NTR" },
  "521169": { city: "Vuyyuru", district: "NTR" },
  "521170": { city: "Vuyyuru", district: "NTR" },

  // Pedana pincodes - Krishna District
  "521121": { city: "Pedana", district: "Krishna" },
  "521122": { city: "Pedana", district: "Krishna" },
  "521123": { city: "Pedana", district: "Krishna" },
  "521124": { city: "Pedana", district: "Krishna" },
  "521125": { city: "Pedana", district: "Krishna" },
  "521126": { city: "Pedana", district: "Krishna" },

  // Avanigadda pincodes - Krishna District
  "521131": { city: "Avanigadda", district: "Krishna" },
  "521132": { city: "Avanigadda", district: "Krishna" },
  "521133": { city: "Avanigadda", district: "Krishna" },
  "521134": { city: "Avanigadda", district: "Krishna" },
  "521135": { city: "Avanigadda", district: "Krishna" },
  "521136": { city: "Avanigadda", district: "Krishna" },

  // Pamarru pincodes - Krishna District
  "521141": { city: "Pamarru", district: "Krishna" },
  "521142": { city: "Pamarru", district: "Krishna" },
  "521143": { city: "Pamarru", district: "Krishna" },
  "521144": { city: "Pamarru", district: "Krishna" },
  "521145": { city: "Pamarru", district: "Krishna" },
  "521146": { city: "Pamarru", district: "Krishna" },

  // Bantumilli pincodes - Krishna District
  "521151": { city: "Bantumilli", district: "Krishna" },
  "521152": { city: "Bantumilli", district: "Krishna" },
  "521153": { city: "Bantumilli", district: "Krishna" },
  "521154": { city: "Bantumilli", district: "Krishna" },
  "521155": { city: "Bantumilli", district: "Krishna" },
  "521156": { city: "Bantumilli", district: "Krishna" },

  // Kaikalur pincodes - Krishna District
  "521161": { city: "Kaikalur", district: "Krishna" },
  "521162": { city: "Kaikalur", district: "Krishna" },
  "521163": { city: "Kaikalur", district: "Krishna" },
  "521164": { city: "Kaikalur", district: "Krishna" },
};

// ============================================================================
// Pincode Ranges
// ============================================================================

interface PincodeRange {
  min: number;
  max: number;
  state: string;
  region: string;
}

/**
 * Andhra Pradesh pincode ranges
 */
export const ANDHRA_PRADESH_RANGES: PincodeRange[] = [
  { min: 515000, max: 515999, state: "Andhra Pradesh", region: "Anantapur" },
  { min: 516000, max: 516999, state: "Andhra Pradesh", region: "Kadapa" },
  { min: 517000, max: 517999, state: "Andhra Pradesh", region: "Chittoor" },
  { min: 518000, max: 518999, state: "Andhra Pradesh", region: "Kurnool" },
  { min: 520000, max: 520999, state: "Andhra Pradesh", region: "NTR" },
  { min: 521000, max: 521999, state: "Andhra Pradesh", region: "Krishna" },
  { min: 522000, max: 522999, state: "Andhra Pradesh", region: "Guntur" },
  { min: 523000, max: 523999, state: "Andhra Pradesh", region: "Prakasam" },
  { min: 524000, max: 524999, state: "Andhra Pradesh", region: "Nellore" },
  { min: 530000, max: 530999, state: "Andhra Pradesh", region: "Visakhapatnam" },
  { min: 531000, max: 531999, state: "Andhra Pradesh", region: "Srikakulam" },
  { min: 533000, max: 533999, state: "Andhra Pradesh", region: "East Godavari" },
  { min: 534000, max: 534999, state: "Andhra Pradesh", region: "West Godavari" },
  { min: 535000, max: 535999, state: "Andhra Pradesh", region: "Vizianagaram" },
];

/**
 * Telangana pincode ranges
 */
export const TELANGANA_RANGES: PincodeRange[] = [
  { min: 500000, max: 500999, state: "Telangana", region: "Hyderabad" },
  { min: 501000, max: 501999, state: "Telangana", region: "Ranga Reddy" },
  { min: 502000, max: 502999, state: "Telangana", region: "Medak" },
  { min: 503000, max: 503999, state: "Telangana", region: "Nizamabad" },
  { min: 504000, max: 504999, state: "Telangana", region: "Adilabad" },
  { min: 505000, max: 505999, state: "Telangana", region: "Karimnagar" },
  { min: 506000, max: 506999, state: "Telangana", region: "Warangal" },
  { min: 507000, max: 507999, state: "Telangana", region: "Khammam" },
  { min: 508000, max: 508999, state: "Telangana", region: "Nalgonda" },
  { min: 509000, max: 509999, state: "Telangana", region: "Mahbubnagar" },
];

// ============================================================================
// Cache
// ============================================================================

/** Cache for API responses */
const pincodeCache = new Map<string, PincodeData>();

/**
 * Clear the pincode cache
 */
export function clearPincodeCache(): void {
  pincodeCache.clear();
}

/**
 * Get cached pincode data
 */
export function getCachedPincode(pincode: string): PincodeData | undefined {
  return pincodeCache.get(pincode);
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if pincode format is valid (6 digits)
 * @param pincode - Pincode to validate
 * @returns True if valid format
 */
export function isValidPincodeFormat(pincode: string): boolean {
  return /^\d{6}$/.test(pincode.replace(/\s/g, ""));
}

/**
 * Check if pincode is deliverable (synchronous, uses ranges only)
 * @param pincode - Pincode to check
 * @returns True if in AP/TG range
 */
export function isPincodeDeliverable(pincode: string): boolean {
  const cleanPincode = pincode.replace(/\s/g, "");
  
  if (!isValidPincodeFormat(cleanPincode)) {
    return false;
  }

  const pincodeNum = parseInt(cleanPincode, 10);

  // Check AP ranges
  for (const range of ANDHRA_PRADESH_RANGES) {
    if (pincodeNum >= range.min && pincodeNum <= range.max) {
      return true;
    }
  }

  // Check Telangana ranges
  for (const range of TELANGANA_RANGES) {
    if (pincodeNum >= range.min && pincodeNum <= range.max) {
      return true;
    }
  }

  return false;
}

/**
 * Get fallback pincode data from ranges
 * @param pincode - Pincode to look up
 * @returns Pincode data or null if not in range
 */
export function getFallbackPincodeData(pincode: string): PincodeData | null {
  const pincodeNum = parseInt(pincode, 10);

  // Check AP ranges
  for (const range of ANDHRA_PRADESH_RANGES) {
    if (pincodeNum >= range.min && pincodeNum <= range.max) {
      return {
        pincode,
        city: `${range.region} City`,
        state: range.state,
        district: range.region,
        isDeliverable: true,
        source: "fallback",
      };
    }
  }

  // Check Telangana ranges
  for (const range of TELANGANA_RANGES) {
    if (pincodeNum >= range.min && pincodeNum <= range.max) {
      return {
        pincode,
        city: `${range.region} City`,
        state: range.state,
        district: range.region,
        isDeliverable: true,
        source: "fallback",
      };
    }
  }

  return null;
}

/**
 * Fetch pincode data from external API
 * @param pincode - Pincode to look up
 * @returns Pincode data or null if not found
 */
export async function fetchPincodeFromAPI(pincode: string): Promise<PincodeData | null> {
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();

    if (data?.[0]?.Status === "Success" && data[0].PostOffice) {
      const postOffices = data[0].PostOffice;
      const firstPostOffice = postOffices[0];
      const state = firstPostOffice.State;
      const district = firstPostOffice.District;

      // Extract city name
      let city = district;
      for (const postOffice of postOffices) {
        if (postOffice.Block && postOffice.Block.trim() && postOffice.Block !== district) {
          city = postOffice.Block.trim();
          break;
        }
        if (
          postOffice.Name &&
          postOffice.Name.trim() &&
          !postOffice.Name.toLowerCase().includes("post office") &&
          postOffice.Name !== district
        ) {
          city = postOffice.Name.trim();
          break;
        }
      }

      // Apply corrections if available
      if (PINCODE_CORRECTIONS[pincode]) {
        city = PINCODE_CORRECTIONS[pincode].city;
      }

      const isDeliverable = state === "Andhra Pradesh" || state === "Telangana";

      return {
        pincode,
        city,
        state,
        district,
        isDeliverable,
        source: "api",
      };
    }
  } catch (error) {
    console.error("Error fetching pincode from API:", error);
  }

  return null;
}

/**
 * Validate pincode using multiple sources (async)
 * @param pincode - Pincode to validate
 * @returns Pincode data or null if invalid
 */
export async function validatePincode(pincode: string): Promise<PincodeData | null> {
  const cleanPincode = pincode.replace(/\s/g, "");

  if (!isValidPincodeFormat(cleanPincode)) {
    return null;
  }

  // Check cache
  if (pincodeCache.has(cleanPincode)) {
    return pincodeCache.get(cleanPincode)!;
  }

  // Try API first
  try {
    const apiData = await fetchPincodeFromAPI(cleanPincode);
    if (apiData) {
      pincodeCache.set(cleanPincode, apiData);
      return apiData;
    }
  } catch (error) {
    console.warn("Pincode API failed, using fallback:", error);
  }

  // Fallback to ranges
  const fallbackData = getFallbackPincodeData(cleanPincode);
  if (fallbackData) {
    pincodeCache.set(cleanPincode, fallbackData);
    return fallbackData;
  }

  // Not deliverable
  const notDeliverable: PincodeData = {
    pincode: cleanPincode,
    city: "",
    state: "",
    district: "",
    isDeliverable: false,
    source: "fallback",
  };
  pincodeCache.set(cleanPincode, notDeliverable);
  return notDeliverable;
}

/**
 * Get delivery status message
 * @param pincodeData - Pincode data
 * @returns Human-readable message
 */
export function getDeliveryStatusMessage(pincodeData: PincodeData | null): string {
  if (!pincodeData) {
    return "Please enter a valid 6-digit pincode";
  }

  if (pincodeData.isDeliverable) {
    return "Deliverable to this pincode";
  }

  return "Not deliverable to this pincode";
}

/**
 * Get pincode info (compatibility function)
 * @param pincode - Pincode to look up
 * @returns Pincode info object
 */
export async function getPincodeInfo(pincode: string): Promise<PincodeInfo> {
  const pincodeData = await validatePincode(pincode);

  if (!pincodeData) {
    return {
      deliverable: false,
      city: "",
      state: "",
      district: "",
      message: "Please enter a valid 6-digit pincode",
    };
  }

  return {
    deliverable: pincodeData.isDeliverable,
    city: pincodeData.city,
    state: pincodeData.state,
    district: pincodeData.district,
    message: getDeliveryStatusMessage(pincodeData),
  };
}
