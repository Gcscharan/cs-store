// Comprehensive pincode validation for all Indian pincodes
export interface PincodeData {
  pincode: string;
  city: string;
  state: string;
  district: string;
  isDeliverable: boolean;
  source?: "api" | "database" | "fallback";
}

// Cache for API responses to avoid repeated calls
const pincodeCache = new Map<string, PincodeData>();

// Specific mappings for known problematic pincodes
const PINCODE_CORRECTIONS: {
  [key: string]: { city: string; district: string };
} = {
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

  // Gudivada pincodes - NTR District (formerly Krishna)
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

  // Nuzvid pincodes - NTR District (formerly Krishna)
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

  // Jaggayyapet pincodes - NTR District (formerly Krishna)
  "521175": { city: "Jaggayyapet", district: "NTR" },
  "521176": { city: "Jaggayyapet", district: "NTR" },
  "521177": { city: "Jaggayyapet", district: "NTR" },
  "521178": { city: "Jaggayyapet", district: "NTR" },
  "521179": { city: "Jaggayyapet", district: "NTR" },
  "521180": { city: "Jaggayyapet", district: "NTR" },

  // Vuyyuru pincodes - NTR District (formerly Krishna)
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

// Function to validate pincode using multiple sources
export const validatePincode = async (
  pincode: string
): Promise<PincodeData | null> => {
  // Remove any spaces and ensure it's a 6-digit string
  const cleanPincode = pincode.replace(/\s/g, "");

  // Check if pincode is 6 digits
  if (!/^\d{6}$/.test(cleanPincode)) {
    return null;
  }

  // Check cache first
  if (pincodeCache.has(cleanPincode)) {
    return pincodeCache.get(cleanPincode)!;
  }

  // Try to fetch from API first
  try {
    const apiData = await fetchPincodeFromAPI(cleanPincode);
    if (apiData) {
      pincodeCache.set(cleanPincode, apiData);
      return apiData;
    }
  } catch (error) {
    console.warn("Pincode API failed, using fallback validation:", error);
  }

  // Fallback: Check if it's in AP/TG range using comprehensive state mapping
  const fallbackData = getFallbackPincodeData(cleanPincode);
  if (fallbackData) {
    pincodeCache.set(cleanPincode, fallbackData);
    return fallbackData;
  }

  // Not deliverable
  const notDeliverable = {
    pincode: cleanPincode,
    city: "",
    state: "",
    district: "",
    isDeliverable: false,
    source: "fallback" as const,
  };
  pincodeCache.set(cleanPincode, notDeliverable);
  return notDeliverable;
};

// Function to fetch pincode data from API
const fetchPincodeFromAPI = async (
  pincode: string
): Promise<PincodeData | null> => {
  try {
    // Using a free pincode API
    const response = await fetch(
      `https://api.postalpincode.in/pincode/${pincode}`
    );
    const data = await response.json();

    if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice) {
      const postOffices = data[0].PostOffice;
      const firstPostOffice = postOffices[0];
      const state = firstPostOffice.State;
      const district = firstPostOffice.District;

      // Better city name extraction logic
      let city = district; // Default to district

      // Try to find the best city name from all post offices
      for (const postOffice of postOffices) {
        // Prioritize Block field as it usually contains the city/town name
        if (postOffice.Block && postOffice.Block.trim()) {
          const blockName = postOffice.Block.trim();
          // Skip if Block is the same as district (common issue)
          if (blockName !== district) {
            city = blockName;
            break;
          }
        }
        // If no Block, try Name field
        if (postOffice.Name && postOffice.Name.trim()) {
          const name = postOffice.Name.trim();
          // Skip common post office suffixes and district names
          if (
            !name.toLowerCase().includes("post office") &&
            !name.toLowerCase().includes("head post office") &&
            !name.toLowerCase().includes("sub post office") &&
            name !== district &&
            !name.toLowerCase().includes("district")
          ) {
            city = name;
            break;
          }
        }
      }

      // If we still don't have a good city name, use district
      if (!city || city === district) {
        city = district;
      }

      // Apply specific corrections for known problematic pincodes
      if (PINCODE_CORRECTIONS[pincode]) {
        city = PINCODE_CORRECTIONS[pincode].city;
        // district is already correct from API, but we can override if needed
      }

      // Check if it's in AP or Telangana
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
};

// Comprehensive fallback validation using state-wise pincode ranges
const getFallbackPincodeData = (pincode: string): PincodeData | null => {
  const pincodeNum = parseInt(pincode);

  // Andhra Pradesh pincode ranges (comprehensive) - Updated with new districts
  const andhraPradeshRanges = [
    { min: 515000, max: 515999, state: "Andhra Pradesh", region: "Anantapur" },
    { min: 516000, max: 516999, state: "Andhra Pradesh", region: "Kadapa" },
    { min: 517000, max: 517999, state: "Andhra Pradesh", region: "Chittoor" },
    { min: 518000, max: 518999, state: "Andhra Pradesh", region: "Kurnool" },
    { min: 520000, max: 520999, state: "Andhra Pradesh", region: "NTR" }, // NTR District (formerly Krishna)
    { min: 521000, max: 521999, state: "Andhra Pradesh", region: "Krishna" }, // Krishna District
    { min: 522000, max: 522999, state: "Andhra Pradesh", region: "Guntur" },
    { min: 523000, max: 523999, state: "Andhra Pradesh", region: "Prakasam" },
    { min: 524000, max: 524999, state: "Andhra Pradesh", region: "Nellore" },
    {
      min: 530000,
      max: 530999,
      state: "Andhra Pradesh",
      region: "Visakhapatnam",
    },
    {
      min: 533000,
      max: 533999,
      state: "Andhra Pradesh",
      region: "East Godavari",
    },
    {
      min: 534000,
      max: 534999,
      state: "Andhra Pradesh",
      region: "West Godavari",
    },
    {
      min: 535000,
      max: 535999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    { min: 531000, max: 531999, state: "Andhra Pradesh", region: "Srikakulam" },
    { min: 527000, max: 527999, state: "Andhra Pradesh", region: "Nellore" },
    { min: 528000, max: 528999, state: "Andhra Pradesh", region: "Nellore" },
    { min: 529000, max: 529999, state: "Andhra Pradesh", region: "Nellore" },
    { min: 532000, max: 532999, state: "Andhra Pradesh", region: "Srikakulam" },
    {
      min: 536000,
      max: 536999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 537000,
      max: 537999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 538000,
      max: 538999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 539000,
      max: 539999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 540000,
      max: 540999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 541000,
      max: 541999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 542000,
      max: 542999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 543000,
      max: 543999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 544000,
      max: 544999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 545000,
      max: 545999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 546000,
      max: 546999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 547000,
      max: 547999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 548000,
      max: 548999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 549000,
      max: 549999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 550000,
      max: 550999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 551000,
      max: 551999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 552000,
      max: 552999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 553000,
      max: 553999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 554000,
      max: 554999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 555000,
      max: 555999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 556000,
      max: 556999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 557000,
      max: 557999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 558000,
      max: 558999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 559000,
      max: 559999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 560000,
      max: 560999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 561000,
      max: 561999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 562000,
      max: 562999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 563000,
      max: 563999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 564000,
      max: 564999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 565000,
      max: 565999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 566000,
      max: 566999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 567000,
      max: 567999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 568000,
      max: 568999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 569000,
      max: 569999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 570000,
      max: 570999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 571000,
      max: 571999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 572000,
      max: 572999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 573000,
      max: 573999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 574000,
      max: 574999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 575000,
      max: 575999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 576000,
      max: 576999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 577000,
      max: 577999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 578000,
      max: 578999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 579000,
      max: 579999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 580000,
      max: 580999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 581000,
      max: 581999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 582000,
      max: 582999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 583000,
      max: 583999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 584000,
      max: 584999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 585000,
      max: 585999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 586000,
      max: 586999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 587000,
      max: 587999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 588000,
      max: 588999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 589000,
      max: 589999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 590000,
      max: 590999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 591000,
      max: 591999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 592000,
      max: 592999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 593000,
      max: 593999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 594000,
      max: 594999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 595000,
      max: 595999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 596000,
      max: 596999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 597000,
      max: 597999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 598000,
      max: 598999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
    {
      min: 599000,
      max: 599999,
      state: "Andhra Pradesh",
      region: "Vizianagaram",
    },
  ];

  // Telangana pincode ranges (comprehensive)
  const telanganaRanges = [
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
    { min: 510000, max: 510999, state: "Telangana", region: "Hyderabad" },
    { min: 511000, max: 511999, state: "Telangana", region: "Hyderabad" },
    { min: 512000, max: 512999, state: "Telangana", region: "Hyderabad" },
    { min: 513000, max: 513999, state: "Telangana", region: "Hyderabad" },
    { min: 514000, max: 514999, state: "Telangana", region: "Hyderabad" },
  ];

  // Check Andhra Pradesh ranges
  for (const range of andhraPradeshRanges) {
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
  for (const range of telanganaRanges) {
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
};

// Function to get delivery status message
export const getDeliveryStatusMessage = (
  pincodeData: PincodeData | null
): string => {
  if (!pincodeData) {
    return "Please enter a valid 6-digit pincode";
  }

  if (pincodeData.isDeliverable) {
    return "Deliverable to this pincode";
  }

  return "Not deliverable to this pincode";
};

// Function to check if pincode is valid for delivery (synchronous version for form validation)
export const isPincodeDeliverable = (pincode: string): boolean => {
  const pincodeNum = parseInt(pincode);

  // Quick synchronous check for AP/TG ranges - Updated with new districts
  const isAndhraPradesh =
    (pincodeNum >= 515000 && pincodeNum <= 515999) || // Anantapur
    (pincodeNum >= 516000 && pincodeNum <= 516999) || // Kadapa
    (pincodeNum >= 517000 && pincodeNum <= 517999) || // Chittoor
    (pincodeNum >= 518000 && pincodeNum <= 518999) || // Kurnool
    (pincodeNum >= 520000 && pincodeNum <= 520999) || // NTR District (formerly Krishna)
    (pincodeNum >= 521000 && pincodeNum <= 521999) || // Krishna District
    (pincodeNum >= 522000 && pincodeNum <= 522999) || // Guntur
    (pincodeNum >= 523000 && pincodeNum <= 523999) || // Prakasam
    (pincodeNum >= 524000 && pincodeNum <= 524999) || // Nellore
    (pincodeNum >= 525000 && pincodeNum <= 525999) || // Nellore
    (pincodeNum >= 526000 && pincodeNum <= 526999) || // Nellore
    (pincodeNum >= 527000 && pincodeNum <= 527999) || // Nellore
    (pincodeNum >= 528000 && pincodeNum <= 528999) || // Nellore
    (pincodeNum >= 529000 && pincodeNum <= 529999) || // Nellore
    (pincodeNum >= 530000 && pincodeNum <= 530999) || // Visakhapatnam
    (pincodeNum >= 531000 && pincodeNum <= 531999) || // Srikakulam
    (pincodeNum >= 532000 && pincodeNum <= 532999) || // Srikakulam
    (pincodeNum >= 533000 && pincodeNum <= 533999) || // East Godavari
    (pincodeNum >= 534000 && pincodeNum <= 534999) || // West Godavari
    (pincodeNum >= 535000 && pincodeNum <= 535999) || // Vizianagaram
    (pincodeNum >= 536000 && pincodeNum <= 536999) || // Vizianagaram
    (pincodeNum >= 537000 && pincodeNum <= 537999) || // Vizianagaram
    (pincodeNum >= 538000 && pincodeNum <= 538999) || // Vizianagaram
    (pincodeNum >= 539000 && pincodeNum <= 539999) || // Vizianagaram
    (pincodeNum >= 540000 && pincodeNum <= 540999) || // Vizianagaram
    (pincodeNum >= 541000 && pincodeNum <= 541999) || // Vizianagaram
    (pincodeNum >= 542000 && pincodeNum <= 542999) || // Vizianagaram
    (pincodeNum >= 543000 && pincodeNum <= 543999) || // Vizianagaram
    (pincodeNum >= 544000 && pincodeNum <= 544999) || // Vizianagaram
    (pincodeNum >= 545000 && pincodeNum <= 545999) || // Vizianagaram
    (pincodeNum >= 546000 && pincodeNum <= 546999) || // Vizianagaram
    (pincodeNum >= 547000 && pincodeNum <= 547999) || // Vizianagaram
    (pincodeNum >= 548000 && pincodeNum <= 548999) || // Vizianagaram
    (pincodeNum >= 549000 && pincodeNum <= 549999) || // Vizianagaram
    (pincodeNum >= 550000 && pincodeNum <= 550999) || // Vizianagaram
    (pincodeNum >= 551000 && pincodeNum <= 551999) || // Vizianagaram
    (pincodeNum >= 552000 && pincodeNum <= 552999) || // Vizianagaram
    (pincodeNum >= 553000 && pincodeNum <= 553999) || // Vizianagaram
    (pincodeNum >= 554000 && pincodeNum <= 554999) || // Vizianagaram
    (pincodeNum >= 555000 && pincodeNum <= 555999) || // Vizianagaram
    (pincodeNum >= 556000 && pincodeNum <= 556999) || // Vizianagaram
    (pincodeNum >= 557000 && pincodeNum <= 557999) || // Vizianagaram
    (pincodeNum >= 558000 && pincodeNum <= 558999) || // Vizianagaram
    (pincodeNum >= 559000 && pincodeNum <= 559999) || // Vizianagaram
    (pincodeNum >= 560000 && pincodeNum <= 560999) || // Vizianagaram
    (pincodeNum >= 561000 && pincodeNum <= 561999) || // Vizianagaram
    (pincodeNum >= 562000 && pincodeNum <= 562999) || // Vizianagaram
    (pincodeNum >= 563000 && pincodeNum <= 563999) || // Vizianagaram
    (pincodeNum >= 564000 && pincodeNum <= 564999) || // Vizianagaram
    (pincodeNum >= 565000 && pincodeNum <= 565999) || // Vizianagaram
    (pincodeNum >= 566000 && pincodeNum <= 566999) || // Vizianagaram
    (pincodeNum >= 567000 && pincodeNum <= 567999) || // Vizianagaram
    (pincodeNum >= 568000 && pincodeNum <= 568999) || // Vizianagaram
    (pincodeNum >= 569000 && pincodeNum <= 569999) || // Vizianagaram
    (pincodeNum >= 570000 && pincodeNum <= 570999) || // Vizianagaram
    (pincodeNum >= 571000 && pincodeNum <= 571999) || // Vizianagaram
    (pincodeNum >= 572000 && pincodeNum <= 572999) || // Vizianagaram
    (pincodeNum >= 573000 && pincodeNum <= 573999) || // Vizianagaram
    (pincodeNum >= 574000 && pincodeNum <= 574999) || // Vizianagaram
    (pincodeNum >= 575000 && pincodeNum <= 575999) || // Vizianagaram
    (pincodeNum >= 576000 && pincodeNum <= 576999) || // Vizianagaram
    (pincodeNum >= 577000 && pincodeNum <= 577999) || // Vizianagaram
    (pincodeNum >= 578000 && pincodeNum <= 578999) || // Vizianagaram
    (pincodeNum >= 579000 && pincodeNum <= 579999) || // Vizianagaram
    (pincodeNum >= 580000 && pincodeNum <= 580999) || // Vizianagaram
    (pincodeNum >= 581000 && pincodeNum <= 581999) || // Vizianagaram
    (pincodeNum >= 582000 && pincodeNum <= 582999) || // Vizianagaram
    (pincodeNum >= 583000 && pincodeNum <= 583999) || // Vizianagaram
    (pincodeNum >= 584000 && pincodeNum <= 584999) || // Vizianagaram
    (pincodeNum >= 585000 && pincodeNum <= 585999) || // Vizianagaram
    (pincodeNum >= 586000 && pincodeNum <= 586999) || // Vizianagaram
    (pincodeNum >= 587000 && pincodeNum <= 587999) || // Vizianagaram
    (pincodeNum >= 588000 && pincodeNum <= 588999) || // Vizianagaram
    (pincodeNum >= 589000 && pincodeNum <= 589999) || // Vizianagaram
    (pincodeNum >= 590000 && pincodeNum <= 590999) || // Vizianagaram
    (pincodeNum >= 591000 && pincodeNum <= 591999) || // Vizianagaram
    (pincodeNum >= 592000 && pincodeNum <= 592999) || // Vizianagaram
    (pincodeNum >= 593000 && pincodeNum <= 593999) || // Vizianagaram
    (pincodeNum >= 594000 && pincodeNum <= 594999) || // Vizianagaram
    (pincodeNum >= 595000 && pincodeNum <= 595999) || // Vizianagaram
    (pincodeNum >= 596000 && pincodeNum <= 596999) || // Vizianagaram
    (pincodeNum >= 597000 && pincodeNum <= 597999) || // Vizianagaram
    (pincodeNum >= 598000 && pincodeNum <= 598999) || // Vizianagaram
    (pincodeNum >= 599000 && pincodeNum <= 599999); // Vizianagaram

  const isTelangana =
    (pincodeNum >= 500000 && pincodeNum <= 500999) ||
    (pincodeNum >= 501000 && pincodeNum <= 501999) ||
    (pincodeNum >= 502000 && pincodeNum <= 502999) ||
    (pincodeNum >= 503000 && pincodeNum <= 503999) ||
    (pincodeNum >= 504000 && pincodeNum <= 504999) ||
    (pincodeNum >= 505000 && pincodeNum <= 505999) ||
    (pincodeNum >= 506000 && pincodeNum <= 506999) ||
    (pincodeNum >= 507000 && pincodeNum <= 507999) ||
    (pincodeNum >= 508000 && pincodeNum <= 508999) ||
    (pincodeNum >= 509000 && pincodeNum <= 509999) ||
    (pincodeNum >= 510000 && pincodeNum <= 510999) ||
    (pincodeNum >= 511000 && pincodeNum <= 511999) ||
    (pincodeNum >= 512000 && pincodeNum <= 512999) ||
    (pincodeNum >= 513000 && pincodeNum <= 513999) ||
    (pincodeNum >= 514000 && pincodeNum <= 514999);

  return isAndhraPradesh || isTelangana;
};

// Function to get pincode info (compatibility function for AddressForm)
export const getPincodeInfo = async (pincode: string) => {
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
};
