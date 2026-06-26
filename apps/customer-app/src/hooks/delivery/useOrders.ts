import { useGetDeliveryOrdersQuery } from '../../api/deliveryApi';
import { Order } from '../../utils/deliveryUtils';
import { isActiveDeliveryOrder } from '../../utils/deliveryOrderFlow';

// Re-export Order type for convenience
export type { Order } from '../../utils/deliveryUtils';

export interface DeliveryBoy {
  _id?: string;
  name?: string;
  phone?: string;
  availability?: string;
  earnings?: number;
  completedOrdersCount?: number;
  assignedAreas?: string[];
  rating?: number;
}

export const AVAILABLE_STATUSES = ['created'] as const;

/** @deprecated Use isActiveDeliveryOrder — kept for tests/imports */
export { ACTIVE_ORDER_STATUSES as ACTIVE_STATUSES } from '../../utils/deliveryOrderFlow';

export interface UseOrdersResult {
  orders: Order[];
  deliveryBoy: DeliveryBoy | null;
  availableOrders: Order[];   // replaces newOrders
  activeOrders: Order[];      // replaces single activeOrder
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => void;
}

export const useOrders = (): UseOrdersResult => {
  const { data, isLoading, isFetching, refetch } = useGetDeliveryOrdersQuery();

  const orders: Order[] = data?.orders ?? [];
  const deliveryBoy: DeliveryBoy | null = data?.deliveryBoy ?? null;

  const availableOrders = orders.filter(
    o => (o.orderStatus ?? '').toLowerCase() === 'created',
  );
  const activeOrders = orders.filter(isActiveDeliveryOrder);

  return {
    orders,
    deliveryBoy,
    availableOrders,
    activeOrders,
    isLoading,
    isFetching,
    refetch,
  };
};
