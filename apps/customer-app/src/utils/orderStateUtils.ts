/**
 * Utility functions for managing order state updates
 * Part of mobile admin backend parity implementation
 */

/**
 * Derives allowedActions from orderStatus.
 * Mirrors the server-side logic in adminController.getAdminOrders.
 * Used to keep local state in sync after optimistic updates.
 */
export const getAllowedActions = (status: string | undefined): string[] => {
  switch (String(status || '').toUpperCase()) {
    case 'CREATED':
    case 'PENDING_PAYMENT':
      return ['CONFIRM', 'CANCEL'];
    case 'CONFIRMED':
      return ['PACK', 'CANCEL'];
    case 'PACKED':
      return ['ASSIGN'];
    case 'ASSIGNED':
      return ['UNASSIGN'];
    default:
      return [];
  }
};

export type OrderLike = {
  _id: string;
  orderNumber?: string;
  orderStatus?: string;
  status?: string;
  userId?: { name?: string; phone?: string } | string;
  user?: { name?: string; phone?: string };
  items?: any[];
  totalAmount?: number;
  createdAt?: string;
  allowedActions?: string[];
  deliveryPartner?: { name?: string; phone?: string; vehicleType?: string } | null;
  deliveryBoyId?: any;
  // Include all other order properties
  [key: string]: any;
};

/**
 * Updates a single order in an array of orders by replacing the entire order object
 * This ensures the mobile app uses the complete updated order data from backend responses
 * 
 * @param orders - Current array of orders
 * @param updatedOrder - Complete updated order object from API response
 * @returns New array with the updated order replaced
 */
export const updateOrderInOrdersList = (orders: OrderLike[], updatedOrder: OrderLike): OrderLike[] => {
  return orders.map(order => 
    order._id === updatedOrder._id ? updatedOrder : order
  );
};

/**
 * Creates a state updater function for order lists.
 * Injects computed allowedActions so buttons stay visible after local state updates.
 */
export const createOrderListUpdater = (updatedOrder: OrderLike) => {
  const orderWithActions: OrderLike = {
    ...updatedOrder,
    allowedActions: getAllowedActions(updatedOrder.orderStatus || updatedOrder.status),
  };
  return (prevOrders: OrderLike[]) => updateOrderInOrdersList(prevOrders, orderWithActions);
};

/**
 * Updates order state for single order detail view.
 * Injects computed allowedActions so buttons stay visible after local state updates.
 */
export const updateSingleOrderState = (currentOrder: OrderLike | null | undefined, updatedOrder: OrderLike): OrderLike | null => {
  const orderWithActions: OrderLike = {
    ...updatedOrder,
    allowedActions: getAllowedActions(updatedOrder.orderStatus || updatedOrder.status),
  };
  if (!currentOrder) return orderWithActions;
  return currentOrder._id === updatedOrder._id ? orderWithActions : currentOrder;
};