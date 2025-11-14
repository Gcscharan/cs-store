export interface PriceBreakdown {
  subtotal: number;
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
 * Calculate price breakdown for cart/order
 * @param items - Array of cart items
 * @param deliveryFeeDetails - Delivery fee information
 * @returns Complete price breakdown
 */
export const calculatePriceBreakdown = (
  items: CartItem[],
  deliveryFeeDetails?: DeliveryFeeDetails
): PriceBreakdown => {
  // Calculate subtotal
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Calculate item count
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Calculate discount (10% of subtotal)
  const discount = Math.round(subtotal * 0.1);

  // Get delivery fee
  const deliveryFee = deliveryFeeDetails?.finalFee || 0;
  const isFreeDelivery = deliveryFeeDetails?.isFreeDelivery || false;

  // Calculate total
  const total = subtotal + deliveryFee - discount;

  // Calculate savings (same as discount for now)
  const savings = discount;

  return {
    subtotal,
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
