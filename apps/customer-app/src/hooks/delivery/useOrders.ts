import { useGetDeliveryOrdersQuery } from '../../api/deliveryApi';
import { Order } from '../../utils/deliveryUtils';

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

export const ACTIVE_STATUSES = [
  'confirmed', 'packed', 'assigned', 'picked_up',
  'in_transit', 'out_for_delivery', 'arrived', 'cancelled',
] as const;

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

  const availableOrders = orders.filter(o => o.orderStatus.toLowerCase() === 'created');
  const activeOrders = orders.filter(o =>
    ACTIVE_STATUSES.includes(o.orderStatus.toLowerCase() as any)
  );

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
