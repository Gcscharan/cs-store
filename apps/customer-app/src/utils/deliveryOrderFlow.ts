/**
 * Delivery order UI flow — mirrors web EnhancedHomeTab.tsx status gates.
 * Buttons are driven by orderStatus / deliveryStatus / arrivedAt / COD, not only allowedActions.
 */

import type { Order } from './deliveryUtils';

/** Order statuses shown under Active Deliveries — mirrors web EnhancedHomeTab.tsx */
export const ACTIVE_ORDER_STATUSES = [
  'confirmed',
  'packed',
  'out_for_delivery',
  'assigned',
  'picked_up',
  'in_transit',
  'arrived',
  'cancelled',
] as const;

/** True when an order belongs in Active Deliveries (not available / idle). */
export function isActiveDeliveryOrder(order: Pick<Order, 'orderStatus' | 'deliveryStatus'>): boolean {
  const status = (order.orderStatus ?? '').toLowerCase();
  const deliveryStatus = (order.deliveryStatus ?? '').toLowerCase();
  if (deliveryStatus === 'unassigned') return false;
  return ACTIVE_ORDER_STATUSES.includes(status as (typeof ACTIVE_ORDER_STATUSES)[number]);
}

export type CodCollectionSnapshot = {
  mode: 'CASH' | 'UPI';
} | null | undefined;

export interface DeliveryFlowState {
  status: string;
  deliveryStatus: string;
  isCancelled: boolean;
  isDelivered: boolean;
  isCod: boolean;
  hasArrived: boolean;
  codCollected: boolean;
  isUnassigned: boolean;
  canSendOtp: boolean;
  showPickup: boolean;
  showUnassignedWarning: boolean;
  showStartDelivery: boolean;
  showMarkArrived: boolean;
  showStartDeliveryAttempt: boolean;
  showOtpInput: boolean;
  showCodCollect: boolean;
  showCodCollectedBanner: boolean;
  showCancelDelivery: boolean;
  showNavigate: boolean;
}

export function getDeliveryFlowState(
  order: Order,
  codCollection: CodCollectionSnapshot,
  deliveryAttempted: boolean,
): DeliveryFlowState {
  const status = (order.orderStatus ?? '').toLowerCase();
  const deliveryStatus = (order.deliveryStatus ?? '').toLowerCase();
  const isCancelled = status === 'cancelled' || deliveryStatus === 'cancelled';
  const isDelivered = status === 'delivered' || deliveryStatus === 'delivered';
  const isCod = (order.paymentMethod ?? '').toLowerCase() === 'cod';
  const hasArrived = !!order.arrivedAt;
  const codCollected = !!codCollection;
  const isUnassigned = deliveryStatus === 'unassigned';

  const canSendOtp =
    !isCancelled && !isDelivered && hasArrived && (!isCod || codCollected);

  const inTransitLike = ['in_transit', 'out_for_delivery', 'arrived'].includes(status);

  return {
    status,
    deliveryStatus,
    isCancelled,
    isDelivered,
    isCod,
    hasArrived,
    codCollected,
    isUnassigned,
    canSendOtp,
    showPickup:
      status === 'assigned' && !isUnassigned && !isCancelled && !isDelivered,
    showUnassignedWarning: status === 'assigned' && isUnassigned,
    showStartDelivery:
      (status === 'picked_up' || status === 'packed') && !isCancelled && !isDelivered,
    showMarkArrived:
      status === 'in_transit' && !hasArrived && !isCancelled && !isDelivered,
    showStartDeliveryAttempt:
      inTransitLike && canSendOtp && !deliveryAttempted,
    showOtpInput:
      inTransitLike &&
      deliveryAttempted &&
      !isCancelled &&
      !isDelivered &&
      (!isCod || codCollected),
    showCodCollect:
      isCod && hasArrived && !isCancelled && !isDelivered && !codCollected,
    showCodCollectedBanner: isCod && codCollected,
    showCancelDelivery:
      (status === 'in_transit' || status === 'out_for_delivery') &&
      hasArrived &&
      !isCancelled &&
      !isDelivered,
    showNavigate:
      ['picked_up', 'packed', 'in_transit', 'out_for_delivery', 'arrived'].includes(status) &&
      !isCancelled &&
      !isDelivered,
  };
}
