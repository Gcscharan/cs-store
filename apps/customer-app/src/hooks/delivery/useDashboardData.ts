import { useDeliveryState } from './useDeliveryState';
import type { DeliveryStateResult } from './useDeliveryState';
import { getMotivationMessage } from '../../utils/deliveryUtils';

export interface DashboardData extends DeliveryStateResult {
  /** Contextual motivation message based on today's earnings and delivery count */
  motivation: string;
}

export const useDashboardData = (): DashboardData => {
  const deliveryState = useDeliveryState();
  const { deliveryBoy } = deliveryState;

  const motivation = getMotivationMessage(
    deliveryBoy?.earnings ?? 0,
    deliveryBoy?.completedOrdersCount ?? 0,
  );

  return {
    ...deliveryState,
    motivation,
  };
};
