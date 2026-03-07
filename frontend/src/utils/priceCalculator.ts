export interface PriceBreakdown {
  subtotal: number;
  subtotalBeforeTax: number;
  gstAmount: number;
  gstRate: number; // GST percentage used
  discount: number;
  deliveryFee: number;
  total: number;
  itemCount: number;
  isFreeDelivery: boolean;
  savings: number;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
}

export interface DeliveryFeeDetails {
  finalFee: number;
  isFreeDelivery: boolean;
}

/**
 * Default GST rate (18%) - must match backend DEFAULT_GST_RATE
 * Note: This is for display purposes only. Actual GST is calculated server-side.
 */
const DEFAULT_GST_RATE = 18;

/**
 * Calculate price breakdown for cart/order
 * IMPORTANT: GST is calculated server-side. This frontend calculation
 * is only for display/estimation purposes. The actual GST amount
 * comes from the backend during order creation.
 * 
 * @param items - Array of cart items
 * @param deliveryFeeDetails - Delivery fee information
 * @returns Complete price breakdown
 */
export const calculatePriceBreakdown = (
  items: CartItem[],
  deliveryFeeDetails?: DeliveryFeeDetails
): PriceBreakdown => {
  // Calculate subtotal (price before tax)
  const subtotalBeforeTax = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Calculate item count
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate GST (18% default)
  // Note: Actual GST is calculated server-side with product-specific rates
  const gstAmount = Math.round(subtotalBeforeTax * (DEFAULT_GST_RATE / 100) * 100) / 100;

  // Subtotal for display (same as subtotalBeforeTax)
  const subtotal = subtotalBeforeTax;

  // Discount is 0 (no discounts currently)
  const discount = 0;

  // Get delivery fee
  const deliveryFee = deliveryFeeDetails?.finalFee || 0;
  const isFreeDelivery = deliveryFeeDetails?.isFreeDelivery || false;

  // Calculate total: subtotal + GST + delivery fee - discount
  const total = Math.round((subtotalBeforeTax + gstAmount + deliveryFee - discount) * 100) / 100;

  // Calculate savings (same as discount for now)
  const savings = discount;

  return {
    subtotal,
    subtotalBeforeTax,
    gstAmount,
    gstRate: DEFAULT_GST_RATE,
    discount,
    deliveryFee,
    total,
    itemCount,
    isFreeDelivery,
    savings,
  };
};

/**
 * Format price for display
 * @param amount - Price amount
 * @returns Formatted price string
 */
export const formatPrice = (amount: number): string => {
  return `₹${amount.toFixed(2)}`;
};

/**
 * Format delivery fee for display
 * @param deliveryFeeDetails - Delivery fee information
 * @returns Formatted delivery fee string
 */
export const formatDeliveryFee = (
  deliveryFeeDetails?: DeliveryFeeDetails
): string => {
  if (!deliveryFeeDetails) {
    return "Calculating...";
  }

  if (deliveryFeeDetails.isFreeDelivery) {
    return "FREE";
  }

  return formatPrice(deliveryFeeDetails.finalFee);
};
