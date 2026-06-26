import { DELIVERY_COLORS } from '../constants/deliveryTheme';

export interface Order {
  _id: string;
  orderStatus: string;
  deliveryStatus?: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus?: string;
  arrivedAt?: string;
  deliveryOtpGeneratedAt?: string; // Set by backend when OTP is sent — used to derive deliveryAttempted
  createdAt?: string;
  cancelReason?: string;
  allowedActions?: string[];
  address: {
    addressLine: string;
    city: string;
    pincode?: string;
    lat?: number;
    lng?: number;
  };
  userId?: {
    name?: string;
    phone?: string;
  };
}

/**
 * Calculates the great-circle distance between two coordinates using the Haversine formula.
 * @returns Distance in kilometres
 */
const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/** Avoid showing the same phone number as both name and phone line. */
export const getCustomerDisplayName = (name?: string, phone?: string): string => {
  const n = (name ?? '').trim();
  const p = (phone ?? '').trim();
  if (!n) return 'Customer';
  if (p && digitsOnly(n) === digitsOnly(p)) return 'Customer';
  if (/^\+?[\d\s\-()]{8,}$/.test(n)) return 'Customer';
  return n;
};

export const haversineDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Estimates delivery time in minutes assuming an average speed of 30 km/h.
 */
export const estimateETA = (distanceKm: number): number =>
  Math.round((distanceKm / 30) * 60);

/**
 * Returns HIGH if the order's earnings-per-km ratio exceeds ₹15, otherwise NORMAL.
 */
export const getOrderPriority = (order: Order): 'HIGH' | 'NORMAL' => {
  if (!order.address?.lat || !order.address?.lng) return 'NORMAL';
  const earningsPerKm = order.totalAmount / 3; // rough estimate
  return earningsPerKm > 15 ? 'HIGH' : 'NORMAL';
};

/**
 * Returns a contextual motivation message based on today's earnings and delivery count.
 * Fixes the morning zero-state that previously showed blank/demotivating stats.
 */
export const getMotivationMessage = (earnings: number, deliveries: number): string => {
  if (deliveries === 0) return '🚀 Start your first delivery and earn today!';
  if (earnings < 100)   return `🔥 ${Math.ceil((100 - earnings) / 12)} more deliveries to reach ₹100`;
  if (earnings < 500)   return `⚡ ₹${500 - earnings} away from ₹500 today!`;
  return `🏆 Great work! ₹${earnings} earned today`;
};

/**
 * Maps an order status string to display configuration (label, text colour, background colour).
 */
export const getStatusConfig = (
  status: string,
): { label: string; color: string; bgColor: string } => {
  switch (status.toLowerCase()) {
    case 'assigned':
      return { label: 'Assigned',   color: DELIVERY_COLORS.info,    bgColor: DELIVERY_COLORS.card };
    case 'picked_up':
      return { label: 'Picked Up',  color: DELIVERY_COLORS.primary,  bgColor: DELIVERY_COLORS.card };
    case 'in_transit':
      return { label: 'In Transit', color: DELIVERY_COLORS.warning,  bgColor: DELIVERY_COLORS.warningBg };
    case 'arrived':
      return { label: 'Arrived',    color: DELIVERY_COLORS.success,  bgColor: DELIVERY_COLORS.successBg };
    case 'delivered':
      return { label: 'Delivered',  color: DELIVERY_COLORS.success,  bgColor: DELIVERY_COLORS.successBg };
    case 'cancelled':
      return { label: 'Cancelled',  color: DELIVERY_COLORS.danger,   bgColor: DELIVERY_COLORS.dangerBg };
    default:
      return { label: status,       color: DELIVERY_COLORS.textSecondary, bgColor: DELIVERY_COLORS.card };
  }
};
