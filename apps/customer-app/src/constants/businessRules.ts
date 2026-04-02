export const BusinessRules = {
  // Delivery (from backend/src/utils/deliveryFeeCalculator.ts L29-38)
  FREE_DELIVERY_THRESHOLD: 2000,
  DELIVERY_FEE_0_2_KM: 25,
  DELIVERY_FEE_2_6_KM_MIN: 35,
  DELIVERY_FEE_2_6_KM_MAX: 60,
  DELIVERY_FEE_BEYOND_6_KM_BASE: 60,
  DELIVERY_FEE_EXTRA_KM_RATE: 8,

  // GST (from backend/src/domains/operations/services/orderBuilder.ts)
  DEFAULT_GST_RATE: 18,

  // Payment methods supported by backend
  PAYMENT_METHODS: ['cod', 'upi'] as const,
  MERCHANT_UPI_VPA: process.env.EXPO_PUBLIC_MERCHANT_UPI_VPA 
    || 'vyaparsetu@upi',

  // UPI validation regex (from frontend/src/pages/CheckoutPage.tsx L972)
  UPI_VPA_REGEX: /^[\w.-]{2,}@[\w.-]{2,}$/,

  // Order
  MIN_ORDER_AMOUNT: 0, // removed per CheckoutPage.tsx L696
  OTP_LENGTH: 6,
  OTP_RESEND_TIMEOUT: 30,
  RAZORPAY_CURRENCY: 'INR',

  // Cart
  // Stock check: availableStock = stock - reservedStock
  // Out of stock = stock <= 0
};
