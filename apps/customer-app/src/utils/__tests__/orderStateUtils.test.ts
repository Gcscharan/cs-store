import { 
  updateOrderInOrdersList, 
  createOrderListUpdater, 
  updateSingleOrderState,
  OrderLike 
} from '../orderStateUtils';

describe('Order State Utils', () => {
  const mockOrder1: OrderLike = {
    _id: '1',
    orderNumber: 'ORD001',
    status: 'CREATED',
    allowedActions: ['CONFIRM'],
    totalAmount: 100,
  };

  const mockOrder2: OrderLike = {
    _id: '2',
    orderNumber: 'ORD002',
    status: 'CONFIRMED',
    allowedActions: ['PACK'],
    totalAmount: 200,
  };

  const updatedOrder1: OrderLike = {
    _id: '1',
    orderNumber: 'ORD001',
    status: 'CONFIRMED',
    allowedActions: ['PACK'],
    totalAmount: 100,
    confirmedAt: '2024-01-01T00:00:00Z',
  };

  describe('updateOrderInOrdersList', () => {
    it('should replace order with matching ID', () => {
      const orders = [mockOrder1, mockOrder2];
      const result = updateOrderInOrdersList(orders, updatedOrder1);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(updatedOrder1);
      expect(result[1]).toEqual(mockOrder2);
      expect(result[0].status).toBe('CONFIRMED');
      expect(result[0].allowedActions).toEqual(['PACK']);
    });

    it('should not modify orders without matching ID', () => {
      const orders = [mockOrder2];
      const result = updateOrderInOrdersList(orders, updatedOrder1);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockOrder2);
    });

    it('should return new array instance', () => {
      const orders = [mockOrder1, mockOrder2];
      const result = updateOrderInOrdersList(orders, updatedOrder1);
      
      expect(result).not.toBe(orders);
    });
  });

  describe('createOrderListUpdater', () => {
    it('should return function that updates order list', () => {
      const updater = createOrderListUpdater(updatedOrder1);
      const orders = [mockOrder1, mockOrder2];
      const result = updater(orders);
      
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(updatedOrder1);
      expect(result[1]).toEqual(mockOrder2);
    });
  });

  describe('updateSingleOrderState', () => {
    it('should return updated order when IDs match', () => {
      const result = updateSingleOrderState(mockOrder1, updatedOrder1);
      expect(result).toEqual(updatedOrder1);
    });

    it('should return current order when IDs do not match', () => {
      const result = updateSingleOrderState(mockOrder2, updatedOrder1);
      expect(result).toEqual(mockOrder2);
    });

    it('should return updated order when current order is null', () => {
      const result = updateSingleOrderState(null, updatedOrder1);
      expect(result).toEqual(updatedOrder1);
    });

    it('should return updated order when current order is undefined', () => {
      const result = updateSingleOrderState(undefined, updatedOrder1);
      expect(result).toEqual(updatedOrder1);
    });
  });
});