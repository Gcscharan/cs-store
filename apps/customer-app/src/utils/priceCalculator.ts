import { BusinessRules } from '../constants/businessRules';
import { 
  calculateDeliveryFee, 
  DELIVERY_CONFIG 
} from '@vyaparsetu/shared-utils';
import type { CartItem, Address } from '../types';

interface DeliveryFeeDetails {
  finalFee: number;
  isFreeDelivery: boolean;
  requiresAddress?: boolean;
}

interface PriceBreakdown {
  subtotalBeforeTax: number;
  gstRate: number;
  gstAmount: number;
  deliveryFee: number;
  discount: number;
  total: number;
  itemCount: number;
  isFreeDelivery: boolean;
  requiresAddress: boolean;
}

export function calculatePriceBreakdown(
  items: CartItem[],
  deliveryFeeDetails?: DeliveryFeeDetails | null,
  couponDiscount: number = 0
): PriceBreakdown {
  const subtotalBeforeTax = items.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
    0
  );

  const gstRate = BusinessRules.DEFAULT_GST_RATE;
  const gstAmount = Math.round(subtotalBeforeTax * (gstRate / 100) * 100) / 100;
  const deliveryFee = deliveryFeeDetails?.finalFee ?? 0;
  const discount = couponDiscount;
  const total = Math.round((subtotalBeforeTax + gstAmount + deliveryFee - discount) * 100) / 100;
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return {
    subtotalBeforeTax,
    gstRate,
    gstAmount,
    deliveryFee,
    discount,
    total,
    itemCount,
    isFreeDelivery: deliveryFeeDetails?.isFreeDelivery ?? false,
    requiresAddress: deliveryFeeDetails?.requiresAddress ?? true,
  };
}

// Estimate delivery fee using shared logic
export function estimateDeliveryFee(
  address: Address | null,
  subtotal: number
): DeliveryFeeDetails {
  if (!address || !address.lat || !address.lng) {
    return { 
      finalFee: 0, 
      isFreeDelivery: subtotal >= DELIVERY_CONFIG.FREE_DELIVERY_THRESHOLD, 
      requiresAddress: true 
    };
  }

  const result = calculateDeliveryFee(
    address,
    subtotal
  );

  return {
    finalFee: result.finalFee,
    isFreeDelivery: result.isFreeDelivery,
    requiresAddress: false,
  };
}

export function formatPrice(amount: number): string {
  return `₹${(amount || 0).toFixed(2)}`;
}
