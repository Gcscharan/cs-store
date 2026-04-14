import { useOrders } from './useOrders';
import type { Order, DeliveryBoy } from './useOrders';

export type DeliveryState = 'IDLE' | 'NEW_ORDER' | 'ACTIVE_DELIVERY';

export interface DeliveryStateResult {
  state: DeliveryState;
  activeOrders: Order[];
  availableOrders: Order[];
  isOnline: boolean;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
  deliveryBoy: DeliveryBoy | null;
}

export const useDeliveryState = (): DeliveryStateResult => {
  const { activeOrders, availableOrders, deliveryBoy, isLoading, isFetching, refetch } = useOrders();

  const isOnline = deliveryBoy?.availability === 'available';

  // State machine — exact match to web EnhancedHomeTab:
  // ACTIVE_DELIVERY > NEW_ORDER > IDLE (no OFFLINE state)
  const state: DeliveryState =
    activeOrders.length > 0 ? 'ACTIVE_DELIVERY' :
    availableOrders.length > 0 ? 'NEW_ORDER' :
    'IDLE';

  return {
    state,
    activeOrders,
    availableOrders,
    isOnline,
    isLoading,
    isFetching,
    refetch,
    deliveryBoy,
  };
};
