"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ANDHRA_PRADESH_RANGES: () => ANDHRA_PRADESH_RANGES,
  CUSTOMER_MILESTONES: () => CUSTOMER_MILESTONES,
  DELIVERY_CONFIG: () => DELIVERY_CONFIG,
  PAYMENT_REFUNDABLE_STATES: () => REFUNDABLE_STATES,
  PAYMENT_SUCCESS_STATES: () => SUCCESS_STATES,
  PAYMENT_TERMINAL_STATES: () => TERMINAL_STATES,
  PAYMENT_TRANSITIONS: () => PAYMENT_TRANSITIONS,
  PINCODE_CORRECTIONS: () => PINCODE_CORRECTIONS,
  TELANGANA_RANGES: () => TELANGANA_RANGES,
  WAREHOUSE_ADDRESS: () => WAREHOUSE_ADDRESS,
  applyPaymentEvent: () => applyPaymentEvent,
  buildCustomerOrderTimeline: () => buildCustomerOrderTimeline,
  calculateDeliveryFee: () => calculateDeliveryFee,
  calculateDeliveryFeeForPincode: () => calculateDeliveryFeeForPincode,
  calculateDistance: () => calculateDistance,
  canPaymentTransition: () => canTransition,
  canRefund: () => canRefund,
  clearPincodeCache: () => clearPincodeCache,
  createInitialPaymentState: () => createInitialPaymentState,
  fetchPincodeFromAPI: () => fetchPincodeFromAPI,
  formatDeliveryFee: () => formatDeliveryFee,
  getAdminAddress: () => getAdminAddress,
  getCachedPincode: () => getCachedPincode,
  getCurrentMilestone: () => getCurrentMilestone,
  getDeliveryFeeBreakdown: () => getDeliveryFeeBreakdown,
  getDeliveryStatusMessage: () => getDeliveryStatusMessage,
  getFallbackPincodeData: () => getFallbackPincodeData,
  getNextPaymentStatus: () => getNextStatus,
  getPaymentStatusColor: () => getPaymentStatusColor,
  getPaymentStatusText: () => getPaymentStatusText,
  getPincodeInfo: () => getPincodeInfo,
  getTimelineEta: () => getTimelineEta,
  getValidPaymentEvents: () => getValidEvents,
  getWarehouseAddress: () => getWarehouseAddress,
  isDeliveryAvailable: () => isDeliveryAvailable,
  isPaymentPending: () => isPending,
  isPaymentTerminalState: () => isTerminalState2,
  isPincodeDeliverable: () => isPincodeDeliverable,
  isSuccessfulPayment: () => isSuccessfulPayment,
  isTimelineTerminalState: () => isTerminalState,
  isValidPincode: () => isValidPincode,
  isValidPincodeFormat: () => isValidPincodeFormat,
  validatePincode: () => validatePincode
});
module.exports = __toCommonJS(index_exports);

// src/delivery/deliveryFeeCalculator.ts
var WAREHOUSE_ADDRESS = {
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
  isDefault: true
};
var DELIVERY_CONFIG = {
  /** Free delivery for orders ≥ ₹2000 */
  FREE_DELIVERY_THRESHOLD: 2e3,
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
  ROAD_DISTANCE_FACTOR: 1.3
};
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 100) / 100;
}
function calculateDeliveryFee(userAddress, orderAmount) {
  if (!userAddress) {
    return {
      deliveryFee: null,
      distance: null,
      requiresAddress: true,
      baseFee: 0,
      distanceFee: 0,
      totalFee: 0,
      isFreeDelivery: false,
      finalFee: 0
    };
  }
  if (!userAddress.lat || !userAddress.lng || userAddress.lat === 0 || userAddress.lng === 0 || isNaN(userAddress.lat) || isNaN(userAddress.lng)) {
    return {
      deliveryFee: 0,
      distance: 0,
      requiresAddress: false,
      baseFee: 0,
      distanceFee: 0,
      totalFee: 0,
      isFreeDelivery: false,
      finalFee: 0,
      error: "Invalid address coordinates"
    };
  }
  const straightLineDistance = calculateDistance(
    WAREHOUSE_ADDRESS.lat,
    WAREHOUSE_ADDRESS.lng,
    userAddress.lat,
    userAddress.lng
  );
  const distance = Math.round(straightLineDistance * DELIVERY_CONFIG.ROAD_DISTANCE_FACTOR * 100) / 100;
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
      error: "Invalid distance calculated"
    };
  }
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
      finalFee: 0
    };
  }
  let deliveryFee;
  if (distance <= 2) {
    deliveryFee = DELIVERY_CONFIG.BASE_FEE_0_2_KM;
  } else if (distance <= 6) {
    const progressInRange = (distance - 2) / 4;
    deliveryFee = DELIVERY_CONFIG.BASE_FEE_2_6_KM_MIN + progressInRange * (DELIVERY_CONFIG.BASE_FEE_2_6_KM_MAX - DELIVERY_CONFIG.BASE_FEE_2_6_KM_MIN);
    deliveryFee = Math.round(deliveryFee);
  } else {
    const extraDistance = distance - 6;
    deliveryFee = DELIVERY_CONFIG.BASE_FEE_BEYOND_6_KM + extraDistance * DELIVERY_CONFIG.EXTRA_KM_RATE;
    deliveryFee = Math.round(deliveryFee);
  }
  return {
    deliveryFee,
    distance: Math.round(distance * 100) / 100,
    requiresAddress: false,
    baseFee: deliveryFee,
    distanceFee: 0,
    totalFee: deliveryFee,
    isFreeDelivery: false,
    finalFee: deliveryFee
  };
}
function getDeliveryFeeBreakdown(userAddress, orderAmount) {
  const feeDetails = calculateDeliveryFee(userAddress, orderAmount);
  if (feeDetails.requiresAddress) {
    return {
      distance: "",
      baseFee: "",
      distanceFee: "",
      totalFee: "",
      isFreeDelivery: false,
      finalFee: "",
      message: "Add delivery address to calculate delivery fee"
    };
  }
  return {
    distance: `${feeDetails.distance} km`,
    baseFee: `\u20B9${feeDetails.baseFee}`,
    distanceFee: `\u20B9${feeDetails.distanceFee}`,
    totalFee: `\u20B9${feeDetails.totalFee}`,
    isFreeDelivery: feeDetails.isFreeDelivery,
    finalFee: `\u20B9${feeDetails.finalFee}`,
    message: feeDetails.isFreeDelivery ? "Free delivery on orders above \u20B92000" : `Distance: ${feeDetails.distance} km from Tiruvuru \u2014 Delivery charge: \u20B9${feeDetails.finalFee}`
  };
}
function getWarehouseAddress() {
  return WAREHOUSE_ADDRESS;
}
var getAdminAddress = getWarehouseAddress;
function isDeliveryAvailable(_pincode) {
  return true;
}
function isValidPincode(pincode) {
  return /^\d{6}$/.test(pincode);
}
function formatDeliveryFee(fee, isFree) {
  if (isFree) {
    return "FREE";
  }
  return `\u20B9${fee.toFixed(2)}`;
}
async function calculateDeliveryFeeForPincode(pincode, orderAmount) {
  const mockAddress = {
    _id: `address-${pincode}`,
    label: "Delivery Address",
    pincode,
    city: "Unknown",
    state: "Unknown",
    line1: "Delivery Address",
    phone: "0000000000",
    name: "Customer",
    lat: 17.385,
    lng: 78.4867,
    isDefault: false
  };
  const feeDetails = calculateDeliveryFee(mockAddress, orderAmount);
  return {
    ...feeDetails,
    isDeliveryAvailable: isDeliveryAvailable(pincode)
  };
}

// src/pincode/pincodeValidation.ts
var PINCODE_CORRECTIONS = {
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
  "521164": { city: "Kaikalur", district: "Krishna" }
};
var ANDHRA_PRADESH_RANGES = [
  { min: 515e3, max: 515999, state: "Andhra Pradesh", region: "Anantapur" },
  { min: 516e3, max: 516999, state: "Andhra Pradesh", region: "Kadapa" },
  { min: 517e3, max: 517999, state: "Andhra Pradesh", region: "Chittoor" },
  { min: 518e3, max: 518999, state: "Andhra Pradesh", region: "Kurnool" },
  { min: 52e4, max: 520999, state: "Andhra Pradesh", region: "NTR" },
  { min: 521e3, max: 521999, state: "Andhra Pradesh", region: "Krishna" },
  { min: 522e3, max: 522999, state: "Andhra Pradesh", region: "Guntur" },
  { min: 523e3, max: 523999, state: "Andhra Pradesh", region: "Prakasam" },
  { min: 524e3, max: 524999, state: "Andhra Pradesh", region: "Nellore" },
  { min: 53e4, max: 530999, state: "Andhra Pradesh", region: "Visakhapatnam" },
  { min: 531e3, max: 531999, state: "Andhra Pradesh", region: "Srikakulam" },
  { min: 533e3, max: 533999, state: "Andhra Pradesh", region: "East Godavari" },
  { min: 534e3, max: 534999, state: "Andhra Pradesh", region: "West Godavari" },
  { min: 535e3, max: 535999, state: "Andhra Pradesh", region: "Vizianagaram" }
];
var TELANGANA_RANGES = [
  { min: 5e5, max: 500999, state: "Telangana", region: "Hyderabad" },
  { min: 501e3, max: 501999, state: "Telangana", region: "Ranga Reddy" },
  { min: 502e3, max: 502999, state: "Telangana", region: "Medak" },
  { min: 503e3, max: 503999, state: "Telangana", region: "Nizamabad" },
  { min: 504e3, max: 504999, state: "Telangana", region: "Adilabad" },
  { min: 505e3, max: 505999, state: "Telangana", region: "Karimnagar" },
  { min: 506e3, max: 506999, state: "Telangana", region: "Warangal" },
  { min: 507e3, max: 507999, state: "Telangana", region: "Khammam" },
  { min: 508e3, max: 508999, state: "Telangana", region: "Nalgonda" },
  { min: 509e3, max: 509999, state: "Telangana", region: "Mahbubnagar" }
];
var pincodeCache = /* @__PURE__ */ new Map();
function clearPincodeCache() {
  pincodeCache.clear();
}
function getCachedPincode(pincode) {
  return pincodeCache.get(pincode);
}
function isValidPincodeFormat(pincode) {
  return /^\d{6}$/.test(pincode.replace(/\s/g, ""));
}
function isPincodeDeliverable(pincode) {
  const cleanPincode = pincode.replace(/\s/g, "");
  if (!isValidPincodeFormat(cleanPincode)) {
    return false;
  }
  const pincodeNum = parseInt(cleanPincode, 10);
  for (const range of ANDHRA_PRADESH_RANGES) {
    if (pincodeNum >= range.min && pincodeNum <= range.max) {
      return true;
    }
  }
  for (const range of TELANGANA_RANGES) {
    if (pincodeNum >= range.min && pincodeNum <= range.max) {
      return true;
    }
  }
  return false;
}
function getFallbackPincodeData(pincode) {
  const pincodeNum = parseInt(pincode, 10);
  for (const range of ANDHRA_PRADESH_RANGES) {
    if (pincodeNum >= range.min && pincodeNum <= range.max) {
      return {
        pincode,
        city: `${range.region} City`,
        state: range.state,
        district: range.region,
        isDeliverable: true,
        source: "fallback"
      };
    }
  }
  for (const range of TELANGANA_RANGES) {
    if (pincodeNum >= range.min && pincodeNum <= range.max) {
      return {
        pincode,
        city: `${range.region} City`,
        state: range.state,
        district: range.region,
        isDeliverable: true,
        source: "fallback"
      };
    }
  }
  return null;
}
async function fetchPincodeFromAPI(pincode) {
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();
    if (data?.[0]?.Status === "Success" && data[0].PostOffice) {
      const postOffices = data[0].PostOffice;
      const firstPostOffice = postOffices[0];
      const state = firstPostOffice.State;
      const district = firstPostOffice.District;
      let city = district;
      for (const postOffice of postOffices) {
        if (postOffice.Block && postOffice.Block.trim() && postOffice.Block !== district) {
          city = postOffice.Block.trim();
          break;
        }
        if (postOffice.Name && postOffice.Name.trim() && !postOffice.Name.toLowerCase().includes("post office") && postOffice.Name !== district) {
          city = postOffice.Name.trim();
          break;
        }
      }
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
        source: "api"
      };
    }
  } catch (error) {
    console.error("Error fetching pincode from API:", error);
  }
  return null;
}
async function validatePincode(pincode) {
  const cleanPincode = pincode.replace(/\s/g, "");
  if (!isValidPincodeFormat(cleanPincode)) {
    return null;
  }
  if (pincodeCache.has(cleanPincode)) {
    return pincodeCache.get(cleanPincode);
  }
  try {
    const apiData = await fetchPincodeFromAPI(cleanPincode);
    if (apiData) {
      pincodeCache.set(cleanPincode, apiData);
      return apiData;
    }
  } catch (error) {
    console.warn("Pincode API failed, using fallback:", error);
  }
  const fallbackData = getFallbackPincodeData(cleanPincode);
  if (fallbackData) {
    pincodeCache.set(cleanPincode, fallbackData);
    return fallbackData;
  }
  const notDeliverable = {
    pincode: cleanPincode,
    city: "",
    state: "",
    district: "",
    isDeliverable: false,
    source: "fallback"
  };
  pincodeCache.set(cleanPincode, notDeliverable);
  return notDeliverable;
}
function getDeliveryStatusMessage(pincodeData) {
  if (!pincodeData) {
    return "Please enter a valid 6-digit pincode";
  }
  if (pincodeData.isDeliverable) {
    return "Deliverable to this pincode";
  }
  return "Not deliverable to this pincode";
}
async function getPincodeInfo(pincode) {
  const pincodeData = await validatePincode(pincode);
  if (!pincodeData) {
    return {
      deliverable: false,
      city: "",
      state: "",
      district: "",
      message: "Please enter a valid 6-digit pincode"
    };
  }
  return {
    deliverable: pincodeData.isDeliverable,
    city: pincodeData.city,
    state: pincodeData.state,
    district: pincodeData.district,
    message: getDeliveryStatusMessage(pincodeData)
  };
}

// src/timeline/customerOrderTimeline.ts
var CUSTOMER_MILESTONES = [
  { id: "ORDER_PLACED", key: "CUSTOMER_ORDER_PLACED", label: "Order placed" },
  { id: "ORDER_CONFIRMED", key: "CUSTOMER_ORDER_CONFIRMED", label: "Order confirmed" },
  { id: "SHIPPED", key: "CUSTOMER_SHIPPED", label: "Shipped" },
  { id: "OUT_FOR_DELIVERY", key: "CUSTOMER_OUT_FOR_DELIVERY", label: "Out for delivery" },
  { id: "DELIVERED", key: "CUSTOMER_DELIVERED", label: "Delivered" }
];
function normalizeKey(raw) {
  return String(raw || "").trim().replace(/\s+/g, "_").replace(/-/g, "_").toUpperCase();
}
function mapBackendKeyToCustomerMilestone(rawKey) {
  const k = normalizeKey(rawKey);
  if (!k) return null;
  if (k === "ORDER_PLACED") return "ORDER_PLACED";
  if (k === "ORDER_CONFIRMED") return "ORDER_CONFIRMED";
  if (k === "ORDER_PACKED" || k === "ORDER_ASSIGNED" || k === "ORDER_PICKED_UP") {
    return "SHIPPED";
  }
  if (k === "ORDER_IN_TRANSIT") return "OUT_FOR_DELIVERY";
  if (k === "ORDER_DELIVERED") return "DELIVERED";
  return null;
}
function mapBackendKeyToTerminalMilestone(rawKey) {
  const k = normalizeKey(rawKey);
  if (k === "ORDER_CANCELLED") return "CANCELLED";
  if (k === "ORDER_FAILED") return "FAILED";
  if (k === "ORDER_RETURNED") return "FAILED";
  return null;
}
function earliestIso(a, b) {
  if (!a) return b;
  if (!b) return a;
  const da = new Date(a);
  const db = new Date(b);
  if (!Number.isFinite(da.getTime())) return b;
  if (!Number.isFinite(db.getTime())) return a;
  return da.getTime() <= db.getTime() ? a : b;
}
function buildCustomerOrderTimeline(rawBackendSteps) {
  const backendSteps = Array.isArray(rawBackendSteps) ? rawBackendSteps : [];
  const terminalBackendStep = backendSteps.find((s) => {
    const terminal = mapBackendKeyToTerminalMilestone(s?.key);
    return Boolean(terminal) || s?.state === "failed";
  });
  const terminalMilestone = terminalBackendStep ? mapBackendKeyToTerminalMilestone(terminalBackendStep?.key) || "FAILED" : null;
  if (terminalBackendStep && terminalMilestone) {
    const occurred = {};
    for (const s of backendSteps) {
      if (s?.state === "pending") continue;
      const m = mapBackendKeyToCustomerMilestone(s?.key);
      if (!m) continue;
      const existing = occurred[m];
      const ts = earliestIso(existing?.timestamp, s?.timestamp);
      occurred[m] = {
        key: CUSTOMER_MILESTONES.find((x) => x.id === m).key,
        label: CUSTOMER_MILESTONES.find((x) => x.id === m).label,
        timestamp: ts,
        state: "completed"
      };
    }
    const steps = [];
    for (const milestone of CUSTOMER_MILESTONES) {
      const step = occurred[milestone.id];
      if (step) steps.push(step);
    }
    steps.push({
      key: terminalMilestone === "CANCELLED" ? "CUSTOMER_CANCELLED" : "CUSTOMER_FAILED",
      label: terminalMilestone === "CANCELLED" ? "Cancelled" : "Failed",
      description: String(terminalBackendStep?.description || "").trim() || void 0,
      timestamp: terminalBackendStep?.timestamp,
      state: "failed"
    });
    return steps;
  }
  const currentBackendStep = backendSteps.find((s) => s?.state === "current");
  const currentMilestone = mapBackendKeyToCustomerMilestone(currentBackendStep?.key) || "ORDER_PLACED";
  const etaForOutForDelivery = currentMilestone === "OUT_FOR_DELIVERY" && currentBackendStep?.eta?.start && currentBackendStep?.eta?.end ? {
    start: currentBackendStep.eta.start,
    end: currentBackendStep.eta.end,
    confidence: currentBackendStep.eta.confidence
  } : void 0;
  const timestampsByMilestone = {};
  for (const s of backendSteps) {
    if (!s?.timestamp) continue;
    const m = mapBackendKeyToCustomerMilestone(s?.key);
    if (!m) continue;
    timestampsByMilestone[m] = earliestIso(timestampsByMilestone[m], s.timestamp);
  }
  const currentIndex = CUSTOMER_MILESTONES.findIndex((m) => m.id === currentMilestone);
  const safeCurrentIndex = currentIndex >= 0 ? currentIndex : 0;
  if (currentMilestone === "DELIVERED") {
    return CUSTOMER_MILESTONES.map((m) => ({
      key: m.key,
      label: m.label,
      timestamp: timestampsByMilestone[m.id],
      state: "completed",
      eta: void 0
    }));
  }
  return CUSTOMER_MILESTONES.map((m, idx) => {
    const state = idx < safeCurrentIndex ? "completed" : idx === safeCurrentIndex ? "current" : "pending";
    return {
      key: m.key,
      label: m.label,
      timestamp: state === "pending" ? void 0 : timestampsByMilestone[m.id],
      state,
      eta: m.id === "OUT_FOR_DELIVERY" && state === "current" ? etaForOutForDelivery : void 0
    };
  });
}
function getCurrentMilestone(timeline) {
  const current = timeline.find((s) => s.state === "current");
  if (!current) return null;
  return CUSTOMER_MILESTONES.find((m) => m.key === current.key)?.id || null;
}
function isTerminalState(timeline) {
  return timeline.some((s) => s.state === "failed");
}
function getTimelineEta(timeline) {
  const outForDelivery = timeline.find((s) => s.key === "CUSTOMER_OUT_FOR_DELIVERY");
  return outForDelivery?.eta;
}

// src/payment/paymentStateMachine.ts
var PAYMENT_TRANSITIONS = [
  // From PENDING
  { from: "PENDING", to: "PROCESSING", event: "INITIATE", allowed: true },
  { from: "PENDING", to: "CANCELLED", event: "CANCEL", allowed: true },
  // From PROCESSING
  { from: "PROCESSING", to: "PAID", event: "CONFIRM", allowed: true },
  { from: "PROCESSING", to: "FAILED", event: "FAIL", allowed: true },
  { from: "PROCESSING", to: "CANCELLED", event: "CANCEL", allowed: true },
  // From PAID
  { from: "PAID", to: "REFUNDED", event: "REFUND", allowed: true },
  { from: "PAID", to: "PARTIALLY_REFUNDED", event: "PARTIAL_REFUND", allowed: true },
  // From PARTIALLY_REFUNDED
  { from: "PARTIALLY_REFUNDED", to: "REFUNDED", event: "REFUND", allowed: true },
  { from: "PARTIALLY_REFUNDED", to: "PARTIALLY_REFUNDED", event: "PARTIAL_REFUND", allowed: true },
  // Terminal states (no transitions)
  { from: "FAILED", to: "PENDING", event: "INITIATE", allowed: true },
  // Retry allowed
  { from: "CANCELLED", to: "PENDING", event: "INITIATE", allowed: true }
  // Retry allowed
];
var TERMINAL_STATES = ["REFUNDED", "FAILED", "CANCELLED"];
var SUCCESS_STATES = ["PAID", "PARTIALLY_REFUNDED"];
var REFUNDABLE_STATES = ["PAID", "PARTIALLY_REFUNDED"];
function canTransition(currentStatus, event) {
  const transition = PAYMENT_TRANSITIONS.find(
    (t) => t.from === currentStatus && t.event === event
  );
  return transition?.allowed ?? false;
}
function getNextStatus(currentStatus, event) {
  const transition = PAYMENT_TRANSITIONS.find(
    (t) => t.from === currentStatus && t.event === event && t.allowed
  );
  return transition?.to ?? null;
}
function isTerminalState2(status) {
  return TERMINAL_STATES.includes(status);
}
function isSuccessfulPayment(status) {
  return SUCCESS_STATES.includes(status);
}
function canRefund(status) {
  return REFUNDABLE_STATES.includes(status);
}
function isPending(status) {
  return status === "PENDING" || status === "PROCESSING";
}
function getValidEvents(status) {
  return PAYMENT_TRANSITIONS.filter((t) => t.from === status && t.allowed).map((t) => t.event);
}
function createInitialPaymentState(amount, method) {
  return {
    status: "PENDING",
    method,
    amount,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function applyPaymentEvent(state, event, data) {
  const newStatus = getNextStatus(state.status, event);
  if (!newStatus) {
    return null;
  }
  return {
    ...state,
    status: newStatus,
    transactionId: data?.transactionId ?? state.transactionId,
    failureReason: data?.failureReason,
    refundedAmount: data?.refundedAmount ?? state.refundedAmount,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function getPaymentStatusText(status) {
  const statusText = {
    PENDING: "Pending",
    PROCESSING: "Processing",
    PAID: "Paid",
    FAILED: "Failed",
    REFUNDED: "Refunded",
    PARTIALLY_REFUNDED: "Partially Refunded",
    CANCELLED: "Cancelled"
  };
  return statusText[status];
}
function getPaymentStatusColor(status) {
  const colors = {
    PENDING: "#FFA500",
    // Orange
    PROCESSING: "#007AFF",
    // Blue
    PAID: "#34C759",
    // Green
    FAILED: "#FF3B30",
    // Red
    REFUNDED: "#8E8E93",
    // Gray
    PARTIALLY_REFUNDED: "#FF9500",
    // Orange
    CANCELLED: "#8E8E93"
    // Gray
  };
  return colors[status];
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ANDHRA_PRADESH_RANGES,
  CUSTOMER_MILESTONES,
  DELIVERY_CONFIG,
  PAYMENT_REFUNDABLE_STATES,
  PAYMENT_SUCCESS_STATES,
  PAYMENT_TERMINAL_STATES,
  PAYMENT_TRANSITIONS,
  PINCODE_CORRECTIONS,
  TELANGANA_RANGES,
  WAREHOUSE_ADDRESS,
  applyPaymentEvent,
  buildCustomerOrderTimeline,
  calculateDeliveryFee,
  calculateDeliveryFeeForPincode,
  calculateDistance,
  canPaymentTransition,
  canRefund,
  clearPincodeCache,
  createInitialPaymentState,
  fetchPincodeFromAPI,
  formatDeliveryFee,
  getAdminAddress,
  getCachedPincode,
  getCurrentMilestone,
  getDeliveryFeeBreakdown,
  getDeliveryStatusMessage,
  getFallbackPincodeData,
  getNextPaymentStatus,
  getPaymentStatusColor,
  getPaymentStatusText,
  getPincodeInfo,
  getTimelineEta,
  getValidPaymentEvents,
  getWarehouseAddress,
  isDeliveryAvailable,
  isPaymentPending,
  isPaymentTerminalState,
  isPincodeDeliverable,
  isSuccessfulPayment,
  isTimelineTerminalState,
  isValidPincode,
  isValidPincodeFormat,
  validatePincode
});
